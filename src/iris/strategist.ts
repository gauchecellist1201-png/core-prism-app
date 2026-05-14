// ============================================================
// IRIS — Strategist (投稿実績分析 + 改善 + 次の提案 + 30日プラン)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType, MediaKit, PlatformMetrics } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

const KEY_POSTS = 'core_iris_posthistory_v1';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

/** 投稿実績 (1 投稿) */
export interface PostHistoryItem {
  id: string;
  postedAt: string;        // ISO 日時
  platform: Platform;
  contentType: ContentType;
  /** タイトル / 概要 */
  title: string;
  /** 本文 (任意) */
  caption?: string;
  /** ハッシュタグ */
  tags?: string[];
  /** ジャンル / トピック (例: コスメ、旅、ライフスタイル) */
  topic?: string;
  /** 数字 */
  metrics: PlatformMetrics;
  /** タイアップなら brand */
  brand?: string;
  /** 投稿 URL */
  url?: string;
  /** 自分のメモ (撮影での気づき等) */
  notes?: string;
}

function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
}

export function usePostHistory() {
  const [posts, setPosts] = useState<PostHistoryItem[]>(() => load(KEY_POSTS, []));
  useEffect(() => save(KEY_POSTS, posts), [posts]);

  const add = useCallback((p: Omit<PostHistoryItem, 'id'>): PostHistoryItem => {
    const created: PostHistoryItem = { ...p, id: uuidv4() };
    setPosts(prev => [created, ...prev].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()));
    return created;
  }, []);
  const update = useCallback((id: string, patch: Partial<PostHistoryItem>) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);
  const remove = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  }, []);

  return { posts, add, update, remove };
}

// ─── 投稿パフォーマンス分析 ─────────────────
export interface PerformanceAnalysis {
  /** トップ投稿 (上位 3-5) */
  topPosts: { id: string; title: string; whyItWorked: string }[];
  /** 苦戦投稿 (下位 3) */
  underPosts: { id: string; title: string; whyItStruggled: string }[];
  /** 伸びパターン (時間帯・コンテンツ系統・ハッシュタグ・尺) */
  patterns: { factor: string; insight: string; impact: 'high' | 'medium' | 'low' }[];
  /** 全体の傾向サマリ */
  summary: string;
  /** 即実行できる改善ポイント 3 つ */
  quickWins: string[];
  /** 30 日後にどこまで伸ばせるか */
  growthForecast: string;
}

export async function analyzePerformance(opts: {
  settings: AppSettings;
  posts: PostHistoryItem[];
  mediaKit?: MediaKit;
}): Promise<PerformanceAnalysis> {
  const apiKey = getApiKey(opts.settings);

  const sys = `あなたは「インフルエンサーマーケティングのアナリスト + ブランドストラテジスト」です。
投稿実績を分析して、伸びた要因・苦戦要因・パターンを抽出します。

返答は JSON のみ:
{
  "topPosts": [{ "id": "...", "title": "...", "whyItWorked": "..." }],
  "underPosts": [{ "id": "...", "title": "...", "whyItStruggled": "..." }],
  "patterns": [{ "factor": "時間帯/トピック/形式/ハッシュタグ等", "insight": "具体的な気づき", "impact": "high|medium|low" }],
  "summary": "全体的にどういう傾向があるか (3-5行)",
  "quickWins": ["即実行できる改善 3 つ"],
  "growthForecast": "30日継続するとどう伸びるか"
}

## 分析の視点
- 平均ER との比較で各投稿のパフォーマンスを評価
- 投稿時間帯 (朝/昼/夜)、曜日
- トピックジャンル (コスメ・旅・食・ライフ等)
- コンテンツ形式 (Reel / Post / Story)
- 尺 (動画) / 文字量 (キャプション)
- ハッシュタグの効率
- ブランド案件 vs 自前

${toneInstruction(opts.settings.aiTone)}`;

  const formatPost = (p: PostHistoryItem) => {
    const m = p.metrics;
    return `- [${p.id.slice(0, 6)}] ${new Date(p.postedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} | ${PLATFORM_META[p.platform].label} ${CONTENT_TYPE_META[p.contentType]} | "${p.title}"${p.topic ? ` (${p.topic})` : ''}${p.brand ? ` PR: ${p.brand}` : ''}\n  metrics: reach ${m.reach || '?'}, impressions ${m.impressions || '?'}, ER ${m.engagementRate || '?'}%, likes ${m.likes || '?'}, comments ${m.comments || '?'}, saves ${m.saves || '?'}, shares ${m.shares || '?'}\n  tags: ${(p.tags || []).join(' ')}${p.notes ? `\n  notes: ${p.notes}` : ''}`;
  };

  const userText = `## 私のメディアキット
${opts.mediaKit ? `フォロワー: ${JSON.stringify(opts.mediaKit.followers || {})}\n平均ER: ${JSON.stringify(opts.mediaKit.avgEngagementRate || {})}\nオーディエンス: ${opts.mediaKit.audienceProfile || ''}` : '(未設定)'}

## 投稿履歴 (新しい順、最大 30 件)
${opts.posts.slice(0, 30).map(formatPost).join('\n\n')}

これらを分析して、JSON で返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `分析APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      topPosts: parsed.topPosts || [],
      underPosts: parsed.underPosts || [],
      patterns: parsed.patterns || [],
      summary: parsed.summary || '',
      quickWins: parsed.quickWins || [],
      growthForecast: parsed.growthForecast || '',
    };
  } catch {
    return { topPosts: [], underPosts: [], patterns: [], summary: text, quickWins: [], growthForecast: '' };
  }
}

