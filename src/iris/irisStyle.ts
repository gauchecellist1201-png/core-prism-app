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

// IRIS パレット — Instagram (Edits アプリ) の安心感あるグラデ + 上品なピンク&オレンジ
// 白基調・柔らかいピンク〜パープル〜オレンジのグラデーション
//
// Instagram 公式グラデーション参考:
//   #833AB4 (Royal Purple) → #FD1D1D (Red) → #FCB045 (Orange/Yellow)
// より柔らかい派生:
//   #E1306C (Instagram Pink) / #F77737 (Soft Orange) / #FFDC80 (Cream Yellow)
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

  // Instagram 系ピンク (上品で柔らかい)
  hotPink:     '#E1306C',   // Instagram Pink (公式)
  pink:        '#FD7CB8',   // ソフトピンク
  pinkLt:      '#FFB8D6',
  pinkSoft:    '#FFD4E5',
  pinkMist:    '#FFE5EE',

  // パープル (Instagram のもう一つの主役)
  magenta:     '#E1306C',
  purple:      '#833AB4',   // Instagram Royal Purple (公式)
  purpleDeep:  '#5B2C8A',
  purpleLt:    '#B07BD9',

  // オレンジ / ゴールド (Edits の暖かみ)
  gold:        '#FCB045',   // Instagram Orange/Yellow (公式)
  goldDeep:    '#F77737',   // 暖かいオレンジ
  goldRose:    '#FCAF45',
  goldChampagne:'#FFDC80',

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

// Instagram (Edits) 系の柔らかいグラデーション背景プリセット
// 派手さより「安心感」を優先 — ピンク→オレンジ→パープルの上品な遷移
export const IRIS_BACKGROUNDS: IrisBackgroundDef[] = [
  {
    id: 'instagram-soft',
    label: 'Instagram Soft',
    emoji: '✨',
    background: 'radial-gradient(circle at 15% 20%, #833AB422 0%, transparent 50%), radial-gradient(circle at 85% 80%, #FCB04522 0%, transparent 50%), radial-gradient(circle at 60% 50%, #E1306C22 0%, transparent 45%), linear-gradient(135deg, #FFFAF7 0%, #FFE5EE 50%, #FFF5E5 100%)',
    accent: '#E1306C',
    ink: '#1F1A2E',          // 黒寄り強化 (もっとはっきり)
    inkSoft: '#3D3247',      // サブも濃く
    card: 'rgba(255,255,255,0.95)',  // ほぼ不透明白
    cardBorder: 'rgba(225,48,108,0.22)',
  },
  {
    id: 'rose-mist',
    label: 'Rose Mist',
    emoji: '🌸',
    background: 'radial-gradient(circle at 20% 30%, #FFB8D633 0%, transparent 55%), radial-gradient(circle at 80% 70%, #FCB04522 0%, transparent 50%), linear-gradient(180deg, #FFFAFB 0%, #FFEBF1 100%)',
    accent: '#E1306C',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.18)',
  },
  {
    id: 'peach-cream',
    label: 'Peach Cream',
    emoji: '🍑',
    background: 'radial-gradient(circle at 25% 30%, #FCB04533 0%, transparent 50%), radial-gradient(circle at 75% 70%, #FFB8D622 0%, transparent 50%), linear-gradient(135deg, #FFF9F0 0%, #FFE5DC 100%)',
    accent: '#F77737',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(247,119,55,0.2)',
  },
  {
    id: 'lavender-haze',
    label: 'Lavender Haze',
    emoji: '💜',
    background: 'radial-gradient(circle at 30% 20%, #B07BD933 0%, transparent 55%), radial-gradient(circle at 70% 80%, #FFB8D622 0%, transparent 50%), linear-gradient(180deg, #FAF5FF 0%, #FFEBF1 100%)',
    accent: '#833AB4',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(131,58,180,0.18)',
  },
  {
    id: 'sunrise-glow',
    label: 'Sunrise Glow',
    emoji: '🌅',
    background: 'linear-gradient(135deg, #FFE5DC 0%, #FFD4E5 35%, #FFE5EE 70%, #FAF5FF 100%)',
    accent: '#E1306C',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.2)',
  },
  {
    id: 'cream-classic',
    label: 'Cream Classic',
    emoji: '🤍',
    // 一番安心感のあるニュートラル
    background: 'linear-gradient(180deg, #FFFAF7 0%, #FFF5F8 50%, #FFFAF7 100%)',
    accent: '#E1306C',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.95)',
    cardBorder: 'rgba(225,48,108,0.15)',
  },
  {
    id: 'neon-night',
    label: 'Neon Night',
    emoji: '🌙',
    // ダーク版 (派手好きの方向け)
    background: 'radial-gradient(circle at 20% 30%, #833AB4cc 0%, transparent 55%), radial-gradient(circle at 80% 70%, #E1306Ccc 0%, transparent 55%), radial-gradient(circle at 60% 50%, #FCB04588 0%, transparent 45%), linear-gradient(135deg, #1A0A26 0%, #2A1A3A 100%)',
    accent: '#FCB045',
    ink: '#FFFFFF',
    inkSoft: '#FFEAF5',
    card: 'rgba(255,255,255,0.18)',
    cardBorder: 'rgba(252,176,69,0.35)',
  },
  {
    id: 'aurora-soft',
    label: 'Aurora',
    emoji: '🌈',
    // Instagram グラデの主流派生
    background: 'linear-gradient(135deg, #833AB433 0%, #E1306C33 25%, #F7773733 50%, #FCB04533 75%, #FFDC8033 100%), linear-gradient(180deg, #FFFAF7 0%, #FFF5F8 100%)',
    accent: '#E1306C',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.2)',
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
