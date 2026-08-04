// ============================================================
// CORE Iris — ブランド定数 & テーマ
// 「自分の色で、咲く。」 — 女性インフルエンサー向け 視覚優先 UI
// ============================================================

export const IRIS_BRAND = {
  name: 'IRIS',
  tagline: 'An Agent for Every Creator.',
  taglineJa: 'すべてのインフルエンサーに、エージェントAIを。',
  description: 'すべてのインフルエンサーのための、専属 AI エージェント。案件・交渉・投稿・分析を、声と画像で。',
  parent: 'CORE Prism',
  issue: 'Vol. 01 · 2026',
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
  hotPink:     '#E1306C',   // Instagram Pink (公式) — 「面」用（塗り・枠・アイコン）
  // 「文字」用のピンク。公式ピンクをそのまま明るい下地の文字に使うと 3.94〜4.34:1 で
  // AA 落第する（10〜12px の見出しが多いので実害が大きい）。色相は同じで濃さだけ違う。
  hotPinkText: '#B81B57',
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
  /** アクセント色 — 「面」用 (ボタンの塗り・枠・アイコン・グラデ)。ブランドのトーンそのもの */
  accent: string;
  /**
   * アクセント色 — 「文字」用。
   * 2026-08-02: accent を面と文字で兼用していたため、Instagram ピンク #E1306C を
   * 明るい下地に文字として置くと 3.94〜4.34:1 で AA 落第していた（リールスタジオの
   * 見出し約 40 個が該当）。面の色は 1px も変えずにトーンを保ったまま、
   * 文字のときだけ同じ色相の濃い方を使う＝役割分離。
   * 暗いテーマでは文字も面と同じ色でよい（下地が暗いので落第しない）。
   */
  accentText: string;
  /**
   * アクセント色 — 「白い文字を乗せるベタ塗り」用。
   * accent(#E1306C) に白文字だと 4.34:1 で、12px 前後のボタン文字は AA 落第する。
   * グラデ・枠・アイコン・淡い塗りは accent のままで、ベタ塗りボタンだけこれを使う。
   *
   * ⚠️ここに入る色は **白が 4.6:1 通ることを whiteSafeFace で保証する**（下の
   * `IRIS_BACKGROUNDS` と `withAccentText` の両方を通す）。画面側 50 箇所すべてが
   * `background: bg.accentSolid, color: '#fff'` と書いており、面の側でしか守れない。
   * 2026-08-05 本番実測: Neon Night のアクセント #FCB045 をそのままベタ塗りにしていたため
   * 「写真・動画を選ぶ」等の主ボタンが白文字 **1.84:1**＝この背景を選んだ人には読めなかった。
   * 面のトーン（鮮やかなオレンジ等）を保ったまま文字だけ濃くしたい場所は
   * accentSolid ではなく `accentFaceBg()` + `accentFaceInk()` を使うこと。
   */
  accentSolid: string;
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
const RAW_IRIS_BACKGROUNDS: IrisBackgroundDef[] = [
  {
    id: 'instagram-soft',
    label: 'Instagram Soft',
    emoji: '',
    background: 'radial-gradient(circle at 15% 20%, #833AB422 0%, transparent 50%), radial-gradient(circle at 85% 80%, #FCB04522 0%, transparent 50%), radial-gradient(circle at 60% 50%, #E1306C22 0%, transparent 45%), linear-gradient(135deg, #FFFAF7 0%, #FFE5EE 50%, #FFF5E5 100%)',
    accent: '#E1306C',
    accentSolid: '#C2185B',
    accentText: '#B81B57',
    ink: '#1F1A2E',          // 黒寄り強化 (もっとはっきり)
    inkSoft: '#3D3247',      // サブも濃く
    card: 'rgba(255,255,255,0.95)',  // ほぼ不透明白
    cardBorder: 'rgba(225,48,108,0.22)',
  },
  {
    id: 'rose-mist',
    label: 'Rose Mist',
    emoji: '',
    background: 'radial-gradient(circle at 20% 30%, #FFB8D633 0%, transparent 55%), radial-gradient(circle at 80% 70%, #FCB04522 0%, transparent 50%), linear-gradient(180deg, #FFFAFB 0%, #FFEBF1 100%)',
    accent: '#E1306C',
    accentSolid: '#C2185B',
    accentText: '#B81B57',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.18)',
  },
  {
    id: 'peach-cream',
    label: 'Peach Cream',
    emoji: '',
    background: 'radial-gradient(circle at 25% 30%, #FCB04533 0%, transparent 50%), radial-gradient(circle at 75% 70%, #FFB8D622 0%, transparent 50%), linear-gradient(135deg, #FFF9F0 0%, #FFE5DC 100%)',
    accent: '#F77737',
    accentSolid: '#B2521F',
    accentText: '#9C4318',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(247,119,55,0.2)',
  },
  {
    id: 'lavender-haze',
    label: 'Lavender Haze',
    emoji: '',
    background: 'radial-gradient(circle at 30% 20%, #B07BD933 0%, transparent 55%), radial-gradient(circle at 70% 80%, #FFB8D622 0%, transparent 50%), linear-gradient(180deg, #FAF5FF 0%, #FFEBF1 100%)',
    accent: '#833AB4',
    accentSolid: '#833AB4',
    accentText: '#833AB4',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(131,58,180,0.18)',
  },
  {
    id: 'sunrise-glow',
    label: 'Sunrise Glow',
    emoji: '',
    background: 'linear-gradient(135deg, #FFE5DC 0%, #FFD4E5 35%, #FFE5EE 70%, #FAF5FF 100%)',
    accent: '#E1306C',
    accentSolid: '#C2185B',
    accentText: '#B81B57',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.2)',
  },
  {
    id: 'cream-classic',
    label: 'Cream Classic',
    emoji: '',
    // 一番安心感のあるニュートラル
    background: 'linear-gradient(180deg, #FFFAF7 0%, #FFF5F8 50%, #FFFAF7 100%)',
    accent: '#E1306C',
    accentSolid: '#C2185B',
    accentText: '#B81B57',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.95)',
    cardBorder: 'rgba(225,48,108,0.15)',
  },
  {
    id: 'neon-night',
    label: 'Neon Night',
    emoji: '',
    // ダーク版 (派手好きの方向け)
    background: 'radial-gradient(circle at 20% 30%, #833AB4cc 0%, transparent 55%), radial-gradient(circle at 80% 70%, #E1306Ccc 0%, transparent 55%), radial-gradient(circle at 60% 50%, #FCB04588 0%, transparent 45%), linear-gradient(135deg, #1A0A26 0%, #2A1A3A 100%)',
    accent: '#FCB045',
    accentSolid: '#FCB045',
    accentText: '#FCB045',
    ink: '#FFFFFF',
    inkSoft: '#FFEAF5',
    card: 'rgba(255,255,255,0.18)',
    cardBorder: 'rgba(252,176,69,0.35)',
  },
  {
    id: 'aurora-soft',
    label: 'Aurora',
    emoji: '',
    // Instagram グラデの主流派生
    background: 'linear-gradient(135deg, #833AB433 0%, #E1306C33 25%, #F7773733 50%, #FCB04533 75%, #FFDC8033 100%), linear-gradient(180deg, #FFFAF7 0%, #FFF5F8 100%)',
    accent: '#E1306C',
    accentSolid: '#C2185B',
    accentText: '#B81B57',
    ink: '#1F1A2E',
    inkSoft: '#3D3247',
    card: 'rgba(255,255,255,0.94)',
    cardBorder: 'rgba(225,48,108,0.2)',
  },
];

