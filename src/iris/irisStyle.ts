// ============================================================
// CORE Iris — ブランド定数 & テーマ
// 「自分の色で、咲く。」 — 女性インフルエンサー向け 視覚優先 UI
// ============================================================

export const IRIS_BRAND = {
  name: 'CORE Iris',
  tagline: '自分の色で、咲く。',
  taglineEn: 'Your Color. Your Bloom.',
  description: 'インフルエンサーのための、もうひとつの脳。',
  parent: 'CORE Prism',
};

export const IRIS_COLORS = {
  // メインパレット
  rose:        '#FF7AAE',  // 主色
  roseDeep:    '#E84B97',
  roseSoft:    '#FFD4E5',
  roseMist:    '#FFF0F5',

  cream:       '#FFF9F0',
  champagne:   '#F5E6D3',
  pearl:       '#FAFAFC',

  lavender:    '#C9A4F5',
  lavenderSoft:'#E8DCFA',

  peach:       '#FFB89A',
  peachSoft:   '#FFE5D6',

  gold:        '#D9A41A',
  goldSoft:    '#F5E6A0',

  // 文字色: 純黒 #000 / 純白 #fff を避けて目への負担を軽減
  navy:        '#3A2F4F',  // 見出し・強アクセント (上品な紫黒、純黒より目に優しい)
  ink:         '#403648',  // 本文 (柔らかい紫グレー、 #333 より暖かみ)
  inkSoft:     '#6E6577',
  inkDim:      '#9088A8',

  white:       '#FFFFFF',
};

export const IRIS_FONTS = {
  display: '"Cormorant Garamond", "Noto Serif JP", "游明朝", serif',
  body:    '"Inter", "Noto Sans JP", "游ゴシック", sans-serif',
  accent:  '"Playfair Display", "Noto Serif JP", serif',
};

// 背景パターンのプリセット (ユーザーが選択できる)
export type IrisBackgroundId =
  | 'rose-bloom'
  | 'champagne-mist'
  | 'lavender-dawn'
  | 'pearl-shimmer'
  | 'peach-sunset'
  | 'midnight-velvet'
  | 'cream-minimal'
  | 'aurora-petal';

export interface IrisBackgroundDef {
  id: IrisBackgroundId | string;
  label: string;
  emoji: string;
  /** メインの背景 (CSS gradient 等) */
  background: string;
  /** アクセント色 (テキストやボタン用) */
  accent: string;
  /** メインの文字色 */
  ink: string;
  /** サブ文字色 */
  inkSoft: string;
  /** カード背景 */
  card: string;
  /** カードボーダー */
  cardBorder: string;
}

