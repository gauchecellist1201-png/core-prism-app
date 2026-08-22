// ============================================================
// CORE Studio Sales OS — 配色・寸法
// 黒 / 白 / ダークグレー + COREのゴールド。装飾は足さない。
// 情報密度は高いが、次にやることが一目で分かることを最優先にする。
// ============================================================

export const T = {
  bg: '#08090C',
  raise: '#101218',        // カード
  raise2: '#161A22',       // カードの中のさらに上の面
  line: '#242A36',
  lineSoft: 'rgba(255,255,255,0.07)',

  ink: '#F5F7FA',          // 見出し (#08090C 上で 17.4:1)
  body: '#C9CFDA',         // 本文 (11.2:1)
  mute: '#8E97A6',         // 補足 (5.6:1)
  faint: '#5D6675',        // 罫線がわりの文字。本文には使わない

  gold: '#D8A83B',         // ブランド (#08090C 上で 9.6:1 — 文字に使える)
  goldSoft: 'rgba(216,168,59,0.12)',
  goldLine: 'rgba(216,168,59,0.34)',

  green: '#34D399',
  blue: '#5BA8F5',
  purple: '#A78BFA',
  amber: '#F5A524',
  red: '#F87171',
  redSoft: 'rgba(248,113,113,0.12)',
} as const;

export const SANS =
  '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Inter", sans-serif';

/** 触れるものは必ずこの高さ以上 (iPhone 実測で 44px を割ると押せない) */
export const TAP = 44;

/** 下部固定ナビの高さ。本文の下余白はこれ + safe-area を必ず確保する */
export const NAV_H = 62;

export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const yen = (n: number): string => `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;

export const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = iso.length <= 10 ? iso : iso.slice(0, 10);
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}/${Number(day)}` : d;
};

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export function daysFromToday(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const t = Date.parse(`${dateISO}T00:00:00.000Z`);
  const now = Date.parse(`${todayStr()}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - now) / 86_400_000);
}