/**
 * 「白文字を乗せるベタ塗り」の約束を、テーマの側で必ず守らせる。
 * 画面側は 50 箇所すべてが `background: bg.accentSolid, color: '#fff'` と書いていて、
 * 白が通るかどうかは面を決めるここでしか担保できない（1 箇所ずつ書き手に守らせる約束は必ず漏れる）。
 * すでに通っている色（#C2185B 5.87 等）は素通りするので、見た目が変わるのは落第していた面だけ。
 */
function withSafeSolid<T extends { accent: string; accentSolid?: string }>(b: T): T {
  return { ...b, accentSolid: whiteSafeFace(b.accentSolid || b.accent) };
}

export const IRIS_BACKGROUNDS: IrisBackgroundDef[] = RAW_IRIS_BACKGROUNDS.map(withSafeSolid);

const STORAGE_KEY = 'core_iris_bg_v1';
const CUSTOM_LIST_KEY = 'core_iris_custom_bgs_v1';

/** ユーザー自作の背景 (プリセットと同じ形だが id が "custom-..." で始まる) */
export interface CustomIrisBackground extends Omit<IrisBackgroundDef, 'id'> {
  id: string; // "custom-<uuid>"
  isCustom: true;
}

/** 相対輝度 (WCAG) */
function relLum(hex: string): number {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * 「文字用アクセント」を計算で出す。
 * 自作テーマ（保存済みのものを含む）は accentText を持っていないので、
 * 色相・彩度は保ったまま明るさだけ下げて AA (4.5:1) を満たす、いちばん明るい色を選ぶ。
 * ＝ ブランドの色みは変えずに読めるところまでだけ暗くする。
 * 暗い下地のテーマでは逆に暗くしてはいけないので、そのまま返す。
 */
export function deriveAccentText(accent: string, isDarkTheme: boolean): string {
  try {
    // 暗いテーマは下地が暗いので、アクセントはそのままで読める（暗くしたら逆に消える）
    if (isDarkTheme) return accent;
    // hexToHsl の s / l は 0〜1。ここを 1 刻みで回すと 1 周で終わり、
    // 何も暗くならないまま元の色を返す（＝黙って効かない）。必ず 0.01 刻みで。
    const [h, s, l] = hexToHsl(accent);
    // 基準は純白ではなく、Iris でいちばん明るい「地」(#F6F4EE)。
    // 白で 4.6 を満たしても、わずかに暗い地の上では 4.2 まで落ちて落第する。
    for (let i = l; i >= 0; i -= 0.01) {
      const c = hslToHex(h, s, i);
      if (contrast(c, '#F6F4EE') >= 4.6) return c;
    }
    return accent;
  } catch {
    return accent;
  }
}

/**
 * アクセント色を「面」にして、その上に文字やアイコンを置くときの 面と文字の組。
 * deriveAccentText は「明るい地の上に置く“文字の色”」を出すもので、その逆＝
 * 「色の面の上に置く文字」は誰も守っていなかった。実測(2026-08-05 本番 375px):
 * 白 on リールのピンク #E1306C = 4.34、白 on その他の青 #3B82F6 = 3.68（要 4.5）。
 * さらに面の終端が半透明(`${accent}cc`)だと明るい地が透けてもっと薄くなる（実測 3.88）。
 *
 * 選び方は 2 段階。
 *  ① 色みは変えずに明るさだけ少し(最大 15%)落として白が通るならそれ＝見た目のトーンは保つ。
 *  ② それでも通らない明るい面(オレンジ・黄)は、面を明るいまま残して文字を濃くする。
 *     ここで面を暗くすると、ブランドのオレンジが茶色になってしまう。
 * faceEnd は「文字と反対側」へずらす＝白文字なら濃く、濃い文字なら明るく。
 * グラデーションの終端で contrast が落ちる事故（半透明終端の再来）を防ぐ。
 */
export function onAccentFace(accent: string): { face: string; faceEnd: string; ink: string } {
  const fallback = { face: accent, faceEnd: accent, ink: '#FFFFFF' };
  try {
    const [h, s, l] = hexToHsl(accent);
    const deeper = (base: string) => {
      const [bh, bs, bl] = hexToHsl(base);
      return hslToHex(bh, bs, Math.max(0, bl * 0.88));
    };
    const lighter = (base: string) => {
      const [bh, bs, bl] = hexToHsl(base);
      return hslToHex(bh, bs, Math.min(1, bl * 1.06));
    };
    if (contrast('#FFFFFF', accent) >= 4.6) {
      return { face: accent, faceEnd: deeper(accent), ink: '#FFFFFF' };
    }
    for (let i = l; i >= l * 0.85; i -= 0.01) {
      const c = hslToHex(h, s, i);
      if (contrast('#FFFFFF', c) >= 4.6) return { face: c, faceEnd: deeper(c), ink: '#FFFFFF' };
    }
    for (let i = 0.45; i >= 0; i -= 0.01) {
      const ink = hslToHex(h, Math.min(s, 0.55), i);
      if (contrast(ink, accent) >= 4.6) return { face: accent, faceEnd: lighter(accent), ink };
    }
    return { face: accent, faceEnd: accent, ink: '#141018' };
  } catch {
    return fallback;
  }
}

/**
 * 画面側で毎回書かれていた `linear-gradient(135deg, ${accent}, ${accent}cc)` の置き換え。
 * 終端の `cc`(80%) は下の明るい地が透けて、面がグラデの中で一番薄いところを作る＝
 * そこに白文字が乗ると実測で 3.88 まで落ちていた（2026-08-05 本番計測）。
 * onAccentFace が決めた「文字と反対側へずらした終端」を使うので、面のどこでも読める。
 */
export function accentFaceBg(accent: string, deg: number = 135): string {
  const f = onAccentFace(accent);
  return `linear-gradient(${deg}deg, ${f.face}, ${f.faceEnd})`;
}

/**
 * 「白い文字を乗せる面」の色。色みは変えず、白が 4.6:1 通るまで明るさだけ落とす。
 * onAccentFace と違って濃い文字への逃げ道を持たない＝ 3 色以上のグラデのように
 * 「面の中で明るさが大きく動く」ところで、どの位置でも白が通るようにするために使う。
 */
export function whiteSafeFace(hex: string): string {
  try {
    const [h, s, l] = hexToHsl(hex);
    if (contrast('#FFFFFF', hex) >= 4.6) return hex;
    for (let i = l; i >= 0; i -= 0.005) {
      const c = hslToHex(h, s, i);
      if (contrast('#FFFFFF', c) >= 4.6) return c;
    }
    return hex;
  } catch {
    return hex;
  }
}

/** accentFaceBg の面に乗せる文字色。白が通らない明るい面（オレンジ・黄）では自動で濃い文字になる。 */
export function accentFaceInk(accent: string): string {
  return onAccentFace(accent).ink;
}

/** accentText を持たない古い自作テーマに、計算値を補う（画面側は必ず accentText を読める） */
function withAccentText<T extends { accent: string; accentText?: string; accentSolid?: string; card?: string; ink?: string }>(b: T): T {
  // ink が白＝暗いテーマ、という自作テーマの作られ方に合わせて判定する
  const dark = (b.ink || '').toUpperCase().startsWith('#FFF');
  // accentSolid は「白文字を乗せる面」なので、保存済みの自作テーマも必ず whiteSafeFace を通す。
  // 暗いテーマの既定値がアクセントそのままだったため、明るいアクセント（オレンジ・黄）を選んだ人は
  // ベタ塗りボタンの文字が読めなかった（プリセット Neon Night で白 1.84:1 を本番実測）。
  return {
    ...b,
    accentText: b.accentText || deriveAccentText(b.accent, dark),
    accentSolid: whiteSafeFace(b.accentSolid || b.accent),
  };
}

function loadCustomList(): CustomIrisBackground[] {
  try {
    const r = localStorage.getItem(CUSTOM_LIST_KEY);
    return r ? (JSON.parse(r) as CustomIrisBackground[]).map(withAccentText) : [];
  } catch { return []; }
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
