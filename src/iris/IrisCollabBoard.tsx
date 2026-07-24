// ============================================================
// CORE Iris — コラボ募集ボード + コラボ計画ボード (大幅アップグレード)
//
// A. 募集ボード (旧機能) — クリエイター同士の募集投稿
// B. コラボ計画ボード (新機能):
//    1. AI コラボ候補推薦 — 自分のジャンル/ペルソナから「効くジャンル」を提案
//    2. ステージ管理 (候補 → 連絡中 → 確定 → 完了) kanban
//    3. AI DM 下書き (IrisDmDraftModal 連携)
//    4. 完了後の評価 (効果 5 段階 + 次回もやる?)
//    5. AgentTaskQueue 連携 (CMO+CSO に「今月コラボ 3 件」を委任)
//    6. モバイル UX (スワイプ可能なステージ切替、44px タップ対象)
// ============================================================
import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ListChecks, MessageCircle, Star, ChevronRight, Plus, Send } from 'lucide-react';
import { confirmAction } from '../lib/confirmDialog';
import type { IrisBackgroundDef } from './irisStyle';
import type { CustomIrisBackground } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import DelegateToAgentTeamBanner from '../components/DelegateToAgentTeamBanner';
import { notifyInApp } from '../lib/inAppNotify';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { loadIgProfile } from './instagramConnect';
import type { IgProfile } from './instagramConnect';
import { aiFetch } from '../lib/aiFetch';

const IrisDmDraftModal = lazy(() => import('./IrisDmDraftModal'));

// ─── 型 ───────────────────────────────────────────────────────
export type CollabCategory =
  | 'cosme' | 'travel' | 'food' | 'fashion' | 'fitness' | 'lifestyle' | 'other';

export interface CollabPost {
  id: string;
  authorHandle: string;
  authorAvatar?: string;
  category: CollabCategory;
  title: string;
  body: string;
  tags: string[];
  location?: string;
  dateRange?: string;
  followerRange?: string;
  reactions: Record<string, number>;
  chats: { id: string; author: string; text: string; at: string }[];
  createdAt: string;
  aiMatchScore?: number;
  aiMatchReason?: string;
}

/** B. コラボ計画 — 自分が動かしているコラボ案件 */
export type CollabStage = 'candidate' | 'contacting' | 'confirmed' | 'done';

export interface CollabEvaluation {
  effectScore: 1 | 2 | 3 | 4 | 5;  // 効果 (5 が最高)
  wouldRepeat: boolean;             // 次回もやる?
  note?: string;                    // 一言メモ
  recordedAt: string;
}

export interface CollabPlan {
  id: string;
  partnerHandle: string;
  partnerCategory: CollabCategory;
  topic: string;             // 何をやる (例: 「夏コスメ夜更かしレビュー」)
  stage: CollabStage;
  notes?: string;
  reason?: string;           // 自分のペルソナに対する AI 推薦理由
  followerRange?: string;
  createdAt: string;
  updatedAt: string;
  evaluation?: CollabEvaluation;
}

const CATEGORY_META: Record<CollabCategory, { label: string; color: string }> = {
  cosme:     { label: 'コスメ',         color: '#E1306C' },
  travel:    { label: '旅企画',         color: '#F77737' },
  food:      { label: 'グルメ',         color: '#FCB045' },
  fashion:   { label: 'ファッション',   color: '#833AB4' },
  fitness:   { label: 'フィットネス',   color: '#2D9CDB' },
  lifestyle: { label: 'ライフスタイル', color: '#27AE60' },
  other:     { label: 'その他',         color: '#8A7AA0' },
};

const STAGE_META: Record<CollabStage, { label: string; color: string; order: number; hint: string }> = {
  candidate:  { label: '候補',    color: '#9CA3AF', order: 1, hint: 'まだ声をかけていない相手' },
  contacting: { label: '連絡中',  color: '#F59E0B', order: 2, hint: 'DM 送信済み、返信待ち' },
  confirmed:  { label: '確定',    color: '#3B82F6', order: 3, hint: '日程・企画が決まった' },
  done:       { label: '完了',    color: '#10B981', order: 4, hint: '投稿/活動済み、評価しよう' },
};

const POSTS_KEY = 'core_iris_collab_posts_v1';
const PLANS_KEY = 'core_iris_collab_plans_v1';
const MY_CATEGORY_KEY = 'core_iris_my_collab_category_v1';
const MY_HANDLE_KEY = 'core_iris_my_collab_handle_v1';

// ─── 募集ボード seed (旧データ互換) ──────────────────────────
function loadPosts(): CollabPost[] {
  try {
    const r = localStorage.getItem(POSTS_KEY);
    if (r) return JSON.parse(r);
  } catch { /* */ }
  const seeds: CollabPost[] = [
    {
      id: 'seed-1',
      authorHandle: '@hana_cosme', category: 'cosme',
      title: '一緒にコスメレビューしたい！韓国コスメ特集',
      body: '韓国コスメの最新アイテムをダブルレビューしませんか？各自が購入して同日投稿、お互いをタグ付けする形で。フォロワー1万前後の方歓迎',
      tags: ['#コスメ', '#韓国コスメ', '#コラボ'],
      followerRange: '5K〜20K',
      reactions: {}, chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
      aiMatchScore: 92,
      aiMatchReason: 'コスメカテゴリが一致。フォロワー規模も近い。',
    },
    {
      id: 'seed-2',
      authorHandle: '@tabi_noa', category: 'travel',
      title: 'ダブルで旅企画！沖縄リゾートホテルタイアップ',
      body: '7月に沖縄のリゾートホテルとタイアップ交渉中。2名以上だと条件が良くなりそう。',
      tags: ['#旅', '#沖縄', '#タイアップ'],
      location: '沖縄', dateRange: '2026年7月', followerRange: '10K〜50K',
      reactions: {}, chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 8).toISOString(),
      aiMatchScore: 78,
      aiMatchReason: '旅カテゴリ。規模感が合えばよいマッチ。',
    },
    {
      id: 'seed-3',
      authorHandle: '@mika_fashion', category: 'fashion',
      title: 'ファッション × コスメ コラボ動画',
      body: 'コーデ紹介とメイクを組み合わせたリール動画を一緒に作りたい！',
      tags: ['#ファッション', '#コスメ', '#リール'],
      followerRange: '3K〜15K',
      reactions: {}, chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      aiMatchScore: 85,
      aiMatchReason: 'コスメ×ファッションのクロスジャンル。',
    },
  ];
  localStorage.setItem(POSTS_KEY, JSON.stringify(seeds));
  return seeds;
}
function savePosts(p: CollabPost[]) {
  try { localStorage.setItem(POSTS_KEY, JSON.stringify(p)); } catch { /* */ }
}

