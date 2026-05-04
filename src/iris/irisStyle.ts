// ============================================================
// CORE Iris — ブランド定数 & テーマ
// 「自分の色で、咲く。」 — 女性インフルエンサー向け 視覚優先 UI
// ============================================================

export const IRIS_BRAND = {
  name: 'IRIS',                              // 短く、雑誌のロゴのように
  tagline: 'Edit Yourself.',                 // 「自分を、編集する。」
  taglineJa: '自分を、編集する。',
  description: 'A magazine, a manager, a mirror — for women who edit their own story.',
  parent: 'CORE Prism',
  issue: 'Vol. 01 · 2026',                   // VOGUE 風の号数
  publisher: 'CORE',
};

// IRIS パレット — プラダの世界観 (深み・洗練) × ホットピンク・ゴールド (女性の高揚感)
// Barbie × Sephora × Versace × Vogue を鳥瞰した、女性が手に取りたくなる派手な配色
export const IRIS_COLORS = {
  // ベース (リッチな深み)
  ivory:       '#FFF5F8',   // ピンクみのあるオフホワイト
  ivoryDeep:   '#FCE8EF',
  cream:       '#FFFAF5',
  paper:       '#FFFFFF',

  // インク (純黒回避、紫みで深み出す)
  inkBlack:    '#1A0A26',   // 深紅紫 (プラダの暗黒×女性的紫)
  ink:         '#2A1A3A',   // 本文・見出し
  inkSoft:     '#5A4570',   // 本文 small
  inkDim:      '#8A7AA0',   // メタ情報

  // ホットピンク (主役の派手色)
  hotPink:     '#FF1493',   // ディープフューシャ
  pink:        '#FF3D8E',   // ホットピンク
  pinkLt:      '#FF6BA8',
  pinkSoft:    '#FFB8D6',
  pinkMist:    '#FFE0EC',

  // パープル / マゼンタ (もう一つの主役)
  magenta:     '#E91E63',
  purple:      '#9D4EDD',   // ネオンパープル
  purpleDeep:  '#6A0DAD',
  purpleLt:    '#C77DFF',

  // ゴールド (Versace 級のアクセント)
  gold:        '#FFD700',   // ブライトゴールド
  goldDeep:    '#FFC857',
  goldRose:    '#FFA94D',
  goldChampagne:'#F5D67E',

  // 旧 ボルドー系 (互換用)
  bordeaux:    '#C8102E',   // よりビビッドな赤
  bordeauxLt:  '#FF1493',   // ホットピンクで上書き
  oxblood:     '#7B0E29',
  red:         '#FF1744',   // クラシックレッドリップ

  // ヌード (アクセント)
  nude:        '#FFE0CC',
  nudeDeep:    '#F5D67E',   // ゴールドに振る
  champagne:   '#FFD700',
  blush:       '#FFB8D6',

  // ローズゴールド (アクセント)
  roseGold:    '#FFA94D',   // よりビビッド
  roseGoldLt:  '#FFD67E',

  // ネイビー / フォレスト
  navy:        '#1A0A26',   // インクと同化
  forest:      '#2D3F2A',

  // 残し: 旧 API 互換
  rose:        '#FF1493',
  roseDeep:    '#C8102E',
  roseSoft:    '#FFB8D6',
  roseMist:    '#FFE0EC',
  pearl:       '#FFFAFA',
  lavender:    '#C77DFF',
  lavenderSoft:'#E0BFF5',
  peach:       '#FFE0CC',
  peachSoft:   '#FFD6BC',
  goldSoft:    '#FFD67E',
  white:       '#FFFAF5',
};

