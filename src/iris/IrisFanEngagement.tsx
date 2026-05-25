// ============================================================
// IRIS — ファンエンゲージメント管理 (Day 2 大幅アップグレード)
//
// アップグレード点:
//  1. ファン取り込み 3 ルート
//     - 手動 / DM スクショ Vision / CSV インポート
//  2. 絆スコア (0-100) 自動計算 — fanBondScore.ts に切り出し
//  3. 「今週連絡すべき 5 人」AI 提案 (1 日 1 回キャッシュ)
//  4. 個別「お礼 DM」生成 (押し売り禁止 + 個別質問 1 つ)
//  5. AgentTaskQueue へ「今週のファンエンゲージメント計画」を propose
//  6. 絆レベル UP アニメ (30 / 60 / 90 で発火)
//  7. モバイル UX 改善 — 縦カード / safe-area / タップ拡大
// ============================================================
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, UserPlus, Camera, Upload, Sparkles, MessageCircleHeart,
  Trash2, ListChecks, Image as ImageIcon, FileText, Send,
} from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { copyText } from '../lib/clipboard';
import { toneInstruction } from '../lib/aiTone';
import { notifyInApp } from '../lib/inAppNotify';
import { v4 as uuidv4 } from 'uuid';
import EmptyInvite from './EmptyInvite';
import {
  calcFanBondScore, pointsToNextLevel, BOND_LEVEL_META,
  type FanBondLevel,
} from './fanBondScore';
import {
  captureFansFromScreenshots, parseFanCsv,
  type CapturedFanCandidate,
} from './fanCapture';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import DelegateToAgentTeamBanner from '../components/DelegateToAgentTeamBanner';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
}

export type FanTag = 'スーパーファン' | '長期ファン' | '新規' | '個人的友人';

const TAG_COLORS: Record<FanTag, { bg: string; text: string }> = {
  'スーパーファン': { bg: '#E1306C22', text: '#E1306C' },
  '長期ファン':     { bg: '#833AB422', text: '#833AB4' },
  '新規':           { bg: '#FCB04522', text: '#B07020' },
  '個人的友人':     { bg: '#34C75922', text: '#1A8040' },
};

export interface FanContact {
  id: string;
  name: string;
  handle: string;        // @username
  platform: string;      // Instagram / TikTok / X 等
  /** 関係開始 YYYY-MM */
  relationSince?: string;
  tag: FanTag;
  topics: string[];      // 話題のスナップ
  notes: string;
  /** DM / コメント 記録 */
  interactions: FanInteraction[];
  createdAt: string;
  updatedAt: string;
  /** 最後に観測した bond level (アニメ発火制御) */
  lastBondLevel?: FanBondLevel;
}

export interface FanInteraction {
  id: string;
  type: 'dm' | 'comment' | 'reply';
  content: string;
  date: string;          // YYYY-MM-DD
  myReply?: string;
}

const FAN_STORAGE_KEY = 'iris_fans_v1';
const WEEKLY_CACHE_KEY = 'iris_fan_weekly5_v1';

