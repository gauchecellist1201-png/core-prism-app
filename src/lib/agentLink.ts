// ============================================================
// agentLink — 「一度つないだ」という事実を覚えておく (2026-07-27)
//
// なぜ要るか（実際に起きていた最悪の壊れ方）:
//   Google のアクセストークンは1時間で切れる。切れると isGmailConnected() が
//   false になり、連携エージェントのカードは `if (!connected) return null` で
//   画面から消える。ユーザーから見ると「昨日いたAIが、何も言わずに消えた」。
//   これは不具合より質が悪い。何が起きたのかも、どう直すのかも分からない。
//
// そこで「一度でもつないだ」ことだけを別に覚えておき、
//   つながっていない × 一度つないだ  →  『外れています／つなぎ直す』を出す
//   つながっていない × 一度もつないでない → これまで通り何も出さない（偽の器を作らない）
//
// 覚えるのは「つないだ日時」だけ。トークンも中身も保存しない。
// ============================================================

export type AgentLinkId = 'gmail' | 'gcal';

const KEY_PREFIX = 'prism_agent_linked_';

export interface AgentLinkMemo {
  /** 最後につながっていた時刻 (unix ms) */
  at: number;
}

/** つながった（＝トークンを保存した）ときに呼ぶ */
export function rememberAgentLink(id: AgentLinkId): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify({ at: Date.now() } as AgentLinkMemo));
  } catch { /* localStorage が使えなくても本筋は止めない */ }
}

/** ユーザー自身が「解除」を押したときに呼ぶ（＝もう出さない） */
export function forgetAgentLink(id: AgentLinkId): void {
  try { localStorage.removeItem(`${KEY_PREFIX}${id}`); } catch { /* noop */ }
}

/** 一度でもつないだことがあるか。あれば最後につながっていた時刻を返す */
export function recallAgentLink(id: AgentLinkId): AgentLinkMemo | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as AgentLinkMemo;
    return p && typeof p.at === 'number' && Number.isFinite(p.at) ? p : null;
  } catch { return null; }
}

/** その日の0時0分（同じ日かどうかを、経過時間ではなく日付で判定するため） */
function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 「きのうの15:20まで」のような、やさしい言い方に直す */
export function describeLastLinked(at: number): string {
  const now = Date.now();
  if (!Number.isFinite(at) || at > now) return '';
  const d = new Date(at);
  const hhmm = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  if (now - at < 3600000) return 'さっきまで';
  // 20時間前でも日付がまたいでいれば「きのう」。経過時間で判定すると嘘になる
  const dayDiff = Math.round((startOfDay(now) - startOfDay(at)) / 86400000);
  if (dayDiff <= 0) return `今日の ${hhmm} まで`;
  if (dayDiff === 1) return `きのうの ${hhmm} まで`;
  return `${d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} まで`;
}
