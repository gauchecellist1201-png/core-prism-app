// ============================================================
// aiSuggestionLog.ts — 「7 日分 AI 提案 履歴」の localStorage ラッパー
//
// オーナー指示 (2026-06-04 第 31 波 DDDDD):
//   AgentTeamMonitor / InlineActionExecutor / EveningFeed 等から呼べる
//   薄い記録 API。AiSuggestionHistory.tsx (モーダル) と組合せ、
//   採用率 / 却下率 / 保留 を見える化する。
//
// 永続化: localStorage key 'core_ai_suggestions'
// 形式  : SuggestionEntry[] (新しい順)
// 上限  : 200 件 (古い物から切捨て)
// 7日 集計  : entry.ts > now - 7d
// ============================================================

export type SuggestionStatus = 'pending' | 'adopted' | 'rejected' | 'held';

export interface SuggestionEntry {
  id: string;
  cxoKey: string;         // CXO_META の キー (例: 'ceo', 'cfo', ...)
  cxoName: string;        // 表示名 (キャッシュ)
  cxoEmoji: string;       // 絵文字
  title: string;          // 提案 1 行
  detail?: string;        // 詳細 (任意)
  source?: 'agent-monitor' | 'evening-feed' | 'inline-exec' | 'morning-brief' | 'other';
  ts: number;             // 作成時刻 (epoch ms)
  status: SuggestionStatus;
  statusTs?: number;      // status 更新時刻
  note?: string;          // 採用/却下時のメモ
}

const KEY = 'core_ai_suggestions';
const MAX = 200;
const DAY = 86_400_000;

function safeLoad(): SuggestionEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSave(list: SuggestionEntry[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // 他コンポーネントに変更を通知
    window.dispatchEvent(new CustomEvent('core:ai-suggestion-updated'));
  } catch {
    /* QuotaExceededError 等は無視 */
  }
}

/** 新しい提案を記録 (自動 id 付与) — 1 行で呼べる薄い API */
export function logSuggestion(input: Omit<SuggestionEntry, 'id' | 'ts' | 'status'> & { status?: SuggestionStatus }): SuggestionEntry {
  const entry: SuggestionEntry = {
    id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    status: input.status || 'pending',
    ...input,
  };
  const list = [entry, ...safeLoad()];
  safeSave(list);
  return entry;
}

export function listSuggestions(): SuggestionEntry[] {
  return safeLoad();
}

export function setStatus(id: string, status: SuggestionStatus, note?: string) {
  const list = safeLoad();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], status, statusTs: Date.now(), note: note ?? list[idx].note };
  safeSave(list);
}

export function removeSuggestion(id: string) {
  const list = safeLoad().filter((s) => s.id !== id);
  safeSave(list);
}

export function clearAll() {
  safeSave([]);
}

/** 直近 N 日 の集計 */
export interface SuggestionStats {
  total: number;
  adopted: number;
  rejected: number;
  held: number;
  pending: number;
  adoptionRate: number;   // 0-100 (採用 / (採用+却下), pending/held は分母から除外)
  byCxo: Array<{ key: string; name: string; emoji: string; count: number; adopted: number; rate: number }>;
}

export function statsForLastDays(days: number = 7): SuggestionStats {
  const since = Date.now() - days * DAY;
  const list = safeLoad().filter((s) => s.ts >= since);
  const total = list.length;
  const adopted = list.filter((s) => s.status === 'adopted').length;
  const rejected = list.filter((s) => s.status === 'rejected').length;
  const held = list.filter((s) => s.status === 'held').length;
  const pending = list.filter((s) => s.status === 'pending').length;
  const denominator = adopted + rejected;
  const adoptionRate = denominator > 0 ? Math.round((adopted / denominator) * 1000) / 10 : 0;

  // CXO 別
  const map = new Map<string, { key: string; name: string; emoji: string; count: number; adopted: number }>();
  for (const s of list) {
    const v = map.get(s.cxoKey) || { key: s.cxoKey, name: s.cxoName, emoji: s.cxoEmoji, count: 0, adopted: 0 };
    v.count++;
    if (s.status === 'adopted') v.adopted++;
    map.set(s.cxoKey, v);
  }
  const byCxo = [...map.values()]
    .map((v) => ({ ...v, rate: v.count > 0 ? Math.round((v.adopted / v.count) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);

  return { total, adopted, rejected, held, pending, adoptionRate, byCxo };
}