// VOGUE / Devil Wears Prada 級のタイポグラフィ
// Display: Playfair Display (Didot 系) — 大判タイトル
// Serif:   Cormorant — 見出し・引用
// Sans:    Inter — 本文
export const IRIS_FONTS = {
  display: '"Playfair Display", "Bodoni Moda", "Didot", "Noto Serif JP", "游明朝", serif',
  serif:   '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", "游明朝", serif',
  body:    '"Inter", "Helvetica Neue", "Noto Sans JP", "游ゴシック", sans-serif',
  accent:  '"Cormorant Garamond", "Noto Serif JP", serif',
  mono:    '"Cormorant Garamond", serif', // 数字・見出しナンバー用
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

// LP HERO のネオン爆発をプリセット化したインパクト系背景
// ホットピンク × ゴールド × ネオンパープル × マゼンタ — Versace × Barbie × Vogue
export const IRIS_BACKGROUNDS: IrisBackgroundDef[] = [
  {
    id: 'neon-burst',
    label: 'Neon Burst',
    emoji: '✨',
    // LP HERO と同じ多層ネオンスポット
    background: 'radial-gradient(circle at 15% 25%, #FF1493cc 0%, transparent 50%), radial-gradient(circle at 80% 75%, #9D4EDDcc 0%, transparent 50%), radial-gradient(circle at 70% 25%, #FFD700aa 0%, transparent 45%), linear-gradient(135deg, #1A0A26 0%, #2A1A3A 100%)',
    accent: '#FFD700',
    ink: '#FFFAF5',
    inkSoft: '#FFD6EE',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,215,0,0.35)',
  },
  {
    id: 'magenta-disco',
    label: 'Magenta Disco',
    emoji: '💃',
    background: 'radial-gradient(circle at 25% 30%, #E91E63cc 0%, transparent 55%), radial-gradient(circle at 75% 70%, #9D4EDDcc 0%, transparent 55%), radial-gradient(circle at 50% 50%, #FFC857aa 0%, transparent 40%), linear-gradient(135deg, #1A0A26 0%, #3A1A4A 100%)',
    accent: '#FFC857',
    ink: '#FFFAF5',
    inkSoft: '#FFD6EE',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,200,87,0.35)',
  },
  {
    id: 'sunset-drama',
    label: 'Sunset Drama',
    emoji: '🌅',
    background: 'radial-gradient(circle at 20% 30%, #FF1493dd 0%, transparent 55%), radial-gradient(circle at 80% 80%, #FFA94Ddd 0%, transparent 55%), radial-gradient(circle at 70% 20%, #FFD700aa 0%, transparent 50%), linear-gradient(135deg, #2A0A26 0%, #3A1A2A 100%)',
    accent: '#FFD700',
    ink: '#FFFAF5',
    inkSoft: '#FFD6EE',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,169,77,0.4)',
  },
  {
    id: 'purple-reign',
    label: 'Purple Reign',
    emoji: '👑',
    background: 'radial-gradient(circle at 30% 20%, #9D4EDDee 0%, transparent 55%), radial-gradient(circle at 70% 80%, #C77DFFcc 0%, transparent 55%), radial-gradient(circle at 50% 50%, #FF1493aa 0%, transparent 45%), linear-gradient(135deg, #2A0A4A 0%, #1A0A26 100%)',
    accent: '#FF1493',
    ink: '#FFFAF5',
    inkSoft: '#E0BFF5',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,20,147,0.35)',
  },
  {
    id: 'champagne-pop',
    label: 'Champagne Pop',
    emoji: '🥂',
    // 派手だが少し明るめ (ライト派手)
    background: 'radial-gradient(circle at 20% 20%, #FFD700aa 0%, transparent 50%), radial-gradient(circle at 80% 80%, #FF1493bb 0%, transparent 55%), radial-gradient(circle at 60% 50%, #FFC857cc 0%, transparent 45%), linear-gradient(135deg, #FFE0CC 0%, #FFF5F8 100%)',
    accent: '#E91E63',
    ink: '#2A1A3A',
    inkSoft: '#5A4570',
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(233,30,99,0.3)',
  },
  {
    id: 'rose-velvet',
    label: 'Rose Velvet',
    emoji: '🌹',
    background: 'radial-gradient(circle at 25% 30%, #FF1493dd 0%, transparent 55%), radial-gradient(circle at 75% 70%, #FF6BA8cc 0%, transparent 55%), radial-gradient(circle at 50% 50%, #FFD700aa 0%, transparent 40%), linear-gradient(135deg, #2A0A1A 0%, #3A0A2A 100%)',
    accent: '#FFD700',
    ink: '#FFFAF5',
    inkSoft: '#FFD6EE',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,215,0,0.35)',
  },
  {
    id: 'aurora-glam',
    label: 'Aurora Glam',
    emoji: '🌈',
    background: 'conic-gradient(from 0deg at 50% 50%, #FF1493 0%, #9D4EDD 25%, #FFD700 50%, #E91E63 75%, #FF1493 100%)',
    accent: '#FFFFFF',
    ink: '#FFFAF5',
    inkSoft: '#FFE0F5',
    card: 'rgba(0,0,0,0.25)',
    cardBorder: 'rgba(255,255,255,0.45)',
  },
  {
    id: 'cherry-blossom',
    label: 'Cherry Blossom',
    emoji: '🌸',
    // ライト系の派手 (ピンク基調)
    background: 'radial-gradient(circle at 25% 25%, #FF1493cc 0%, transparent 45%), radial-gradient(circle at 75% 75%, #FFD700aa 0%, transparent 45%), radial-gradient(circle at 50% 50%, #FFB8D6dd 0%, transparent 50%), linear-gradient(135deg, #FFE0EC 0%, #FFF5F8 100%)',
    accent: '#FF1493',
    ink: '#2A1A3A',
    inkSoft: '#7A5588',
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(255,20,147,0.3)',
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