// ─── 単一投稿フィードバック ────────────────
export async function feedbackPost(opts: {
  settings: AppSettings;
  post: PostHistoryItem;
  mediaKit?: MediaKit;
}): Promise<{ verdict: string; goodPoints: string[]; improvements: string[]; nextVariation: string }> {
  const apiKey = getApiKey(opts.settings);

  const sys = `あなたは「投稿の壁打ち相手」。1 投稿を見て、よかった点と改善点と「次に試す変化」を返します。
返答は JSON のみ:
{
  "verdict": "1行サマリ",
  "goodPoints": ["..."],
  "improvements": ["..."],
  "nextVariation": "次のバリエーションでこう変えてみよう"
}

${toneInstruction(opts.settings.aiTone)}`;

  const m = opts.post.metrics;
  const userText = `## 投稿
${opts.post.title}
${opts.post.caption || ''}
タグ: ${(opts.post.tags || []).join(' ')}
プラットフォーム: ${PLATFORM_META[opts.post.platform].label} / ${CONTENT_TYPE_META[opts.post.contentType]}
${opts.post.brand ? `PR: ${opts.post.brand}` : ''}

## 数字
リーチ ${m.reach || '?'}, インプ ${m.impressions || '?'}, ER ${m.engagementRate || '?'}%, いいね ${m.likes || '?'}, コメント ${m.comments || '?'}, 保存 ${m.saves || '?'}, シェア ${m.shares || '?'}

## メディアキット
${opts.mediaKit ? `平均ER: ${JSON.stringify(opts.mediaKit.avgEngagementRate || {})}` : ''}

この投稿、フィードバックお願い。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `FB APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m2 = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m2 ? m2[0] : text);
  } catch {
    return { verdict: text.slice(0, 100), goodPoints: [], improvements: [], nextVariation: '' };
  }
}

// ─── 次の投稿提案 ─────────────────────────
export interface NextPostSuggestion {
  title: string;
  hook: string;
  contentType: ContentType;
  platform: Platform;
  bestTimeJST: string;       // 例: 火曜 21:00
  topic: string;
  rationale: string;         // なぜ今これか
  brief: string;             // 撮影ブリーフ (3-5行)
  hashtagsHint: string[];
}