function loadFans(): FanContact[] {
  try { const r = localStorage.getItem(FAN_STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveFans(data: FanContact[]) {
  try { localStorage.setItem(FAN_STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}

interface WeeklyFiveCache {
  date: string;          // YYYY-MM-DD (発火日)
  items: WeeklyFiveItem[];
}
interface WeeklyFiveItem {
  handle: string;
  name: string;
  reason: string;        // 30 字以内
  whisper: string;       // 1 行の声かけ案
}

function loadWeekly(): WeeklyFiveCache | null {
  try { const r = localStorage.getItem(WEEKLY_CACHE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveWeekly(d: WeeklyFiveCache) {
  try { localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify(d)); } catch { /* */ }
}

const ALL_TAGS: FanTag[] = ['スーパーファン', '長期ファン', '新規', '個人的友人'];

/** ───────────────────────────────────────────────────────── */

export default function IrisFanEngagement({ bg, settings }: Props) {
  const [fans, setFans] = useState<FanContact[]>(() => loadFans());
  const [selectedFan, setSelectedFan] = useState<FanContact | null>(null);
  const [showAddFan, setShowAddFan] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [shotFiles, setShotFiles] = useState<File[]>([]);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotCandidates, setShotCandidates] = useState<CapturedFanCandidate[]>([]);
  const [shotPicked, setShotPicked] = useState<Set<number>>(new Set());
  const [shotErr, setShotErr] = useState<string | null>(null);

  const [top10, setTop10] = useState<{ name: string; reason: string }[] | null>(null);
  const [top10Loading, setTop10Loading] = useState(false);
  const [replyTemplate, setReplyTemplate] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFanId, setReplyFanId] = useState<string | null>(null);
  const [thanksDm, setThanksDm] = useState('');
  const [thanksLoading, setThanksLoading] = useState(false);
  const [thanksFanId, setThanksFanId] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<WeeklyFiveCache | null>(() => loadWeekly());
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // 絆レベル UP アニメ (per-fan)
  const [bondLevelUp, setBondLevelUp] = useState<{ name: string; level: FanBondLevel } | null>(null);

  // AgentTaskQueue
  const queue = useAgentTaskQueue();
  const [proposing, setProposing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fanForm, setFanForm] = useState({
    name: '', handle: '', platform: 'Instagram',
    relationSince: '', tag: 'スーパーファン' as FanTag,
    topics: '', notes: '',
  });
  const [interactionForm, setInteractionForm] = useState({
    type: 'dm' as FanInteraction['type'],
    content: '', date: new Date().toISOString().slice(0, 10),
  });

  // ─── 絆スコアキャッシュ ────────────────────
  const bondMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcFanBondScore>>();
    for (const f of fans) m.set(f.id, calcFanBondScore(f));
    return m;
  }, [fans]);

  // ─── 起動時: 今週の 5 人キャッシュをチェック ────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (weekly && weekly.date === today) return;
    // 期限切れなら捨てる (= 開いた瞬間に再生成しない / ユーザーがボタンを押したら作る)
    if (weekly && weekly.date !== today) setWeekly(null);
  }, [weekly]);

  // ─── 絆レベル UP 監視 ──────────────────────
  useEffect(() => {
    let triggered: { name: string; level: FanBondLevel } | null = null;
    const updated: FanContact[] = [];
    let changed = false;
    for (const f of fans) {
      const cur = bondMap.get(f.id);
      if (!cur) { updated.push(f); continue; }
      const prevLevel = (f.lastBondLevel ?? 0) as FanBondLevel;
      if (cur.level > prevLevel) {
        if (!triggered) triggered = { name: f.name, level: cur.level };
        updated.push({ ...f, lastBondLevel: cur.level });
        changed = true;
      } else if (cur.level !== prevLevel) {
        updated.push({ ...f, lastBondLevel: cur.level });
        changed = true;
      } else {
        updated.push(f);
      }
    }
    if (changed) saveAndSet(updated, /* silent */ true);
    if (triggered) {
      setBondLevelUp(triggered);
      const t = setTimeout(() => setBondLevelUp(null), 3200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondMap]);

  const saveAndSet = (next: FanContact[], silent = false) => {
    setFans(next);
    saveFans(next);
    if (!silent && selectedFan) {
      const updatedSel = next.find(f => f.id === selectedFan.id) ?? null;
      setSelectedFan(updatedSel);
    }
  };

  // ─── ファン追加 (手動) ────────────────────
  const addFan = () => {
    if (!fanForm.name.trim()) return;
    const now = new Date().toISOString();
    const fan: FanContact = {
      id: uuidv4(),
      name: fanForm.name.trim(),
      handle: fanForm.handle.trim(),
      platform: fanForm.platform.trim(),
      relationSince: fanForm.relationSince || undefined,
      tag: fanForm.tag,
      topics: fanForm.topics.split(',').map(t => t.trim()).filter(Boolean),
      notes: fanForm.notes.trim(),
      interactions: [],
      createdAt: now,
      updatedAt: now,
    };
    saveAndSet([fan, ...fans]);
    setFanForm({ name: '', handle: '', platform: 'Instagram', relationSince: '', tag: 'スーパーファン', topics: '', notes: '' });
    setShowAddFan(false);
    notifyInApp({ kind: 'success', title: `${fan.name} を追加しました`, body: '右下のカードから DM 記録 / お礼 DM 生成ができます' });
  };

  // ─── ファン追加 (スクショ抽出) ────────────
  const onShotFilesPicked = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, 3);
    setShotFiles(arr);
    setShotCandidates([]);
    setShotPicked(new Set());
    setShotErr(null);
  };
  const runExtractFans = async () => {
    if (shotFiles.length === 0) return;
    setShotBusy(true); setShotErr(null);
    try {
      const r = await captureFansFromScreenshots(shotFiles);
      if (!r.ok) { setShotErr(`${r.message} — ${r.recovery}`); return; }
      setShotCandidates(r.fans);
      setShotPicked(new Set(r.fans.map((_, i) => i))); // デフォルト全選択
      notifyInApp({ kind: 'success', title: `${r.fans.length} 人を読み取りました`, body: 'チェックを外したい人は外してから「追加」ボタン' });
    } catch (e: any) {
      setShotErr(e?.message || '読み取り失敗');
    } finally {
      setShotBusy(false);
    }
  };
  const importPickedFans = () => {
    const now = new Date().toISOString();
    const existingHandles = new Set(fans.map(f => f.handle.toLowerCase()));
    const newFans: FanContact[] = [];
    shotCandidates.forEach((c, i) => {
      if (!shotPicked.has(i)) return;
      const h = (c.handle || '').toLowerCase();
      if (existingHandles.has(h)) return;
      newFans.push({
        id: uuidv4(),
        name: c.name,
        handle: c.handle,
        platform: c.platform,
        tag: c.tagGuess || '新規',
        topics: [],
        notes: c.lastMessage ? `最近の DM: ${c.lastMessage}` : '',
        interactions: c.lastMessage ? [{
          id: uuidv4(), type: 'dm' as const, content: c.lastMessage,
          date: new Date().toISOString().slice(0, 10),
        }] : [],
        createdAt: now,
        updatedAt: now,
      });
    });
    if (newFans.length === 0) {
      notifyInApp({ kind: 'info', title: '追加できる人がいませんでした', body: '既に登録済みかも' });
    } else {
      saveAndSet([...newFans, ...fans]);
      notifyInApp({ kind: 'success', title: `${newFans.length} 人を追加しました`, body: 'タグや話題は後から育てられます' });
    }
    setShowScreenshot(false);
    setShotFiles([]); setShotCandidates([]); setShotPicked(new Set()); setShotErr(null);
  };

  // ─── ファン追加 (CSV) ─────────────────────
  const importCsv = () => {
    const rows = parseFanCsv(csvText);
    if (rows.length === 0) {
      notifyInApp({ kind: 'warn', title: 'CSV を読み取れませんでした', body: '列: handle, name, tags, lastContact' });
      return;
    }
    const now = new Date().toISOString();
    const existingHandles = new Set(fans.map(f => f.handle.toLowerCase()));
    const newFans: FanContact[] = [];
    for (const r of rows) {
      if (existingHandles.has(r.handle.toLowerCase())) continue;
      const tagFromCsv = r.tags.find(t => (ALL_TAGS as string[]).includes(t)) as FanTag | undefined;
      newFans.push({
        id: uuidv4(),
        name: r.name,
        handle: r.handle,
        platform: 'Instagram',
        tag: tagFromCsv || '新規',
        topics: r.tags.filter(t => !(ALL_TAGS as string[]).includes(t)),
        notes: r.lastContact ? `最終接触: ${r.lastContact}` : '',
        interactions: r.lastContact ? [{
          id: uuidv4(), type: 'dm' as const, content: '(CSV から取込)',
          date: /^\d{4}-\d{2}-\d{2}$/.test(r.lastContact) ? r.lastContact : new Date().toISOString().slice(0, 10),
        }] : [],
        createdAt: now,
        updatedAt: now,
      });
    }
    if (newFans.length === 0) {
      notifyInApp({ kind: 'info', title: '追加できる人がいませんでした', body: '全員すでに登録済み' });
    } else {
      saveAndSet([...newFans, ...fans]);
      notifyInApp({ kind: 'success', title: `${newFans.length} 人を CSV から追加`, body: 'スコアは自動で計算されます' });
    }
    setShowCsv(false); setCsvText('');
  };

  // ─── インタラクション追加 ──────────────────────────────
  const addInteraction = () => {
    if (!selectedFan || !interactionForm.content.trim()) return;
    const interaction: FanInteraction = {
      id: uuidv4(),
      type: interactionForm.type,
      content: interactionForm.content.trim(),
      date: interactionForm.date,
    };
    const updated = fans.map(f =>
      f.id === selectedFan.id
        ? { ...f, interactions: [interaction, ...f.interactions], updatedAt: new Date().toISOString() }
        : f
    );
    saveAndSet(updated);
    setInteractionForm({ type: 'dm', content: '', date: new Date().toISOString().slice(0, 10) });
    setShowAddInteraction(false);
  };

  const updateFanTag = (fanId: string, tag: FanTag) => {
    const updated = fans.map(f => f.id === fanId ? { ...f, tag, updatedAt: new Date().toISOString() } : f);
    saveAndSet(updated);
  };

  const deleteFan = (fanId: string) => {
    saveAndSet(fans.filter(f => f.id !== fanId));
    if (selectedFan?.id === fanId) setSelectedFan(null);
  };

  // ─── AI: TOP10 抽出 (既存) ─────────────────
  const extractTop10 = useCallback(async () => {
    if (fans.length === 0) { notifyInApp({ kind: 'info', title: 'ファンデータがありません', body: '先にファンを追加してください。' }); return; }
    setTop10Loading(true); setTop10(null);
    try {
      const fanSummary = fans.slice(0, 50).map(f => {
        const b = bondMap.get(f.id);
        return {
          name: f.name, handle: f.handle, tag: f.tag, topics: f.topics,
          interactionCount: f.interactions.length,
          lastInteraction: f.interactions[0]?.date ?? '—',
          bondScore: b?.total ?? 0,
          notes: f.notes,
        };
      });
      const sys = `あなたはインフルエンサーのファン関係管理を支援する AI。
${toneInstruction()}
返答は JSON のみ:
{ "top10": [{ "name": "ファン名", "reason": "選定理由 (30文字以内)" }, ...] }
最大 10 件。bondScore と関係性、話題の豊富さを総合判断。`;

      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 1000,
            system: sys,
            messages: [{ role: 'user', content: `以下のファンリストから高エンゲージメント TOP10 を選んでください:\n${JSON.stringify(fanSummary, null, 2)}` }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });
      const text = data.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      setTop10(Array.isArray(parsed.top10) ? parsed.top10 : []);
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'AI 分析に失敗しました', body: String(e) });
    } finally {
      setTop10Loading(false);
    }
  }, [fans, settings, bondMap]);

  // ─── AI: 今週連絡すべき 5 人 (1 日 1 回キャッシュ) ─────────
  const buildWeekly5 = useCallback(async (force = false) => {
    if (fans.length === 0) {
      notifyInApp({ kind: 'info', title: 'ファンデータがありません', body: '先に何人か登録してください' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (!force && weekly && weekly.date === today) return;

    setWeeklyLoading(true);
    try {
      const candidates = fans.slice(0, 60).map(f => {
        const b = bondMap.get(f.id);
        const lastDate = f.interactions[0]?.date || f.createdAt.slice(0, 10);
        const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
        return {
          handle: f.handle, name: f.name, tag: f.tag,
          topics: f.topics, notes: f.notes,
          bondScore: b?.total ?? 0,
          interactionCount: f.interactions.length,
          daysSinceLast: days,
          lastMessage: f.interactions[0]?.content || '',
        };
      });

      const sys = `あなたはインフルエンサーの専属マネージャー「Iris」です。
${toneInstruction()}
ファンとの関係を温め続けるために、今週連絡すべき 5 人を選んでください。

選定基準 (優先度順):
1. 絆スコアが高いのに連絡が空いている (= 寂しがってる可能性)
2. 直近で温度の高いやり取りがあって、もう一押しで深まる関係
3. 「個人的友人」「スーパーファン」を最低 1 人ずつ含める
4. 新規ファンも 1 人入れて、関係を芽吹かせる

返答は JSON のみ:
{
  "five": [
    { "handle": "@xxx", "name": "名前", "reason": "選定理由 30 字以内", "whisper": "声かけの一言案 60 字以内" },
    ...
  ]
}`;

      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 1200,
            system: sys,
            messages: [{ role: 'user', content: `候補:\n${JSON.stringify(candidates, null, 2)}\n\n今週連絡すべき 5 人と「声かけの一言」を選んでください。` }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });
      const text = data.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      const items: WeeklyFiveItem[] = Array.isArray(parsed.five)
        ? parsed.five.slice(0, 5).map((x: any) => ({
            handle: String(x.handle || '@unknown'),
            name: String(x.name || x.handle || '—'),
            reason: String(x.reason || '').slice(0, 60),
            whisper: String(x.whisper || '').slice(0, 120),
          }))
        : [];
      const cache: WeeklyFiveCache = { date: today, items };
      setWeekly(cache);
      saveWeekly(cache);
      notifyInApp({ kind: 'success', title: '今週の 5 人を選びました', body: 'カードからメッセージをコピーできます' });
    } catch (e) {
      notifyInApp({ kind: 'warn', title: '今週の 5 人を作れませんでした', body: String(e) });
    } finally {
      setWeeklyLoading(false);
    }
  }, [fans, settings, bondMap, weekly]);

  // ─── AI: 返信テンプレ (既存) ────────────────
  const generateReply = useCallback(async (fan: FanContact) => {
    setReplyFanId(fan.id); setReplyLoading(true); setReplyTemplate('');
    try {
      const lastMsg = fan.interactions[0]?.content ?? '(最近のやり取りなし)';
      const sys = `あなたはインフルエンサーの専属 AI マネージャー「Iris」。
ファンへの返信テンプレを生成してください。
${toneInstruction()}
- 返信は 2〜3 文、自然で温かみがある
- ファン名・話題・関係を反映させる
- 返答は返信テキストのみ`;
      const prompt = `ファン名: ${fan.name} (@${fan.handle})
タグ: ${fan.tag}
話題: ${fan.topics.join(', ') || 'なし'}
最近のメッセージ: 「${lastMsg}」`;
      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 400,
            system: sys,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });
      setReplyTemplate(data.content?.[0]?.text ?? '');
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'テンプレ生成に失敗しました', body: String(e) });
    } finally {
      setReplyLoading(false);
    }
  }, [settings]);

  // ─── AI: お礼 DM 生成 (新規) ────────────────
  const generateThanksDm = useCallback(async (fan: FanContact) => {
    setThanksFanId(fan.id); setThanksLoading(true); setThanksDm('');
    try {
      const recent = fan.interactions.slice(0, 3).map(i => `- (${i.date}) ${i.content}`).join('\n') || '(やり取り記録なし)';
      const b = bondMap.get(fan.id);
      const sys = `あなたはインフルエンサー本人として、ファンへの「お礼 DM」を書きます。
${toneInstruction()}

# 守ること
- 全体 3〜4 文 (短く心に届く)
- 冒頭で最近の感謝を 1 つ具体的に
- 個別質問を 1 つ自然に混ぜる (相手のことに興味を示す)
- **押し売り絶対禁止** (商品 / 物販 / リンク / フォロー / 拡散依頼すべて NG)
- 絵文字 0〜2 個まで、自然な範囲で
- 「テンプレ感」を出さない。相手の名前と固有エピソードを必ず織り込む

# 返答
お礼 DM の本文のみ (前置きや説明文は不要)`;

      const prompt = `# 宛先
- 名前: ${fan.name}
- ハンドル: ${fan.handle}
- タグ: ${fan.tag}
- 関係: ${fan.relationSince ? fan.relationSince + ' から' : '不明'}
- 絆スコア: ${b?.total ?? 0} / 100
- 話題: ${fan.topics.join(', ') || 'なし'}
- メモ: ${fan.notes || 'なし'}

# 最近のやり取り
${recent}

このファンへの「お礼 DM」を書いてください。`;

      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 600,
            system: sys,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });
      setThanksDm((data.content?.[0]?.text ?? '').trim());
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'お礼 DM 生成に失敗しました', body: String(e) });
    } finally {
      setThanksLoading(false);
    }
  }, [settings, bondMap]);

  // ─── AgentTaskQueue へ「今週のエンゲージメント計画」を propose ─────
  const proposeWeeklyPlan = useCallback(() => {
    if (fans.length === 0) {
      notifyInApp({ kind: 'info', title: 'ファンが 0 人', body: '先に何人か追加してから委任できます' });
      return;
    }
    setProposing(true);
    const total = fans.length;
    const lv3 = fans.filter(f => (bondMap.get(f.id)?.level ?? 0) === 3).length;
    const lv0 = fans.filter(f => (bondMap.get(f.id)?.level ?? 0) === 0).length;

    queue.propose({
      title: '今週のファンエンゲージメント計画',
      summary: `登録ファン ${total} 人 (親友 ${lv3} / 出会いたて ${lv0}) を対象に、CMO と CDS が「今週どの 5 人にどう声をかけるか」をひとつの計画にまとめます。`,
      why: '関係を温め続けないと、フォロワーは "数字" になってしまう。週に 1 度の小さな声かけが、長期的なエンゲージメント率を支える。',
      expected: '今週連絡すべき 5 人 + 個別の声かけ案 + 来月の関係深化テーマを 1 枚に。',
      dueDays: 1,
      steps: [
        { cxo: 'CDS', label: '絆スコアと最終接触からトップ 5 を抽出し、潜在価値を採点' },
        { cxo: 'CMO', label: '5 人それぞれに合った「声かけ DM」を 60 字でドラフト' },
        { cxo: 'CDS', label: '「育てたい関係」を 1 つ選び、来月の重点テーマを 1 文で提案' },
      ],
    });
    notifyInApp({ kind: 'success', title: '計画を CMO + CDS に委任しました', body: 'AgentTaskQueue で進捗が見えます' });
    setTimeout(() => setProposing(false), 600);
  }, [fans, bondMap, queue]);

  // ─── タグ別グループ + 絆スコア降順ソート ──────
  const grouped = useMemo(() => {
    const map = new Map<FanTag, FanContact[]>();
    for (const t of ALL_TAGS) map.set(t, []);
    const sorted = [...fans].sort((a, b) => (bondMap.get(b.id)?.total ?? 0) - (bondMap.get(a.id)?.total ?? 0));
    for (const f of sorted) map.get(f.tag)?.push(f);
    return map;
  }, [fans, bondMap]);

  // ─── render helpers ─────────────────────────
  return (
    <div style={{ display: 'grid', gap: '1.25rem', fontFamily: IRIS_FONTS.body, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>FAN CARE</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          ファンとの絆を育てる。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          DM・コメントを記録して、Iris が大切な人をそっと教えてくれます。
        </p>
      </div>

      <DelegateToAgentTeamBanner
        taskTitle="今週連絡すべきファンの案を CMO に出してもらう"
        suggestedCxos={['CMO', 'CDS']}
        why="絆スコアと最近の動きを見て「今声をかけるべき 5 人」を AI 会社が選びます"
        expected="5 人リスト + 個別お礼 DM 下書き"
        brand="iris"
      />

      {/* 「今週連絡すべき 5 人」 */}
      <WeeklyFiveCard
        bg={bg}
        cache={weekly}
        loading={weeklyLoading}
        onGenerate={() => buildWeekly5(true)}
        fansCount={fans.length}
      />

      {/* アクション 3 ルート + AI */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button onClick={() => setShowAddFan(v => !v)} style={btnPrimary(bg)}>
          <UserPlus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          手動で追加
        </button>
        <button onClick={() => setShowScreenshot(v => !v)} style={btnSecondary(bg)}>
          <Camera size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          DM スクショから
        </button>
        <button onClick={() => setShowCsv(v => !v)} style={btnSecondary(bg)}>
          <Upload size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          CSV インポート
        </button>
        <button onClick={extractTop10} disabled={top10Loading} style={btnSecondary(bg)}>
          <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {top10Loading ? '分析中…' : 'TOP10 AI'}
        </button>
        <button onClick={proposeWeeklyPlan} disabled={proposing} style={btnSecondary(bg)}>
          <ListChecks size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {proposing ? '委任中…' : 'CMO+CDS に委任'}
        </button>
      </div>

      {/* ── 取込モーダル群 ────────────────────── */}
      <AnimatePresence>
        {showAddFan && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '1rem' }}>ADD FAN</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <FField label="名前"><input value={fanForm.name} onChange={e => setFanForm(f => ({ ...f, name: e.target.value }))} placeholder="さくらちゃん" style={inp(bg)} /></FField>
              <FField label="ハンドル (@)"><input value={fanForm.handle} onChange={e => setFanForm(f => ({ ...f, handle: e.target.value }))} placeholder="@sakura_fan" style={inp(bg)} /></FField>
              <FField label="プラットフォーム"><input value={fanForm.platform} onChange={e => setFanForm(f => ({ ...f, platform: e.target.value }))} placeholder="Instagram" style={inp(bg)} /></FField>
              <FField label="関係開始 (YYYY-MM)"><input value={fanForm.relationSince} onChange={e => setFanForm(f => ({ ...f, relationSince: e.target.value }))} placeholder="2024-03" style={inp(bg)} /></FField>
              <FField label="タグ">
                <select value={fanForm.tag} onChange={e => setFanForm(f => ({ ...f, tag: e.target.value as FanTag }))} style={inp(bg)}>
                  {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FField>
              <FField label="話題 (カンマ区切り)"><input value={fanForm.topics} onChange={e => setFanForm(f => ({ ...f, topics: e.target.value }))} placeholder="スキンケア好き, 毎回コメント" style={inp(bg)} /></FField>
              <FField label="メモ" style={{ gridColumn: '1 / -1' }}><input value={fanForm.notes} onChange={e => setFanForm(f => ({ ...f, notes: e.target.value }))} placeholder="特記事項など" style={inp(bg)} /></FField>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddFan(false)} style={btnCancel(bg)}>キャンセル</button>
              <button onClick={addFan} style={{ ...btnPrimary(bg), padding: '0.6rem 1.5rem' }}>保存</button>
            </div>
          </motion.div>
        )}

        {showScreenshot && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.6rem' }}>DM 受信箱スクショから取り込む</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.7, marginBottom: '0.8rem' }}>
              Instagram / TikTok / X の <strong>DM 一覧画面</strong> のスクショを 1〜3 枚送ると、差出人を一括で読み取って追加できます。
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => onShotFilesPicked(e.target.files)} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
              <button onClick={() => fileInputRef.current?.click()} style={btnSecondary(bg)}>
                <ImageIcon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                スクショを選ぶ ({shotFiles.length}/3)
              </button>
              <button
                onClick={runExtractFans}
                disabled={shotFiles.length === 0 || shotBusy}
                style={{ ...btnPrimary(bg), opacity: shotFiles.length === 0 || shotBusy ? 0.5 : 1 }}
              >
                {shotBusy ? '読み取り中…' : 'AI で読み取る'}
              </button>
            </div>
            {shotErr && (
              <div style={{ padding: '0.7rem 0.9rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: '0.78rem', marginBottom: '0.7rem' }}>
                {shotErr}
              </div>
            )}
            {shotCandidates.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft }}>取り込む人をチェック ({shotPicked.size}/{shotCandidates.length})</p>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 4 }}>
                  {shotCandidates.map((c, i) => {
                    const checked = shotPicked.has(i);
                    return (
                      <label key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0.55rem 0.75rem',
                        background: checked ? `${bg.accent}10` : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${checked ? bg.accent : bg.cardBorder}`,
                        borderRadius: 10, cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setShotPicked(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: bg.ink }}>{c.name} <span style={{ fontWeight: 400, color: bg.inkSoft }}>· {c.handle}</span></p>
                          {c.lastMessage && (
                            <p style={{ fontSize: '0.72rem', color: bg.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.lastMessage}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: '0.65rem', color: bg.accent, fontWeight: 700 }}>{c.tagGuess || '新規'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowScreenshot(false); setShotFiles([]); setShotCandidates([]); setShotPicked(new Set()); setShotErr(null); }} style={btnCancel(bg)}>閉じる</button>
              {shotCandidates.length > 0 && (
                <button onClick={importPickedFans} disabled={shotPicked.size === 0} style={{ ...btnPrimary(bg), opacity: shotPicked.size === 0 ? 0.5 : 1 }}>
                  {shotPicked.size} 人を追加
                </button>
              )}
            </div>
          </motion.div>
        )}

        {showCsv && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.5rem' }}>CSV インポート</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, lineHeight: 1.7, marginBottom: '0.6rem' }}>
              1 行 1 ファン。列順: <code>handle, name, tags, lastContact</code> (tags はセミコロン区切り可)。1 行目は見出しでも OK。
            </p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={7}
              placeholder={`handle,name,tags,lastContact
@sakura_fan,さくら,スーパーファン;スキンケア,2026-05-12
@yuki,ゆき,長期ファン,2026-05-08`}
              style={{ ...inp(bg), fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCsv(false); setCsvText(''); }} style={btnCancel(bg)}>キャンセル</button>
              <button onClick={importCsv} disabled={!csvText.trim()} style={{ ...btnPrimary(bg), opacity: csvText.trim() ? 1 : 0.5 }}>
                <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                取り込む
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP10 結果 (既存) */}
      <AnimatePresence>
        {top10 && top10.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '1.25rem', background: `${bg.accent}08`, border: `1px solid ${bg.cardBorder}`, borderRadius: 16, textAlign: 'center', color: bg.inkSoft, fontSize: '0.85rem' }}>
            該当するファンが見つかりませんでした。ファンとのやり取りを記録してから、もう一度お試しください。
          </motion.div>
        )}
        {top10 && top10.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '1.25rem', background: `linear-gradient(135deg, ${bg.accent}12, ${bg.accent}06)`, border: `1px solid ${bg.accent}30`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.75rem' }}>
              高エンゲージメント TOP10
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {top10.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.7)',
                  borderRadius: 10, border: `1px solid ${bg.cardBorder}`,
                }}>
                  <span style={{ fontWeight: 800, color: bg.accent, minWidth: 22, fontSize: '0.9rem' }}>#{i + 1}</span>
                  <div>
                    <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.85rem' }}>{t.name}</p>
                    <p style={{ fontSize: '0.75rem', color: bg.inkSoft, lineHeight: 1.5 }}>{t.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* タグ別ファンリスト */}
      {fans.length === 0 ? (
        <EmptyInvite
          bg={bg}
          icon={Heart}
          title="ファンリストは空です"
          description={
            <>
              DM スクショ 1 枚で、ファンを名前付きで取り込めます。<br />
              いつも応援してくれる人を覚えておくと、Iris が「いま声をかけたい上位 5 人」を毎週そっと教えてくれます。
            </>
          }
          primaryAction={{
            label: '最初のファンを追加',
            onClick: () => setShowAddFan(true),
            icon: UserPlus,
          }}
          hint="@ハンドルと一言メモだけで OK。DM 一覧スクショから一括取込もできます"
        />
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {ALL_TAGS.map(tag => {
            const list = grouped.get(tag) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={tag}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
                  <span style={{
                    background: TAG_COLORS[tag].bg, color: TAG_COLORS[tag].text,
                    fontSize: '0.7rem', fontWeight: 700, borderRadius: 999,
                    padding: '0.2rem 0.75rem',
                  }}>{tag}</span>
                  <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{list.length} 人</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
                  {list.map(fan => (
                    <FanCard
                      key={fan.id} fan={fan} bg={bg}
                      bond={bondMap.get(fan.id)}
                      isSelected={selectedFan?.id === fan.id}
                      onSelect={() => setSelectedFan(selectedFan?.id === fan.id ? null : fan)}
                      onDelete={() => deleteFan(fan.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 選択ファン詳細パネル */}
      <AnimatePresence>
        {selectedFan && (
          <motion.div
            key={selectedFan.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.accent}40`, borderRadius: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600 }}>FAN DETAIL</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500 }}>
                  {selectedFan.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft }}>
                  {selectedFan.handle} · {selectedFan.platform}
                  {selectedFan.relationSince && ` · ${selectedFan.relationSince}〜`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => generateThanksDm(selectedFan)} disabled={thanksLoading && thanksFanId === selectedFan.id} style={btnPrimary(bg)}>
                  <MessageCircleHeart size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {thanksLoading && thanksFanId === selectedFan.id ? '生成中…' : 'お礼 DM を作る'}
                </button>
                <button onClick={() => generateReply(selectedFan)} disabled={replyLoading && replyFanId === selectedFan.id} style={btnSecondary(bg)}>
                  {replyLoading && replyFanId === selectedFan.id ? '生成中…' : '返信テンプレ'}
                </button>
              </div>
            </div>

            {/* 絆スコア可視化 */}
            <FanBondMeter fan={selectedFan} bg={bg} />

            {/* 誠意タグ変更 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.8rem 0', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: bg.inkSoft, fontWeight: 600 }}>タグ:</span>
              {ALL_TAGS.map(t => (
                <button key={t} onClick={() => updateFanTag(selectedFan.id, t)} style={{
                  background: selectedFan.tag === t ? TAG_COLORS[t].bg : 'transparent',
                  color: TAG_COLORS[t].text,
                  border: `1px solid ${TAG_COLORS[t].text}40`,
                  borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.25rem 0.7rem', cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                  minHeight: 28,
                }}>{t}</button>
              ))}
            </div>

            {/* 話題タグ */}
            {selectedFan.topics.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                {selectedFan.topics.map(t => (
                  <span key={t} style={{ background: `${bg.accent}15`, color: bg.accent, borderRadius: 999, fontSize: '0.72rem', padding: '0.2rem 0.65rem', fontWeight: 600 }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* お礼 DM */}
            {thanksDm && thanksFanId === selectedFan.id && (
              <div style={{ marginBottom: '0.9rem', padding: '1rem', background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}06)`, border: `1px solid ${bg.accent}40`, borderRadius: 12 }}>
                <p style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 700, marginBottom: 6, letterSpacing: '0.18em' }}>
                  <MessageCircleHeart size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                  お礼 DM (押し売り禁止 / 個別質問 1 つ)
                </p>
                <p style={{ fontSize: '0.9rem', color: bg.ink, lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: IRIS_FONTS.serif }}>{thanksDm}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => copyText(thanksDm, 'お礼 DM')} style={{ background: bg.accent, color: '#fff', border: 'none', borderRadius: 999, padding: '0.45rem 1.1rem', fontSize: '0.78rem', cursor: 'pointer', fontFamily: IRIS_FONTS.body, fontWeight: 700 }}>
                    <Send size={11} style={{ verticalAlign: -1, marginRight: 4 }} /> コピーして送る
                  </button>
                  <button onClick={() => generateThanksDm(selectedFan)} style={{ background: 'none', border: `1px solid ${bg.accent}40`, color: bg.accent, borderRadius: 999, padding: '0.45rem 1rem', fontSize: '0.78rem', cursor: 'pointer', fontFamily: IRIS_FONTS.body }}>
                    別案を作る
                  </button>
                </div>
              </div>
            )}

            {/* 返信テンプレ */}
            {replyTemplate && replyFanId === selectedFan.id && (
              <div style={{ marginBottom: '0.9rem', padding: '0.95rem', background: `${bg.accent}0d`, border: `1px solid ${bg.accent}25`, borderRadius: 10 }}>
                <p style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>AI 返信テンプレ</p>
                <p style={{ fontSize: '0.875rem', color: bg.ink, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{replyTemplate}</p>
                <button onClick={() => copyText(replyTemplate, '返信文')} style={{ marginTop: 8, background: 'none', border: `1px solid ${bg.accent}40`, color: bg.accent, borderRadius: 999, padding: '0.3rem 0.85rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: IRIS_FONTS.body }}>
                  コピー
                </button>
              </div>
            )}

            {/* インタラクション追加 */}
            <div style={{ marginBottom: '0.75rem' }}>
              <button onClick={() => setShowAddInteraction(v => !v)} style={{ background: 'none', border: `1px solid ${bg.cardBorder}`, color: bg.accent, borderRadius: 999, padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, fontFamily: IRIS_FONTS.body, minHeight: 36 }}>
                + DM / コメントを記録
              </button>
            </div>

            {showAddInteraction && (
              <div style={{ marginBottom: '1rem', padding: '0.9rem', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: `1px solid ${bg.cardBorder}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
                  <FField label="種類">
                    <select value={interactionForm.type} onChange={e => setInteractionForm(f => ({ ...f, type: e.target.value as FanInteraction['type'] }))} style={inp(bg)}>
                      <option value="dm">DM</option>
                      <option value="comment">コメント</option>
                      <option value="reply">返信</option>
                    </select>
                  </FField>
                  <FField label="日付">
                    <input type="date" value={interactionForm.date} onChange={e => setInteractionForm(f => ({ ...f, date: e.target.value }))} style={inp(bg)} />
                  </FField>
                  <FField label="内容" style={{ gridColumn: '1 / -1' }}>
                    <input value={interactionForm.content} onChange={e => setInteractionForm(f => ({ ...f, content: e.target.value }))} placeholder="メッセージ内容" style={inp(bg)} />
                  </FField>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddInteraction(false)} style={btnCancel(bg)}>キャンセル</button>
                  <button onClick={addInteraction} style={{ ...btnPrimary(bg), padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}>保存</button>
                </div>
              </div>
            )}

            {/* インタラクション履歴 */}
            {selectedFan.interactions.length > 0 ? (
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {selectedFan.interactions.map(i => (
                  <div key={i.id} style={{
                    padding: '0.6rem 0.8rem', borderRadius: 10,
                    background: 'rgba(255,255,255,0.55)', border: `1px solid ${bg.cardBorder}`,
                    display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 700, minWidth: 46 }}>
                      {i.type === 'dm' ? 'DM' : i.type === 'comment' ? 'コメント' : '返信'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: bg.inkSoft, minWidth: 72 }}>{i.date}</span>
                    <span style={{ fontSize: '0.85rem', color: bg.ink, flex: 1, lineHeight: 1.6 }}>{i.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: bg.inkSoft, fontStyle: 'italic', fontFamily: IRIS_FONTS.serif }}>
                まだやり取りが記録されていません。
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 絆レベル UP アニメ (per-fan) */}
      <AnimatePresence>
        {bondLevelUp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2000 }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 16 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              style={{
                padding: '1.5rem 1.85rem', background: '#fff', borderRadius: 22,
                boxShadow: `0 24px 60px ${BOND_LEVEL_META[bondLevelUp.level].color}55`,
                textAlign: 'center', minWidth: 280, fontFamily: IRIS_FONTS.body,
              }}>
              <motion.div animate={{ rotate: [0, -8, 8, -4, 0] }} transition={{ duration: 0.7, delay: 0.1 }}
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${BOND_LEVEL_META[bondLevelUp.level].color}, #F472B6)`,
                  margin: '0 auto 0.6rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.1rem',
                }}>
                {BOND_LEVEL_META[bondLevelUp.level].emoji}
              </motion.div>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.28em', color: BOND_LEVEL_META[bondLevelUp.level].color, fontWeight: 800, marginBottom: 6 }}>
                <Sparkles size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                BOND LEVEL UP
              </div>
              <div style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.45rem', fontWeight: 500, color: '#1f1530' }}>
                {bondLevelUp.name} → {BOND_LEVEL_META[bondLevelUp.level].label}
              </div>
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#6b5d80' }}>
                関係が一段、深まりました。
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ────── 今週の 5 人カード ─────── */
function WeeklyFiveCard({ bg, cache, loading, onGenerate, fansCount }: {
  bg: IrisBackgroundDef;
  cache: WeeklyFiveCache | null;
  loading: boolean;
  onGenerate: () => void;
  fansCount: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const fresh = !!cache && cache.date === today;
  return (
    <div style={{
      padding: '1.1rem 1.2rem',
      background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}05)`,
      border: `1px solid ${bg.accent}38`,
      borderRadius: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: cache ? '0.7rem' : 0 }}>
        <div>
          <p style={{ fontSize: '0.68rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700 }}>
            <Sparkles size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
            今週連絡すべき 5 人
          </p>
          <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginTop: 2, lineHeight: 1.6 }}>
            {fresh ? `${cache!.date} 更新 — Iris が選び、声かけ案も書きました` : '今日の分はまだ作っていません'}
          </p>
        </div>
        <button onClick={onGenerate} disabled={loading || fansCount === 0} style={{
          background: fresh ? 'transparent' : `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
          color: fresh ? bg.accent : '#fff',
          border: fresh ? `1px solid ${bg.accent}55` : 'none',
          borderRadius: 999, padding: '0.55rem 1.1rem',
          fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
          fontFamily: IRIS_FONTS.body,
          minHeight: 36, opacity: loading || fansCount === 0 ? 0.5 : 1,
        }}>
          {loading ? '考え中…' : fresh ? '作り直す' : '今週の 5 人を見る'}
        </button>
      </div>
      {cache && cache.items.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {cache.items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.7)',
              borderRadius: 10, border: `1px solid ${bg.cardBorder}`,
            }}>
              <span style={{ fontWeight: 800, color: bg.accent, minWidth: 22, fontSize: '0.95rem' }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.88rem' }}>
                  {it.name} <span style={{ fontWeight: 400, color: bg.inkSoft, fontSize: '0.78rem' }}>· {it.handle}</span>
                </p>
                <p style={{ fontSize: '0.74rem', color: bg.inkSoft, marginTop: 2, lineHeight: 1.5 }}>{it.reason}</p>
                {it.whisper && (
                  <div style={{ marginTop: 6, padding: '0.45rem 0.7rem', background: `${bg.accent}10`, borderRadius: 8, fontSize: '0.78rem', color: bg.ink, lineHeight: 1.6, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                    「{it.whisper}」
                    <button onClick={() => copyText(it.whisper, '声かけ案')} style={{ marginLeft: 8, background: 'none', border: 'none', color: bg.accent, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>
                      コピー
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ────── 絆スコアメーター ─────── */
function FanBondMeter({ fan, bg }: { fan: FanContact; bg: IrisBackgroundDef }) {
  const b = calcFanBondScore(fan);
  const meta = BOND_LEVEL_META[b.level];
  const next = pointsToNextLevel(b.total);
  return (
    <div style={{
      padding: '0.85rem 1rem',
      background: `linear-gradient(135deg, ${meta.color}14, transparent)`,
      border: `1px solid ${meta.color}50`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1.05rem' }}>{meta.emoji}</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>絆スコア {b.total} / 100</span>
        </div>
        {next && (
          <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>
            あと {next.needed} pt で「{next.nextLabel}」
          </span>
        )}
      </div>
      <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${b.total}%`, height: '100%',
          background: `linear-gradient(90deg, ${meta.color}, #F472B6)`,
          transition: 'width 0.5s',
        }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: '0.66rem', color: bg.inkSoft }}>
        <span>やり取り {b.parts.interaction}</span>
        <span>·</span>
        <span>タグ {b.parts.tag}</span>
        <span>·</span>
        <span>温度 {b.parts.positivity}</span>
        <span>·</span>
        <span>話題 {b.parts.topic}</span>
        <span>·</span>
        <span>歴 {b.parts.loyalty}</span>
        <span>·</span>
        <span>返信 {b.parts.reciprocity}</span>
      </div>
    </div>
  );
}

/** ────── ファンカード ─────── */
function FanCard({ fan, bg, bond, isSelected, onSelect, onDelete }: {
  fan: FanContact;
  bg: IrisBackgroundDef;
  bond?: ReturnType<typeof calcFanBondScore>;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const tagColor = TAG_COLORS[fan.tag];
  const lvMeta = bond ? BOND_LEVEL_META[bond.level] : BOND_LEVEL_META[0];
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '0.85rem 0.95rem', borderRadius: 12,
        background: isSelected ? `${bg.accent}0e` : bg.card,
        border: `1px solid ${isSelected ? bg.accent : bg.cardBorder}`,
        cursor: 'pointer', transition: 'all 0.15s',
        minHeight: 96,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fan.name}</p>
          <p style={{ fontSize: '0.74rem', color: bg.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fan.handle}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label="削除"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: bg.inkSoft, fontSize: '0.8rem', padding: 4, flexShrink: 0, minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.45rem', gap: 4 }}>
        <span style={{ background: tagColor.bg, color: tagColor.text, fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, padding: '0.18rem 0.55rem' }}>
          {fan.tag}
        </span>
        <span style={{ fontSize: '0.7rem', color: bg.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {lvMeta.emoji} {bond?.total ?? 0}
        </span>
      </div>
      <div style={{ marginTop: 6, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${bond?.total ?? 0}%`, height: '100%',
          background: `linear-gradient(90deg, ${lvMeta.color}, #F472B6)`,
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

function FField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: '0.7rem', color: '#3D3247', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 4, fontFamily: IRIS_FONTS.body }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inp(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    width: '100%', padding: '0.6rem 0.75rem',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 8,
    fontSize: '16px', fontFamily: IRIS_FONTS.body,
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    outline: 'none', boxSizing: 'border-box',
    minHeight: 40,
  };
}

function btnPrimary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.65rem 1.2rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 4px 14px ${bg.accent}40`,
    minHeight: 40,
  };
}

function btnSecondary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.85)',
    color: bg.accent, border: `1px solid ${bg.accent}40`,
    borderRadius: 999, padding: '0.65rem 1.1rem',
    fontWeight: 600, cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: IRIS_FONTS.body,
    minHeight: 40,
  };
}

function btnCancel(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: 'transparent', color: bg.inkSoft,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
    padding: '0.55rem 1.05rem', cursor: 'pointer',
    fontFamily: IRIS_FONTS.body, fontSize: '0.85rem',
    minHeight: 38,
  };
}