// ─── コラボ計画 永続化 ────────────────────────────────────────
function loadPlans(): CollabPlan[] {
  try { const r = localStorage.getItem(PLANS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function savePlans(p: CollabPlan[]) {
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(p)); } catch { /* */ }
}

function loadMyCategory(): CollabCategory | '' {
  try { return (localStorage.getItem(MY_CATEGORY_KEY) as CollabCategory) || ''; } catch { return ''; }
}
function saveMyCategory(c: CollabCategory | '') {
  try {
    if (c) localStorage.setItem(MY_CATEGORY_KEY, c);
    else localStorage.removeItem(MY_CATEGORY_KEY);
  } catch { /* */ }
}

// ─── ローカル AI マッチング (既存) ────────────────────────────
function computeAiMatch(post: CollabPost, myCategory: CollabCategory | ''): { score: number; reason: string } {
  if (!myCategory) return { score: Math.floor(60 + Math.random() * 30), reason: 'プロフィール未設定' };
  if (post.category === myCategory) return { score: 88 + Math.floor(Math.random() * 12), reason: `同じ「${CATEGORY_META[myCategory].label}」カテゴリです！` };
  const crossMap: Partial<Record<CollabCategory, CollabCategory[]>> = {
    cosme: ['fashion', 'lifestyle'],
    fashion: ['cosme', 'lifestyle'],
    travel: ['food', 'lifestyle'],
    food: ['travel', 'lifestyle'],
    fitness: ['lifestyle'],
    lifestyle: ['cosme', 'travel', 'fashion', 'food', 'fitness'],
  };
  if (crossMap[myCategory]?.includes(post.category)) {
    return { score: 70 + Math.floor(Math.random() * 15), reason: 'クロスジャンルでエンゲージメント向上が狙えます。' };
  }
  return { score: 40 + Math.floor(Math.random() * 25), reason: '異なるジャンルですが意外なコラボも話題を呼ぶことがあります。' };
}

// ─── AI コラボ候補推薦 (ペルソナベース) ──────────────────────
interface RecommendedPartner {
  category: CollabCategory;
  reason: string;
  exampleTopic: string;
  exampleHandle: string; // ダミーハンドル (実 IG データなし時)
  followerRange: string;
}

async function recommendCollabPartners(
  myCategory: CollabCategory,
  igProfile: IgProfile | null,
): Promise<RecommendedPartner[]> {
  const followers = igProfile?.followers ?? 5000;
  const followerRange = followers < 3000 ? '1K〜5K' : followers < 10000 ? '3K〜15K' : followers < 50000 ? '10K〜50K' : '30K〜100K';

  const sys = `あなたは Instagram クリエイターのコラボ戦略コンサルタント。
ユーザーの「ジャンル」「フォロワー規模」を踏まえて、組むと相性が良いコラボ相手のジャンルを 4 つ提案する。
返答は JSON のみ:
{ "recommendations": [
  { "category": "cosme|travel|food|fashion|fitness|lifestyle|other",
    "reason": "なぜ効くか 40字以内",
    "exampleTopic": "コラボ企画例 30字以内",
    "exampleHandle": "@dummy_handle (実際にいそうな架空のハンドル)",
    "followerRange": "1K〜10K" }
] }
4 件のうち 1 件は同ジャンル、2 件はクロスジャンル、1 件は意外な組み合わせ。`;

  const userPrompt = `自分のジャンル: ${CATEGORY_META[myCategory].label}
フォロワー: ${followers.toLocaleString()} 名
得意な投稿: ${igProfile?.topPostCategories?.join(' / ') || '未設定'}
オーディエンス: ${igProfile?.audienceTopCountries?.map(c => c.country).join(', ') || '日本中心と仮定'}

上記を踏まえて、組むと効くコラボ相手を 4 件、JSON で。`;

  try {
    const data = await enqueueClaudeCall(async () => {
      const r = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1200,
          system: sys,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!r.ok) throw new Error(`AI ${r.status}`);
      return r.json();
    });
    const text = (data as any).content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    const arr = parsed.recommendations as RecommendedPartner[];
    if (!Array.isArray(arr)) throw new Error('not array');
    return arr.slice(0, 4);
  } catch {
    // フォールバック
    const cross: Record<CollabCategory, CollabCategory[]> = {
      cosme: ['fashion', 'lifestyle', 'food'],
      travel: ['food', 'lifestyle', 'fashion'],
      food: ['travel', 'lifestyle', 'cosme'],
      fashion: ['cosme', 'lifestyle', 'travel'],
      fitness: ['lifestyle', 'food', 'fashion'],
      lifestyle: ['cosme', 'food', 'fashion'],
      other: ['lifestyle', 'cosme', 'travel'],
    };
    const partners = [myCategory, ...cross[myCategory]];
    return partners.slice(0, 4).map((cat, i) => ({
      category: cat,
      reason: i === 0 ? `同ジャンルで濃いフォロワーを共有` : i === 3 ? '意外性で話題化が狙える' : 'クロスジャンルで新規層を獲得',
      exampleTopic: i === 0 ? `${CATEGORY_META[cat].label}の徹底比較` : `${CATEGORY_META[myCategory].label}×${CATEGORY_META[cat].label}企画`,
      exampleHandle: `@${cat}_creator_${i + 1}`,
      followerRange,
    }));
  }
}

// ─── コンポーネント ─────────────────────────────────────────────
interface Props {
  bg: IrisBackgroundDef | CustomIrisBackground;
  myHandle?: string;
}

type ViewMode = 'plan' | 'board';

