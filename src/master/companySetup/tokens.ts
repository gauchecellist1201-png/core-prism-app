// ============================================================
// /master/company-setup — 配色トークン & フォーマッタ (非コンポーネント)
// コンポーネントと分離するのは Fast Refresh (react-refresh/only-export-components) のため。
// 配色は既存 public/master.html のマスターハブ配色を踏襲 (--gold / --teal / --ink / --card / --line / --mut)。
// ============================================================

export const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';

export const COLORS = {
  ink: '#0B0E16',
  card: '#161D29',
  cardSoft: 'rgba(255,255,255,0.04)',
  line: '#2A3340',
  gold: '#D8A83B',
  goldSoft: 'rgba(216,168,59,0.16)',
  teal: '#16C77A',
  tealSoft: 'rgba(22,199,122,0.14)',
  mut: '#9AA6B2',
  text: '#F3F5F8',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.12)',
  lock: '#64748B',
  lockSoft: 'rgba(100,116,139,0.14)',
};

export function formatYen(n: number | null): string {
  if (n == null) return '—';
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function formatDateJa(iso: string | null): string {
  if (!iso) return '未定';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未定';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