// 補色ペアで構成されたインパクト系プリセット (全て色相環で対極を組ませた配色)
export const IRIS_BACKGROUNDS: IrisBackgroundDef[] = [
  {
    id: 'rose-bloom',
    label: 'Rose × Mint',
    emoji: '🌸',
    background: 'radial-gradient(circle at 20% 30%, #FFD4E5 0%, transparent 50%), radial-gradient(circle at 80% 70%, #C8F0E0 0%, transparent 50%), linear-gradient(135deg, #FFF0F5 0%, #F0FAF5 100%)',
    accent: '#10B981', // ピンク背景に対する補色 = ミントグリーン
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.72)',
    cardBorder: 'rgba(16,185,129,0.22)',
  },
  {
    id: 'champagne-mist',
    label: 'Honey × Plum',
    emoji: '🥂',
    background: 'radial-gradient(circle at 30% 20%, #FFE6B0 0%, transparent 55%), radial-gradient(circle at 75% 80%, #E8DCFA 0%, transparent 55%), linear-gradient(135deg, #FFF9F0 0%, #F5EFFF 100%)',
    accent: '#7B4FC9', // 黄系の補色 = 紫
    ink: '#3D3247',
    inkSoft: '#7A6F8F',
    card: 'rgba(255,255,255,0.75)',
    cardBorder: 'rgba(123,79,201,0.22)',
  },
  {
    id: 'lavender-dawn',
    label: 'Lavender × Honey',
    emoji: '💜',
    background: 'radial-gradient(circle at 70% 30%, #E8DCFA 0%, transparent 55%), radial-gradient(circle at 20% 80%, #FFF0C9 0%, transparent 55%), linear-gradient(180deg, #F5EFFF 0%, #FFF9E5 100%)',
    accent: '#D9A41A', // 紫の補色 = ゴールド
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.74)',
    cardBorder: 'rgba(217,164,26,0.25)',
  },
  {
    id: 'pearl-shimmer',
    label: 'Coral × Teal',
    emoji: '🐚',
    background: 'radial-gradient(circle at 25% 30%, #FFD4C8 0%, transparent 55%), radial-gradient(circle at 80% 80%, #C8E8E8 0%, transparent 55%), linear-gradient(135deg, #FFF5F0 0%, #F0FAFA 100%)',
    accent: '#0EA5E9', // コーラルの補色 = ティール
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.78)',
    cardBorder: 'rgba(14,165,233,0.22)',
  },
  {
    id: 'peach-sunset',
    label: 'Peach × Sky',
    emoji: '🌅',
    background: 'radial-gradient(circle at 80% 20%, #FFB89A 0%, transparent 55%), radial-gradient(circle at 20% 70%, #BFE5F0 0%, transparent 55%), linear-gradient(180deg, #FFE5D6 0%, #E8F4FA 100%)',
    accent: '#0284C7', // ピーチの補色 = スカイブルー
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.72)',
    cardBorder: 'rgba(2,132,199,0.22)',
  },
  {
    id: 'midnight-velvet',
    label: 'Night × Coral',
    emoji: '🌙',
    background: 'radial-gradient(circle at 30% 30%, #4A2F5C 0%, transparent 55%), radial-gradient(circle at 80% 70%, #2E2440 0%, transparent 60%), linear-gradient(135deg, #1F1A2E 0%, #2A1F3F 100%)',
    accent: '#FF7A6B', // 暗紫の補色 = 暖かいコーラル
    ink: '#F0EAF7',    // 純白 #fff を避けて柔らかいラベンダー白
    inkSoft: '#D8CCEA',
    card: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,122,107,0.3)',
  },
  {
    id: 'cream-minimal',
    label: 'Cream × Magenta',
    emoji: '🤍',
    background: 'linear-gradient(180deg, #FFF9F0 0%, #FFFFFF 50%, #FFF5FB 100%)',
    accent: '#E84B97', // クリームベースに対する強アクセント = マゼンタ
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.95)',
    cardBorder: 'rgba(232,75,151,0.2)',
  },
  {
    id: 'aurora-petal',
    label: 'Aurora (補色 spectrum)',
    emoji: '🌈',
    background: 'conic-gradient(from 220deg at 50% 50%, #FFD4E5 0%, #C8F0E0 25%, #FFE5D6 50%, #BFE5F0 75%, #FFD4E5 100%)',
    accent: '#10B981',
    ink: '#3D3247',
    inkSoft: '#6E6577',
    card: 'rgba(255,255,255,0.7)',
    cardBorder: 'rgba(16,185,129,0.22)',
  },
];

const STORAGE_KEY = 'core_iris_bg_v1';
const CUSTOM_LIST_KEY = 'core_iris_custom_bgs_v1';

/** ユーザー自作の背景 (プリセットと同じ形だが id が "custom-..." で始まる) */
export interface CustomIrisBackground extends Omit<IrisBackgroundDef, 'id'> {
  id: string; // "custom-<uuid>"
  isCustom: true;
}