export async function suggestNextPosts(opts: {
  settings: AppSettings;
  posts: PostHistoryItem[];
  mediaKit?: MediaKit;
  count?: number;             // デフォ 3
}): Promise<NextPostSuggestion[]> {
  const apiKey = getApiKey(opts.settings);

  const sys = `あなたは「インフルエンサーの専属プロデューサー」。過去実績を見て、次に出すべき投稿を ${opts.count || 3} 本提案します。
返答は JSON 配列のみ:
[
  {
    "title": "コンセプト",
    "hook": "冒頭の引きフレーズ",
    "contentType": "reel|story|post|short|longform|tweet|live|article",
    "platform": "instagram|tiktok|youtube|x|threads|note|multi",
    "bestTimeJST": "日付/曜日 + 時間 (JST)",
    "topic": "コスメ/旅 etc",
    "rationale": "なぜ今これか (実績の◯◯が伸びてるから等)",
    "brief": "撮影ブリーフ 3-5 行",
    "hashtagsHint": ["#tag"]
  }
]

## ルール
- 過去で最も伸びたパターンの「亜種」と、新しいチャレンジを混ぜる
- 投稿時間は曜日 + 時間まで具体的に
- bestTimeJST は今日以降の直近 7-10 日以内
- 全部「同じネタの焼き直し」にならないように

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 実績要約
直近 ${opts.posts.length} 件の投稿。新しい順:
${opts.posts.slice(0, 20).map(p => {
  const m = p.metrics;
  return `- ${new Date(p.postedAt).toLocaleDateString('ja-JP')} ${PLATFORM_META[p.platform].label} ${CONTENT_TYPE_META[p.contentType]}: "${p.title}" (リーチ ${m.reach || '?'}, ER ${m.engagementRate || '?'}%, いいね ${m.likes || '?'}) ${p.topic ? `[${p.topic}]` : ''}${p.brand ? ` PR:${p.brand}` : ''}`;
}).join('\n')}

## メディアキット
${opts.mediaKit ? JSON.stringify({
  followers: opts.mediaKit.followers,
  avgER: opts.mediaKit.avgEngagementRate,
  audience: opts.mediaKit.audienceProfile,
  brandValues: opts.mediaKit.brandValues,
}, null, 2) : '(未設定)'}

次の ${opts.count || 3} 本、提案してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `提案APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\[[\s\S]*\]/);
    return JSON.parse(m ? m[0] : text);
  } catch { return []; }
}

// ─── 30 日ストーリーアーク (シリーズ) 提案 ──
export interface StoryArc {
  conceptName: string;        // 「30日メイク変身」など
  conceptDescription: string;
  weeks: {
    weekNum: number;
    theme: string;
    posts: { day: string; type: ContentType; title: string; purpose: string }[];
  }[];
  culmination: string;        // ゴール (フォロワー +○、PR 案件 +○など)
}

export async function generateStoryArc(opts: {
  settings: AppSettings;
  goal: string;               // 「フォロワー+5000」「コラボ案件3件獲得」等
  mediaKit?: MediaKit;
  posts?: PostHistoryItem[];
}): Promise<StoryArc> {
  const apiKey = getApiKey(opts.settings);

  const sys = `あなたは「インフルエンサーのプロデューサー兼脚本家」。
30 日 = 4 週で展開する「ストーリーアーク (シリーズ)」を設計します。

返答は JSON のみ:
{
  "conceptName": "シリーズ名",
  "conceptDescription": "コンセプト説明 (3-5行)",
  "weeks": [
    {
      "weekNum": 1,
      "theme": "週のテーマ",
      "posts": [
        { "day": "Mon", "type": "reel|post|story|...", "title": "投稿タイトル", "purpose": "この投稿で何を達成するか" }
      ]
    }
  ],
  "culmination": "30日後のゴール"
}

## ルール
- 4週で起承転結 (週1: 引き、週2: 深掘り、週3: 山場、週4: 共有・回収)
- 1週で 3-5 投稿 (合計 12-20 投稿)
- 投稿同士に物語性を持たせる
- 「保存される」「シェアされる」投稿を週1本以上必ず入れる

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 30日でやり遂げたいこと (ゴール)
${opts.goal}

## メディアキット
${opts.mediaKit ? JSON.stringify({
  followers: opts.mediaKit.followers,
  avgER: opts.mediaKit.avgEngagementRate,
  audience: opts.mediaKit.audienceProfile,
}, null, 2) : '(未設定)'}

${opts.posts && opts.posts.length > 0 ? `## 直近の投稿傾向
${opts.posts.slice(0, 10).map(p => `- ${PLATFORM_META[p.platform].label}: "${p.title}" ER ${p.metrics.engagementRate || '?'}%`).join('\n')}` : ''}

30 日のストーリーアーク、設計してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 4500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `アーク生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return { conceptName: 'カスタムアーク', conceptDescription: text, weeks: [], culmination: '' };
  }
}