export default function IrisCollabBoard({ bg, myHandle }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  const [myCategory, setMyCategory] = useState<CollabCategory | ''>(() => loadMyCategory());

  // 募集ボード state (旧機能)
  const [posts, setPosts] = useState<CollabPost[]>(loadPosts);
  const [filterCat, setFilterCat] = useState<CollabCategory | 'all'>('all');
  const [showNewPost, setShowNewPost] = useState(false);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [postForm, setPostForm] = useState({
    title: '', body: '', category: 'cosme' as CollabCategory,
    tags: '', location: '', dateRange: '', followerRange: '',
  });

  // コラボ計画 state (新機能)
  const [plans, setPlans] = useState<CollabPlan[]>(() => loadPlans());
  const [activeStage, setActiveStage] = useState<CollabStage>('candidate');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    partnerHandle: '', partnerCategory: 'cosme' as CollabCategory, topic: '', followerRange: '', notes: '',
  });

  // AI 推薦
  const [recommendations, setRecommendations] = useState<RecommendedPartner[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  // DM 下書きモーダル
  const [dmModalState, setDmModalState] = useState<{ partnerHandle: string; topic: string; category: CollabCategory } | null>(null);

  // 評価モーダル
  const [evalPlanId, setEvalPlanId] = useState<string | null>(null);

  // Agent
  const queue = useAgentTaskQueue();
  const [proposing, setProposing] = useState(false);

  const handle = myHandle || localStorage.getItem(MY_HANDLE_KEY) || '@you';

  // ─── 永続化 ──
  const updatePlans = useCallback((next: CollabPlan[]) => {
    setPlans(next); savePlans(next);
  }, []);
  const updatePosts = useCallback((next: CollabPost[]) => {
    setPosts(next); savePosts(next);
  }, []);

  // ─── AI 推薦取得 ──
  const fetchRecommendations = useCallback(async () => {
    if (!myCategory) {
      notifyInApp({ kind: 'info', title: '自分のジャンルを先に選んでください', body: '右上の「ジャンル」から選択' });
      return;
    }
    setRecLoading(true);
    try {
      const ig = loadIgProfile();
      const recs = await recommendCollabPartners(myCategory, ig);
      setRecommendations(recs);
      notifyInApp({ kind: 'success', title: `${recs.length} 件のコラボ候補を提案`, body: '気になる相手を「候補」に追加してください' });
    } catch {
      notifyInApp({ kind: 'warn', title: 'AI 推薦に失敗', body: 'ネットワークを確認してください' });
    } finally {
      setRecLoading(false);
    }
  }, [myCategory]);

  // ─── 候補を計画に追加 ──
  const addRecToPlans = useCallback((rec: RecommendedPartner) => {
    const newPlan: CollabPlan = {
      id: 'plan-' + Date.now().toString(36),
      partnerHandle: rec.exampleHandle,
      partnerCategory: rec.category,
      topic: rec.exampleTopic,
      stage: 'candidate',
      reason: rec.reason,
      followerRange: rec.followerRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePlans([newPlan, ...plans]);
    notifyInApp({ kind: 'success', title: '候補に追加しました', body: rec.exampleHandle });
  }, [plans, updatePlans]);

  // ─── 手動で計画追加 ──
  const submitPlan = useCallback(() => {
    if (!planForm.partnerHandle.trim() || !planForm.topic.trim()) {
      notifyInApp({ kind: 'warn', title: 'ハンドルと企画名は必須です' });
      return;
    }
    const newPlan: CollabPlan = {
      id: 'plan-' + Date.now().toString(36),
      partnerHandle: planForm.partnerHandle.trim().startsWith('@') ? planForm.partnerHandle.trim() : '@' + planForm.partnerHandle.trim(),
      partnerCategory: planForm.partnerCategory,
      topic: planForm.topic.trim(),
      stage: 'candidate',
      followerRange: planForm.followerRange || undefined,
      notes: planForm.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePlans([newPlan, ...plans]);
    setPlanForm({ partnerHandle: '', partnerCategory: 'cosme', topic: '', followerRange: '', notes: '' });
    setShowNewPlan(false);
  }, [planForm, plans, updatePlans]);

  // ─── ステージ移動 ──
  const moveStage = useCallback((id: string, next: CollabStage) => {
    updatePlans(plans.map(p => p.id === id ? { ...p, stage: next, updatedAt: new Date().toISOString() } : p));
  }, [plans, updatePlans]);

  const deletePlan = useCallback(async (id: string) => {
    if (!(await confirmAction({ title: 'この計画を削除しますか?', tone: 'danger', okLabel: '削除する' }))) return;
    updatePlans(plans.filter(p => p.id !== id));
  }, [plans, updatePlans]);

  // ─── 評価記録 ──
  const recordEvaluation = useCallback((id: string, evaluation: CollabEvaluation) => {
    updatePlans(plans.map(p => p.id === id ? { ...p, evaluation, updatedAt: new Date().toISOString() } : p));
    setEvalPlanId(null);
    notifyInApp({ kind: 'success', title: '評価を記録しました', body: '次回の参考になります' });
  }, [plans, updatePlans]);

  // ─── DM 下書き起動 ──
  const launchDmDraft = useCallback((plan: CollabPlan) => {
    setDmModalState({ partnerHandle: plan.partnerHandle, topic: plan.topic, category: plan.partnerCategory });
    // 連絡中に自動移動
    if (plan.stage === 'candidate') moveStage(plan.id, 'contacting');
  }, [moveStage]);

  // ─── AgentTaskQueue 委任 ──
  const proposeCollabPlan = useCallback(() => {
    setProposing(true);
    const candidates = plans.filter(p => p.stage === 'candidate').length;
    const contacting = plans.filter(p => p.stage === 'contacting').length;
    queue.propose({
      title: '今月コラボ 3 件を設定する計画',
      summary: `現状: 候補 ${candidates} 件 / 連絡中 ${contacting} 件。今月中に新規コラボを 3 件「確定」まで持っていく動きを、CMO と CSO が 1 枚にまとめます。`,
      why: 'コラボはフォロワー獲得の最短ルート。月 3 件を「確定」に動かすには、候補出し → DM → フォロー → 日程確定の 4 ステップを並列で回す必要がある。',
      expected: '今月のコラボ候補 10 件 + 各人への DM 文 + 連絡の優先順位を 1 枚に。',
      dueDays: 2,
      steps: [
        { cxo: 'CSO', label: '自分のジャンル/規模に合う候補を 10 名抽出 (重なる層 × 異なるアプローチ)' },
        { cxo: 'CMO', label: '優先 5 名への DM 案を 80 字でドラフト (トーン違い 3 種)' },
        { cxo: 'CSO', label: '返信があった場合の日程確定までの導線を整理' },
        { cxo: 'CMO', label: '完了時の共同投稿テンプレと相互タグ付け設計を提示' },
      ],
    });
    notifyInApp({ kind: 'success', title: '計画を CMO+CSO に委任しました', body: 'AgentTaskQueue で進捗が見えます' });
    setTimeout(() => setProposing(false), 600);
  }, [plans, queue]);

  // ─── 募集ボード処理 (旧) ──
  function addReaction(id: string, emoji: string) {
    updatePosts(posts.map(p => p.id === id ? { ...p, reactions: { ...p.reactions, [emoji]: (p.reactions[emoji] || 0) + 1 } } : p));
  }
  function sendChat(postId: string) {
    if (!chatInput.trim()) return;
    updatePosts(posts.map(p => p.id === postId ? {
      ...p,
      chats: [...p.chats, { id: Date.now().toString(), author: handle, text: chatInput.trim(), at: new Date().toISOString() }],
    } : p));
    setChatInput('');
  }
  function submitPost() {
    if (!postForm.title.trim() || !postForm.body.trim()) return;
    const post: CollabPost = {
      id: Date.now().toString(),
      authorHandle: handle,
      category: postForm.category,
      title: postForm.title.trim(),
      body: postForm.body.trim(),
      tags: postForm.tags.split(/[\s,]+/).filter(Boolean),
      location: postForm.location || undefined,
      dateRange: postForm.dateRange || undefined,
      followerRange: postForm.followerRange || undefined,
      reactions: {}, chats: [],
      createdAt: new Date().toISOString(),
    };
    updatePosts([post, ...posts]);
    setPostForm({ title: '', body: '', category: 'cosme', tags: '', location: '', dateRange: '', followerRange: '' });
    setShowNewPost(false);
  }

  const displayedPosts = useMemo(() => {
    const base = filterCat === 'all' ? posts : posts.filter(p => p.category === filterCat);
    return base.map(p => {
      const m = computeAiMatch(p, myCategory);
      return { ...p, aiMatchScore: p.aiMatchScore ?? m.score, aiMatchReason: p.aiMatchReason ?? m.reason };
    }).sort((a, b) => (b.aiMatchScore ?? 0) - (a.aiMatchScore ?? 0));
  }, [posts, filterCat, myCategory]);

  // ─── ステージ別件数 ──
  const stageCount = useMemo(() => {
    const map: Record<CollabStage, number> = { candidate: 0, contacting: 0, confirmed: 0, done: 0 };
    for (const p of plans) map[p.stage]++;
    return map;
  }, [plans]);

  const plansForStage = useMemo(
    () => plans.filter(p => p.stage === activeStage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [plans, activeStage],
  );

  // ─── 評価集計 (完了案件のみ) ──
  const evalStats = useMemo(() => {
    const done = plans.filter(p => p.stage === 'done' && p.evaluation);
    if (done.length === 0) return null;
    const avgEffect = done.reduce((s, p) => s + (p.evaluation!.effectScore || 0), 0) / done.length;
    const repeatRate = done.filter(p => p.evaluation!.wouldRepeat).length / done.length * 100;
    return { count: done.length, avgEffect: avgEffect.toFixed(1), repeatRate: Math.round(repeatRate) };
  }, [plans]);

  // ─── IG プロフィール (DM 下書き用) ──
  const igProfile: IgProfile = useMemo(() => {
    const real = loadIgProfile();
    if (real) return real;
    // フォールバック (擬似プロフィール)
    return {
      handle: handle.replace(/^@/, ''),
      followers: 5000, avgLikes: 200, avgComments: 12,
      topPostCategories: myCategory ? [CATEGORY_META[myCategory].label] : ['ライフスタイル'],
      bestPostTime: '土 21:00', saveRate: 3.5, storyViewRate: 28,
      audienceAge: [{ range: '18-24', pct: 35 }, { range: '25-34', pct: 45 }],
      audienceGender: { female: 80, male: 18, other: 2 },
      audienceTopCountries: [{ country: '日本', pct: 95 }],
      source: 'self',
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [handle, myCategory]);

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 20, padding: '1.25rem',
    boxShadow: '0 4px 20px rgba(31,26,46,0.07)',
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* ヘッダ */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 4 }}>
          COLLAB
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.6rem, 4vw, 2rem)', color: bg.ink, margin: 0 }}>
          一緒に、つくろう。
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: 4, lineHeight: 1.7 }}>
          AI がコラボ相手を提案 → DM 下書き → ステージ管理 → 完了後の評価まで、一連の流れを 1 か所で。
        </p>
      </div>

      <DelegateToAgentTeamBanner
        taskTitle="コラボ候補を CSO + CMO に探してもらう"
        suggestedCxos={['CSO', 'CMO']}
        why="伸びるアカウントは「正しい相手とのコラボ」で加速。AI 会社が候補と DM 文面まで作ります"
        expected="コラボ候補 5 件 + DM 下書き"
        brand="iris"
      />

      {/* モード切替 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999, width: 'fit-content' }}>
        {[
          { v: 'plan' as const, label: '計画ボード', count: plans.length },
          { v: 'board' as const, label: '募集ボード', count: posts.length },
        ].map(t => (
          <button key={t.v} onClick={() => setViewMode(t.v)}
            style={{
              padding: '0.55rem 1.2rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700,
              background: viewMode === t.v ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'transparent',
              color: viewMode === t.v ? '#fff' : bg.ink,
              border: 'none', cursor: 'pointer', minHeight: 44,
              boxShadow: viewMode === t.v ? `0 4px 12px ${bg.accent}55` : 'none',
            }}>
            {t.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* 自分のジャンル (共通) */}
      <div style={{ ...card, marginBottom: '1rem', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: bg.inkSoft, whiteSpace: 'nowrap' }}>自分のジャンル:</span>
        {(Object.keys(CATEGORY_META) as CollabCategory[]).map(c => (
          <button key={c} onClick={() => { const next = c === myCategory ? '' : c; setMyCategory(next); saveMyCategory(next); }}
            style={{
              padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.78rem',
              background: myCategory === c ? bg.accent : 'rgba(255,255,255,0.85)',
              color: myCategory === c ? '#fff' : bg.ink,
              border: `1px solid ${bg.cardBorder}`, cursor: 'pointer', fontWeight: 600,
              minHeight: 36,
            }}>
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {viewMode === 'plan' ? (
        <PlanBoard
          bg={bg}
          plans={plans}
          stageCount={stageCount}
          plansForStage={plansForStage}
          activeStage={activeStage}
          setActiveStage={setActiveStage}
          recommendations={recommendations}
          recLoading={recLoading}
          myCategory={myCategory}
          evalStats={evalStats}
          showNewPlan={showNewPlan}
          setShowNewPlan={setShowNewPlan}
          planForm={planForm}
          setPlanForm={setPlanForm}
          submitPlan={submitPlan}
          fetchRecommendations={fetchRecommendations}
          addRecToPlans={addRecToPlans}
          moveStage={moveStage}
          deletePlan={deletePlan}
          launchDmDraft={launchDmDraft}
          setEvalPlanId={setEvalPlanId}
          proposeCollabPlan={proposeCollabPlan}
          proposing={proposing}
        />
      ) : (
        <RecruitBoard
          bg={bg}
          posts={displayedPosts}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          showNewPost={showNewPost}
          setShowNewPost={setShowNewPost}
          postForm={postForm}
          setPostForm={setPostForm}
          submitPost={submitPost}
          addReaction={addReaction}
          openChat={openChat}
          setOpenChat={setOpenChat}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendChat={sendChat}
          myCategory={myCategory}
        />
      )}

      {/* DM 下書きモーダル */}
      <AnimatePresence>
        {dmModalState && (
          <Suspense fallback={null}>
            <IrisDmDraftModal
              igProfile={igProfile}
              deal={{
                brandName: dmModalState.partnerHandle,
                category: `${CATEGORY_META[dmModalState.category].label} コラボ`,
                requirements: `企画: ${dmModalState.topic}`,
                contactHandle: dmModalState.partnerHandle,
              }}
              onClose={() => setDmModalState(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 評価モーダル */}
      <AnimatePresence>
        {evalPlanId && (
          <EvaluationModal
            bg={bg}
            plan={plans.find(p => p.id === evalPlanId)!}
            onSave={(ev) => recordEvaluation(evalPlanId, ev)}
            onClose={() => setEvalPlanId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// コラボ計画ボード (kanban + 推薦)
// ============================================================
function PlanBoard(props: {
  bg: IrisBackgroundDef | CustomIrisBackground;
  plans: CollabPlan[];
  stageCount: Record<CollabStage, number>;
  plansForStage: CollabPlan[];
  activeStage: CollabStage;
  setActiveStage: (s: CollabStage) => void;
  recommendations: RecommendedPartner[];
  recLoading: boolean;
  myCategory: CollabCategory | '';
  evalStats: { count: number; avgEffect: string; repeatRate: number } | null;
  showNewPlan: boolean;
  setShowNewPlan: (v: boolean) => void;
  planForm: any;
  setPlanForm: (v: any) => void;
  submitPlan: () => void;
  fetchRecommendations: () => void;
  addRecToPlans: (r: RecommendedPartner) => void;
  moveStage: (id: string, next: CollabStage) => void;
  deletePlan: (id: string) => void;
  launchDmDraft: (p: CollabPlan) => void;
  setEvalPlanId: (id: string) => void;
  proposeCollabPlan: () => void;
  proposing: boolean;
}) {
  const {
    bg, stageCount, plansForStage, activeStage, setActiveStage,
    recommendations, recLoading, myCategory, evalStats,
    showNewPlan, setShowNewPlan, planForm, setPlanForm, submitPlan,
    fetchRecommendations, addRecToPlans,
    moveStage, deletePlan, launchDmDraft, setEvalPlanId,
    proposeCollabPlan, proposing,
  } = props;

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 16, padding: '1.1rem',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* 評価サマリー */}
      {evalStats && (
        <div style={{ ...card, background: `${bg.accent}10`, border: `1px solid ${bg.accent}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Star size={16} color={bg.accent} fill={bg.accent} />
            <span style={{ fontSize: '0.85rem', color: bg.ink }}>
              過去 <b>{evalStats.count}</b> 件のコラボ — 平均効果 <b>{evalStats.avgEffect}/5</b> ・「次回もやる」<b>{evalStats.repeatRate}%</b>
            </span>
          </div>
        </div>
      )}

      {/* アクションバー */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={fetchRecommendations} disabled={recLoading || !myCategory} style={btnPrimary(bg)}>
          <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {recLoading ? 'AI が考え中…' : 'AI コラボ候補を提案'}
        </button>
        <button onClick={() => setShowNewPlan(true)} style={btnSecondary(bg)}>
          <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          手動で追加
        </button>
        <button onClick={proposeCollabPlan} disabled={proposing} style={btnSecondary(bg)}>
          <ListChecks size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {proposing ? '委任中…' : 'CMO+CSO に委任'}
        </button>
      </div>

      {/* AI 推薦結果 */}
      {recommendations.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700, marginBottom: 10 }}>
            AI RECOMMENDATIONS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {recommendations.map((r, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{
                  padding: '0.9rem', borderRadius: 12,
                  background: 'rgba(255,255,255,0.7)',
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    background: `${CATEGORY_META[r.category].color}22`,
                    color: CATEGORY_META[r.category].color,
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '0.15rem 0.55rem', borderRadius: 999,
                  }}>
                    {CATEGORY_META[r.category].label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>{r.followerRange}</span>
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: bg.ink, marginBottom: 4 }}>{r.exampleTopic}</p>
                <p style={{ fontSize: '0.75rem', color: bg.inkSoft, lineHeight: 1.6, marginBottom: 8 }}>{r.reason}</p>
                <button onClick={() => addRecToPlans(r)}
                  style={{
                    width: '100%', padding: '0.5rem', borderRadius: 8,
                    background: bg.accent, color: '#fff', border: 'none',
                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', minHeight: 40,
                  }}>
                  + 候補に追加
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ステージ切替タブ (kanban の代わり: モバイル向き) */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {(Object.keys(STAGE_META) as CollabStage[]).map(s => (
          <button key={s} onClick={() => setActiveStage(s)}
            style={{
              padding: '0.6rem 1rem', borderRadius: 12, fontSize: '0.82rem', fontWeight: 700,
              background: activeStage === s ? STAGE_META[s].color : 'rgba(255,255,255,0.85)',
              color: activeStage === s ? '#fff' : bg.ink,
              border: `1px solid ${activeStage === s ? STAGE_META[s].color : bg.cardBorder}`,
              cursor: 'pointer', minHeight: 44, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
            {STAGE_META[s].label}
            <span style={{ marginLeft: 6, opacity: 0.8, fontSize: '0.75rem' }}>({stageCount[s]})</span>
          </button>
        ))}
      </div>

      {/* 現ステージの説明 */}
      <p style={{ fontSize: '0.78rem', color: bg.inkSoft, fontStyle: 'italic' }}>
        {STAGE_META[activeStage].hint}
      </p>

      {/* 計画リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plansForStage.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: bg.inkSoft, padding: '2.4rem 1rem' }}>
            <div style={{ marginBottom: 12, color: bg.inkSoft, opacity: 0.7 }} aria-hidden>
              {activeStage === 'candidate' ? <Sparkles size={44} strokeWidth={1.6} />
                : activeStage === 'contacting' ? <Send size={44} strokeWidth={1.6} />
                : activeStage === 'confirmed' ? <Star size={44} strokeWidth={1.6} />
                : <ListChecks size={44} strokeWidth={1.6} />}
            </div>
            <p style={{ fontSize: '0.95rem', color: bg.ink, fontWeight: 600 }}>
              {activeStage === 'candidate' && 'コラボ候補はまだいません'}
              {activeStage === 'contacting' && 'まだ連絡中の人はいません'}
              {activeStage === 'confirmed' && '確定したコラボはまだありません'}
              {activeStage === 'done' && 'まだ完了したコラボはありません'}
            </p>
            <p style={{ fontSize: '0.78rem', marginTop: 8, lineHeight: 1.6 }}>
              {activeStage === 'candidate' && (
                <>あなたのジャンルで伸びそうな相手を AI が探します。<br />「AI コラボ候補を提案」を押すと 5 人ずつ出てきます。</>
              )}
              {activeStage === 'contacting' && '候補から DM 下書きを送ると、ここに自動で移動します。返信が来たら次の段へ。'}
              {activeStage === 'confirmed' && '相手から OK が出たら「確定」へ動かしましょう。撮影日と内容を 1 枚にまとめられます。'}
              {activeStage === 'done' && '投稿が終わったら効果 (フォロワー増、いいね) を残すと、次回の判断材料になります。'}
            </p>
            {activeStage === 'candidate' && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                <button onClick={fetchRecommendations} disabled={recLoading || !myCategory} style={btnPrimary(bg)}>
                  <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  AI に候補を出させる
                </button>
                <button onClick={() => setShowNewPlan(true)} style={btnSecondary(bg)}>
                  <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  手動で追加
                </button>
              </div>
            )}
          </div>
        )}
        {plansForStage.map(plan => (
          <motion.div key={plan.id} layout
            style={{ ...card, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{
                background: `${CATEGORY_META[plan.partnerCategory].color}22`,
                color: CATEGORY_META[plan.partnerCategory].color,
                fontSize: '0.7rem', fontWeight: 700,
                padding: '0.15rem 0.55rem', borderRadius: 999,
              }}>
                {CATEGORY_META[plan.partnerCategory].label}
              </span>
              <span style={{ fontSize: '0.82rem', color: bg.ink, fontWeight: 600 }}>{plan.partnerHandle}</span>
              {plan.followerRange && <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{plan.followerRange}</span>}
            </div>
            <p style={{ fontSize: '0.95rem', color: bg.ink, fontWeight: 600, margin: '0 0 6px' }}>{plan.topic}</p>
            {plan.reason && (
              <p style={{ fontSize: '0.75rem', color: bg.accent, background: `${bg.accent}0d`, borderRadius: 8, padding: '0.35rem 0.6rem', marginBottom: 8 }}>
                {plan.reason}
              </p>
            )}
            {plan.notes && (
              <p style={{ fontSize: '0.75rem', color: bg.inkSoft, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{plan.notes}</p>
            )}
            {plan.evaluation && (
              <div style={{
                background: '#10B98115', border: '1px solid #10B98133',
                borderRadius: 10, padding: '0.5rem 0.7rem', marginBottom: 8,
                fontSize: '0.75rem', color: bg.ink,
              }}>
                効果 {'★'.repeat(plan.evaluation.effectScore)}{'☆'.repeat(5 - plan.evaluation.effectScore)} ・
                次回も {plan.evaluation.wouldRepeat ? 'やる' : 'やらない'}
                {plan.evaluation.note && ` — ${plan.evaluation.note}`}
              </div>
            )}
            {/* アクション */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {(plan.stage === 'candidate' || plan.stage === 'contacting') && (
                <button onClick={() => launchDmDraft(plan)} style={btnSmallPrimary(bg)}>
                  <MessageCircle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  AI DM 下書き
                </button>
              )}
              {/* ステージ遷移 */}
              {plan.stage !== 'done' && (
                <button onClick={() => {
                  const next: CollabStage = plan.stage === 'candidate' ? 'contacting'
                    : plan.stage === 'contacting' ? 'confirmed' : 'done';
                  moveStage(plan.id, next);
                }} style={btnSmall(bg)}>
                  <ChevronRight size={12} style={{ marginRight: 2, verticalAlign: -1 }} />
                  {plan.stage === 'candidate' && '連絡中へ'}
                  {plan.stage === 'contacting' && '確定へ'}
                  {plan.stage === 'confirmed' && '完了へ'}
                </button>
              )}
              {plan.stage === 'done' && !plan.evaluation && (
                <button onClick={() => setEvalPlanId(plan.id)} style={btnSmallPrimary(bg)}>
                  <Star size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  効果を評価
                </button>
              )}
              {plan.stage === 'done' && plan.evaluation && (
                <button onClick={() => setEvalPlanId(plan.id)} style={btnSmall(bg)}>
                  <Star size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  評価を更新
                </button>
              )}
              <button onClick={() => deletePlan(plan.id)} style={{ ...btnSmall(bg), marginLeft: 'auto', color: '#EF4444', borderColor: '#EF444433' }}>
                削除
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 新規追加モーダル */}
      <AnimatePresence>
        {showNewPlan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNewPlan(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,15,30,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', maxWidth: 480, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto' }}>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: '#1F1A2E', margin: '0 0 1rem' }}>
                コラボ計画を追加
              </h3>
              <FieldWrap label="相手のハンドル *">
                <input value={planForm.partnerHandle} onChange={e => setPlanForm({ ...planForm, partnerHandle: e.target.value })}
                  placeholder="@hana_cosme" style={modalInput()} />
              </FieldWrap>
              <FieldWrap label="相手のジャンル">
                <select value={planForm.partnerCategory} onChange={e => setPlanForm({ ...planForm, partnerCategory: e.target.value as CollabCategory })}
                  style={modalInput()}>
                  {(Object.keys(CATEGORY_META) as CollabCategory[]).map(c =>
                    <option key={c} value={c}>{CATEGORY_META[c].label}</option>,
                  )}
                </select>
              </FieldWrap>
              <FieldWrap label="企画 *">
                <input value={planForm.topic} onChange={e => setPlanForm({ ...planForm, topic: e.target.value })}
                  placeholder="夏コスメ夜更かしレビュー" style={modalInput()} />
              </FieldWrap>
              <FieldWrap label="相手のフォロワー規模">
                <input value={planForm.followerRange} onChange={e => setPlanForm({ ...planForm, followerRange: e.target.value })}
                  placeholder="5K〜20K" style={modalInput()} />
              </FieldWrap>
              <FieldWrap label="メモ">
                <textarea value={planForm.notes} onChange={e => setPlanForm({ ...planForm, notes: e.target.value })}
                  rows={3} style={{ ...modalInput(), resize: 'vertical', borderRadius: 12 }} />
              </FieldWrap>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={submitPlan} style={{ flex: 1, padding: '0.75rem', borderRadius: 999, background: bg.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, minHeight: 44 }}>
                  追加
                </button>
                <button onClick={() => setShowNewPlan(false)} style={{ padding: '0.75rem 1.25rem', borderRadius: 999, background: 'rgba(0,0,0,0.05)', border: '1px solid #E0D4EC', cursor: 'pointer', minHeight: 44 }}>
                  キャンセル
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 評価モーダル
// ============================================================
function EvaluationModal({ bg, plan, onSave, onClose }: {
  bg: IrisBackgroundDef | CustomIrisBackground;
  plan: CollabPlan;
  onSave: (e: CollabEvaluation) => void;
  onClose: () => void;
}) {
  const [score, setScore] = useState<1 | 2 | 3 | 4 | 5>(plan.evaluation?.effectScore || 4);
  const [wouldRepeat, setWouldRepeat] = useState(plan.evaluation?.wouldRepeat ?? true);
  const [note, setNote] = useState(plan.evaluation?.note || '');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,15,30,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', maxWidth: 420, width: '100%' }}>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: '#1F1A2E', margin: '0 0 0.5rem' }}>
          コラボの効果は?
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#5A4570', marginBottom: 16 }}>
          {plan.partnerHandle} × {plan.topic}
        </p>

        {/* 効果スコア */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.75rem', color: '#5A4570', fontWeight: 700, marginBottom: 8 }}>効果 (5 が最高)</p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button key={n} onClick={() => setScore(n)}
                style={{
                  flex: 1, padding: '0.9rem 0', borderRadius: 12,
                  background: n <= score ? bg.accent : 'rgba(0,0,0,0.05)',
                  color: n <= score ? '#fff' : '#5A4570',
                  border: 'none', cursor: 'pointer', fontSize: '1.3rem',
                  minHeight: 56,
                }}>
                ★
              </button>
            ))}
          </div>
        </div>

        {/* 次回もやる */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.75rem', color: '#5A4570', fontWeight: 700, marginBottom: 8 }}>次回もこの相手とやりたい?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setWouldRepeat(true)}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: 12, minHeight: 44,
                background: wouldRepeat ? '#10B981' : 'rgba(0,0,0,0.05)',
                color: wouldRepeat ? '#fff' : '#5A4570',
                border: 'none', cursor: 'pointer', fontWeight: 700,
              }}>
              はい
            </button>
            <button onClick={() => setWouldRepeat(false)}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: 12, minHeight: 44,
                background: !wouldRepeat ? '#9CA3AF' : 'rgba(0,0,0,0.05)',
                color: !wouldRepeat ? '#fff' : '#5A4570',
                border: 'none', cursor: 'pointer', fontWeight: 700,
              }}>
              いいえ
            </button>
          </div>
        </div>

        {/* メモ */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.75rem', color: '#5A4570', fontWeight: 700, marginBottom: 6 }}>一言メモ (任意)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="フォロワー +120 / 反応良かったポイント など"
            style={{ width: '100%', padding: '0.6rem', borderRadius: 12, border: '1px solid #E0D4EC', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: IRIS_FONTS.body }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSave({ effectScore: score, wouldRepeat, note: note.trim() || undefined, recordedAt: new Date().toISOString() })}
            style={{ flex: 1, padding: '0.75rem', borderRadius: 999, background: bg.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, minHeight: 44 }}>
            保存
          </button>
          <button onClick={onClose}
            style={{ padding: '0.75rem 1.25rem', borderRadius: 999, background: 'rgba(0,0,0,0.05)', border: '1px solid #E0D4EC', cursor: 'pointer', minHeight: 44 }}>
            戻る
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// 募集ボード (旧機能を内包)
// ============================================================
function RecruitBoard(props: {
  bg: IrisBackgroundDef | CustomIrisBackground;
  posts: CollabPost[];
  filterCat: CollabCategory | 'all';
  setFilterCat: (c: CollabCategory | 'all') => void;
  showNewPost: boolean;
  setShowNewPost: (v: boolean) => void;
  postForm: any;
  setPostForm: (v: any) => void;
  submitPost: () => void;
  addReaction: (id: string, e: string) => void;
  openChat: string | null;
  setOpenChat: (s: string | null) => void;
  chatInput: string;
  setChatInput: (s: string) => void;
  sendChat: (postId: string) => void;
  myCategory: CollabCategory | '';
}) {
  const {
    bg, posts, filterCat, setFilterCat,
    showNewPost, setShowNewPost, postForm, setPostForm, submitPost,
    addReaction, openChat, setOpenChat, chatInput, setChatInput, sendChat,
    myCategory,
  } = props;

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 16, padding: '1.1rem',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* フィルタ + 投稿ボタン */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'cosme', 'travel', 'food', 'fashion', 'fitness', 'lifestyle', 'other'] as const).map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: 999, fontSize: '0.78rem',
              background: filterCat === c ? bg.accent : 'rgba(255,255,255,0.85)',
              color: filterCat === c ? '#fff' : bg.ink,
              border: `1px solid ${bg.cardBorder}`, cursor: 'pointer', fontWeight: 600,
              minHeight: 36,
            }}>
            {c === 'all' ? 'すべて' : CATEGORY_META[c].label}
          </button>
        ))}
        <button onClick={() => setShowNewPost(true)}
          style={{
            marginLeft: 'auto', padding: '0.55rem 1.2rem', borderRadius: 999,
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            minHeight: 44,
          }}>
          + 募集を出す
        </button>
      </div>

      {myCategory && (
        <div style={{ ...card, padding: '0.65rem 1rem', background: `${bg.accent}10`, border: `1px solid ${bg.accent}33` }}>
          <span style={{ fontSize: '0.78rem', color: bg.accent, fontWeight: 700 }}>
            AI が「もしかして合うかも」と判断した順に並んでいます
          </span>
        </div>
      )}

      {/* 投稿リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.map(post => {
          const meta = CATEGORY_META[post.category];
          const isOpen = openChat === post.id;
          return (
            <motion.div key={post.id} layout style={{ ...card, position: 'relative' }}>
              {post.aiMatchScore != null && (
                <div style={{
                  position: 'absolute', top: '0.85rem', right: '0.85rem',
                  background: post.aiMatchScore >= 80 ? `${bg.accent}22` : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${post.aiMatchScore >= 80 ? bg.accent : bg.cardBorder}`,
                  borderRadius: 999, padding: '0.2rem 0.6rem',
                  fontSize: '0.7rem', fontWeight: 700,
                  color: post.aiMatchScore >= 80 ? bg.accent : bg.inkSoft,
                }}>
                  {post.aiMatchScore}%
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  background: `${meta.color}18`, color: meta.color,
                  border: `1px solid ${meta.color}33`, borderRadius: 999,
                  padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700,
                }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>{post.authorHandle}</span>
                {post.location && <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{post.location}</span>}
                {post.dateRange && <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{post.dateRange}</span>}
                {post.followerRange && <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{post.followerRange}</span>}
              </div>
              <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.05rem', color: bg.ink, margin: '0 0 0.4rem', paddingRight: '4rem' }}>
                {post.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.65, margin: '0 0 0.65rem', whiteSpace: 'pre-wrap' }}>
                {post.body}
              </p>
              {post.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {post.tags.map(t => (
                    <span key={t} style={{ fontSize: '0.7rem', color: bg.accent, background: `${bg.accent}10`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{t}</span>
                  ))}
                </div>
              )}
              {post.aiMatchReason && post.aiMatchScore && post.aiMatchScore >= 70 && (
                <p style={{ fontSize: '0.72rem', color: bg.accent, background: `${bg.accent}0d`, borderRadius: 8, padding: '0.35rem 0.6rem', marginBottom: 8 }}>
                  {post.aiMatchReason}
                </p>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {['👍', '🔥', '💛', '🤝'].map(e => (
                  <button key={e} onClick={() => addReaction(post.id, e)}
                    style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}`, borderRadius: 999, padding: '0.3rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', minHeight: 36 }}>
                    {e} {post.reactions[e] || ''}
                  </button>
                ))}
                <button onClick={() => setOpenChat(isOpen ? null : post.id)}
                  style={{
                    marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700,
                    background: isOpen ? bg.accent : 'rgba(255,255,255,0.85)',
                    color: isOpen ? '#fff' : bg.ink,
                    border: `1px solid ${isOpen ? bg.accent : bg.cardBorder}`, cursor: 'pointer', minHeight: 36,
                  }}>
                  チャット {post.chats.length > 0 ? `(${post.chats.length})` : ''}
                </button>
              </div>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}>
                    <div style={{ marginTop: 10, borderTop: `1px solid ${bg.cardBorder}`, paddingTop: 10 }}>
                      {post.chats.length === 0 && (
                        <p style={{ fontSize: '0.78rem', color: bg.inkSoft, textAlign: 'center', padding: '0.4rem 0', lineHeight: 1.7 }}>まだメッセージはありません。<br />下の入力欄に書くと、この相手とのやりとりがここに残ります。</p>
                      )}
                      {post.chats.map(c => (
                        <div key={c.id} style={{ marginBottom: 5 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.accent }}>{c.author} </span>
                          <span style={{ fontSize: '0.8rem', color: bg.ink }}>{c.text}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendChat(post.id)}
                          placeholder="メッセージを送る…"
                          style={{
                            flex: 1, padding: '0.55rem 0.85rem', borderRadius: 999, fontSize: '16px',
                            border: `1px solid ${bg.cardBorder}`, background: 'rgba(255,255,255,0.9)',
                            color: bg.ink, outline: 'none',
                          }} />
                        <button onClick={() => sendChat(post.id)}
                          style={{ padding: '0.5rem 0.9rem', borderRadius: 999, background: bg.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', minHeight: 40 }}>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* 新規投稿モーダル */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNewPost(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,15,30,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', maxWidth: 520, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto' }}>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: '#1F1A2E', margin: '0 0 1rem' }}>
                コラボ募集を出す
              </h3>
              {[
                { label: 'タイトル *', key: 'title', placeholder: '一緒にコスメレビューしたい！', type: 'text' },
                { label: '詳細 *', key: 'body', placeholder: '企画内容・希望する相手のジャンルなど', type: 'textarea' },
                { label: 'タグ (スペース区切り)', key: 'tags', placeholder: '#コスメ #旅 #コラボ', type: 'text' },
                { label: '場所', key: 'location', placeholder: '東京・沖縄 etc.', type: 'text' },
                { label: '時期', key: 'dateRange', placeholder: '2026年7月', type: 'text' },
                { label: 'フォロワー規模', key: 'followerRange', placeholder: '5K〜30K', type: 'text' },
              ].map(f => (
                <FieldWrap key={f.key} label={f.label}>
                  {f.type === 'textarea'
                    ? <textarea value={postForm[f.key]} onChange={e => setPostForm({ ...postForm, [f.key]: e.target.value })}
                        placeholder={f.placeholder} rows={4}
                        style={{ ...modalInput(), resize: 'vertical', borderRadius: 12 }} />
                    : <input value={postForm[f.key]} onChange={e => setPostForm({ ...postForm, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        style={modalInput()} />
                  }
                </FieldWrap>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.72rem', color: '#5A4570', fontWeight: 700, display: 'block', marginBottom: 4 }}>カテゴリ</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(CATEGORY_META) as CollabCategory[]).map(c => (
                    <button key={c} onClick={() => setPostForm({ ...postForm, category: c })}
                      style={{
                        padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.75rem',
                        background: postForm.category === c ? bg.accent : 'rgba(0,0,0,0.04)',
                        color: postForm.category === c ? '#fff' : '#1F1A2E',
                        border: `1px solid ${postForm.category === c ? bg.accent : '#E0D4EC'}`,
                        cursor: 'pointer', fontWeight: 600, minHeight: 36,
                      }}>
                      {CATEGORY_META[c].label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={submitPost}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: 999, background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, minHeight: 44 }}>
                  投稿する
                </button>
                <button onClick={() => setShowNewPost(false)}
                  style={{ padding: '0.75rem 1.25rem', borderRadius: 999, background: 'rgba(0,0,0,0.05)', border: '1px solid #E0D4EC', cursor: 'pointer', minHeight: 44 }}>
                  キャンセル
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────
function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: '0.72rem', color: '#5A4570', fontWeight: 700, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function modalInput(): React.CSSProperties {
  return {
    width: '100%', padding: '0.6rem 0.85rem', borderRadius: 999,
    border: '1px solid #E0D4EC', fontSize: '16px', boxSizing: 'border-box',
    fontFamily: IRIS_FONTS.body, background: '#fff', color: '#1F1A2E',
  };
}

function btnPrimary(bg: IrisBackgroundDef | CustomIrisBackground): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.85rem', boxShadow: `0 6px 18px ${bg.accent}44`,
    fontFamily: IRIS_FONTS.body, minHeight: 44,
  };
}

function btnSecondary(bg: IrisBackgroundDef | CustomIrisBackground): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
    padding: '0.65rem 1.2rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: IRIS_FONTS.body, minHeight: 44,
  };
}

function btnSmall(bg: IrisBackgroundDef | CustomIrisBackground): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 8,
    padding: '0.4rem 0.75rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.75rem', minHeight: 36,
  };
}

function btnSmallPrimary(bg: IrisBackgroundDef | CustomIrisBackground): React.CSSProperties {
  return {
    background: bg.accent, color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '0.4rem 0.75rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.75rem', minHeight: 36,
  };
}