function loadCustomList(): CustomIrisBackground[] {
  try { const r = localStorage.getItem(CUSTOM_LIST_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function saveCustomList(list: CustomIrisBackground[]) {
  try { localStorage.setItem(CUSTOM_LIST_KEY, JSON.stringify(list)); } catch { /* */ }
}

export function getAllBackgrounds(): (IrisBackgroundDef | CustomIrisBackground)[] {
  return [...IRIS_BACKGROUNDS, ...loadCustomList()];
}

export function loadIrisBackground(): IrisBackgroundDef | CustomIrisBackground {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    const all = getAllBackgrounds();
    return all.find(b => b.id === id) || IRIS_BACKGROUNDS[0];
  } catch {
    return IRIS_BACKGROUNDS[0];
  }
}

export function saveIrisBackground(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* */ }
}

export function addCustomBackground(b: Omit<CustomIrisBackground, 'id' | 'isCustom'>): CustomIrisBackground {
  const list = loadCustomList();
  const created: CustomIrisBackground = {
    ...b,
    id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    isCustom: true,
  };
  saveCustomList([...list, created]);
  return created;
}

export function removeCustomBackground(id: string) {
  saveCustomList(loadCustomList().filter(b => b.id !== id));
}

export function updateCustomBackground(id: string, patch: Partial<CustomIrisBackground>) {
  saveCustomList(loadCustomList().map(b => b.id === id ? { ...b, ...patch } : b));
}

/** ベース2色 + アクセント色からパターン別に CSS background を生成 */
export type GradientPattern = 'radial-soft' | 'linear' | 'conic' | 'mesh' | 'minimal';

export function buildGradient(pattern: GradientPattern, c1: string, c2: string, c3: string): string {
  switch (pattern) {
    case 'radial-soft':
      return `radial-gradient(circle at 20% 30%, ${c1}aa 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${c2}aa 0%, transparent 50%), linear-gradient(135deg, ${c1}33 0%, ${c2}33 100%)`;
    case 'linear':
      return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
    case 'conic':
      return `conic-gradient(from 220deg at 50% 50%, ${c1} 0%, ${c2} 33%, ${c3} 66%, ${c1} 100%)`;
    case 'mesh':
      return `radial-gradient(at 20% 20%, ${c1} 0%, transparent 50%), radial-gradient(at 80% 0%, ${c2} 0%, transparent 50%), radial-gradient(at 0% 80%, ${c3} 0%, transparent 50%), radial-gradient(at 80% 80%, ${c1} 0%, transparent 50%)`;
    case 'minimal':
      return `linear-gradient(180deg, ${c1} 0%, #FFFFFF 100%)`;
  }
}

/** Hex を HSL に変換 */
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let H = 0, S = 0;
  const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: H = ((b - r) / d + 2); break;
      case b: H = ((r - g) / d + 4); break;
    }
    H *= 60;
  }
  return [H, S, L];
}

/** HSL を Hex に変換 */
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60)        [r, g, b] = [c, x, 0];
  else if (h < 120)  [r, g, b] = [x, c, 0];
  else if (h < 180)  [r, g, b] = [0, c, x];
  else if (h < 240)  [r, g, b] = [0, x, c];
  else if (h < 300)  [r, g, b] = [x, 0, c];
  else               [r, g, b] = [c, 0, x];
  const to2 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

/** 補色 (色相環180度反対) を返す */
export function complementaryColor(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + 180, s, l);
}

/** 同じ色相の Tint (明るく) と Shade (暗く) を返す */
export function tintShade(hex: string): { tint: string; shade: string } {
  const [h, s, l] = hexToHsl(hex);
  return {
    tint:  hslToHex(h, Math.max(0.2, s * 0.6), Math.min(0.95, l + 0.18)),
    shade: hslToHex(h, s, Math.max(0.15, l - 0.25)),
  };
}

/** ベース色から補色ペアの配色 (3色 + アクセント補色) を作る */
export function buildComplementaryPalette(baseHex: string): { c1: string; c2: string; c3: string; accent: string } {
  const comp = complementaryColor(baseHex);
  const t = tintShade(baseHex);
  return {
    c1: t.tint,
    c2: baseHex,
    c3: tintShade(comp).tint,
    accent: comp,
  };
}

/** 文字色を背景の明度から自動推定 — 純黒/純白を避けて目に優しい色に */
export function pickInkForBackground(c1: string): { ink: string; inkSoft: string; card: string; cardBorder: string } {
  // 単純な明度判定
  const hex = c1.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.5) {
    // 暗い背景: 純白を避けて柔らかい白
    return { ink: '#F0EAF7', inkSoft: '#C8BCE0', card: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(255,255,255,0.25)' };
  }
  // 明るい背景: 純黒を避けて柔らかい紫黒
  return { ink: '#3D3247', inkSoft: '#6E6577', card: 'rgba(255,255,255,0.7)', cardBorder: 'rgba(0,0,0,0.08)' };
}
