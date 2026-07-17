// ============================================================
// CORE Identity OS — コントラスト計算ヘルパー
// 背景色から「読める文字色」(白 or 黒) を自動選択
// ペルソナのアクセントカラーが入力フィールド背景と被ったとき、
// 文字が消える問題を一掃する
// ============================================================

/** hex (#RRGGBB) を [r, g, b] (0-255) に */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

/** WCAG 相対輝度 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const adjust = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

/** WCAG コントラスト比 (1-21) */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 背景色に対して読める文字色を返す。
 * - luminance > 0.5 → 黒系 (#0A0814)
 * - それ以外 → 白系 (#FFFAF5)
 */
export function readableTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#0A0814' : '#FFFAF5';
}

/**
 * アクセント色の上に乗せる文字色。
 * ブランドの見え方を保つため白を優先し、白では読めない
 * (コントラスト 3 未満) 明るいアクセントの時だけ黒系に落とす。
 *
 * readableTextColor の輝度 0.5 しきい値だと #34D399 や #06B6D4 のような
 * 明るいアクセントを取りこぼし白のまま (1.85 / 2.43) になるため、
 * ここでは実測コントラスト比で判定する。
 */
export function onAccentInk(accentHex: string): string {
  return contrastRatio('#FFFFFF', accentHex) >= 3 ? '#FFFFFF' : '#0A0814';
}

/**
 * 背景に対して「やわらかい」読める文字色 (純黒/純白を避ける)
 */
export function softTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#1F1A2E' : '#FFFAF5';
}

/**
 * 背景に対する subtle (薄い) 文字色
 */
export function subtleTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#6E6577' : 'rgba(255,250,245,0.7)';
}

/**
 * 「この色は明るすぎる/暗すぎるので注意」を返すバリデーション
 * UI が崩れる可能性があるアクセントカラーを警告
 */
export function validateAccentColor(hex: string, bgHex: string): {
  ok: boolean;
  contrast: number;
  warning?: string;
} {
  const c = contrastRatio(hex, bgHex);
  if (c < 2) {
    return { ok: false, contrast: c, warning: 'この色は背景と区別がつかなくなります。別の色を選んでください' };
  }
  if (c < 3) {
    return { ok: true, contrast: c, warning: '視認性がやや低めです。明るい/暗い色のほうが読みやすくなります' };
  }
  return { ok: true, contrast: c };
}

/**
 * カラーピッカー用: 与えた色に対して「読める文字 + 背景」のペアを返す
 */
export function pickColorPair(accent: string): {
  bg: string;
  fg: string;
  fgDim: string;
} {
  return {
    bg: accent,
    fg: readableTextColor(accent),
    fgDim: relativeLuminance(accent) > 0.5 ? 'rgba(10, 8, 20, 0.65)' : 'rgba(255, 250, 245, 0.7)',
  };
}
