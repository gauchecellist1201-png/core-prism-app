// ============================================================
// IRIS ▸ Reel Visual Presets — 4 種類 (1 タップで切替)
//   - 教える系 (白背景 + ゴシック大文字 + 例示アイコン)
//   - ストーリー系 (写真重ね + 手書き風フォント + フェード)
//   - ニュース系 (黒背景 + 黄色アクセント + ティッカー風下部バー)
//   - Q&A 系 (質問 → 余白 → 答え の 3 部構成)
// ============================================================

export type PresetId =
  | 'teach' | 'story' | 'news' | 'qa'
  | 'beauty' | 'food' | 'fashion' | 'luxury' | 'travel' | 'fitness'
  | 'cute' | 'retro' | 'minimal' | 'viral' | 'sale' | 'real';

export interface ReelPreset {
  id: PresetId;
  label: string;
  emoji: string;
  /** キャンバスの背景色 (素材の上にオーバーレイされる時用、または素材がない時の地色) */
  bg: string;
  /** 字幕フォント */
  captionFont: string;
  /** 字幕サイズ (1080x1920 基準) */
  captionSize: number;
  /** 字幕色 */
  captionColor: string;
  /** ストローク色 */
  captionStroke: string;
  /** ストローク幅 */
  captionStrokeWidth: number;
  /** 字幕の縦位置 (0=上 〜 1=下) */
  captionY: number;
  /** アクセント色 (バー、装飾等) */
  accent: string;
  /** 短いタグライン (ユーザー説明用) */
  tagline: string;
  /** 下部バー (ニュース系のティッカー等)。null なら描画しない */
  lowerBar?: { color: string; height: number; tickerText?: string };
  /** 全カットに掛けるオーバーレイ (例: 教える系の白背景半透明) */
  overlay?: { color: string; alpha: number };
  /** 上部にアクセント帯を出すか (未指定は news/story のみ = 既存挙動を維持) */
  accentTopBar?: boolean;
  /** 業種・雰囲気のグループ (ピッカーの並び/絞り込み用) */
  group: '定番' | '美容・ライフ' | 'グルメ・店舗' | 'モード・高級' | 'バズ・告知';
  /** デフォルトのカット秒数 */
  defaultDuration: number;
  /** 切替トランジション */
  transition: 'fade' | 'cut' | 'dissolve';
}

export const REEL_PRESETS: ReelPreset[] = [
  {
    id: 'teach',
    label: '教える系',
    emoji: '🎓',
    bg: '#FFFFFF',
    captionFont: '"Dela Gothic One", "Noto Sans JP", sans-serif',
    captionSize: 72,
    captionColor: '#0F172A',
    captionStroke: '#FFFFFF',
    captionStrokeWidth: 8,
    captionY: 0.42,
    accent: '#2563EB',
    tagline: '白背景・ゴシック大文字・読みやすさ最優先',
    overlay: { color: '#FFFFFF', alpha: 0.55 },
    group: '定番',
    defaultDuration: 4.5,
    transition: 'cut',
  },
  {
    id: 'story',
    label: 'ストーリー系',
    emoji: '📖',
    bg: '#1F1A2E',
    captionFont: '"Klee One", "Shippori Mincho", serif',
    captionSize: 56,
    captionColor: '#FFF8F0',
    captionStroke: '#3B2A2A',
    captionStrokeWidth: 4,
    captionY: 0.78,
    accent: '#E1306C',
    tagline: '写真重ね・手書き風・しっとりフェード',
    group: '定番',
    defaultDuration: 5.5,
    transition: 'fade',
  },
  {
    id: 'news',
    label: 'ニュース系',
    emoji: '📰',
    bg: '#0A0A0F',
    captionFont: '"Bebas Neue", "Noto Sans JP", sans-serif',
    captionSize: 64,
    captionColor: '#FFFFFF',
    captionStroke: '#000000',
    captionStrokeWidth: 5,
    captionY: 0.5,
    accent: '#FACC15',
    tagline: '黒背景・黄色アクセント・下部ティッカー',
    lowerBar: { color: '#FACC15', height: 96, tickerText: 'BREAKING' },
    group: '定番',
    defaultDuration: 4.0,
    transition: 'cut',
  },
  {
    id: 'qa',
    label: 'Q&A 系',
    emoji: '❓',
    bg: '#FEF3C7',
    captionFont: '"Noto Sans JP", sans-serif',
    captionSize: 60,
    captionColor: '#1F2937',
    captionStroke: '#FEF3C7',
    captionStrokeWidth: 6,
    captionY: 0.5,
    accent: '#F59E0B',
    tagline: '質問 → 余白 → 答え の 3 部構成',
    overlay: { color: '#FEF3C7', alpha: 0.4 },
    group: '定番',
    defaultDuration: 5.0,
    transition: 'dissolve',
  },

  // ── 美容・ライフ ─────────────────────────────
  {
    id: 'beauty',
    label: '美容・コスメ',
    emoji: '🌹',
    bg: '#FFF1F3',
    captionFont: '"Shippori Mincho", serif',
    captionSize: 56,
    captionColor: '#7A3B4E',
    captionStroke: '#FFFFFF',
    captionStrokeWidth: 6,
    captionY: 0.74,
    accent: '#D98BA0',
    tagline: 'ローズ基調・上品な明朝・美容/コスメ/サロン向け',
    overlay: { color: '#FFE4EA', alpha: 0.28 },
    group: '美容・ライフ',
    defaultDuration: 5.0,
    transition: 'dissolve',
  },
  {
    id: 'cute',
    label: 'かわいい',
    emoji: '🎀',
    bg: '#FFF6FB',
    captionFont: '"Klee One", "Noto Sans JP", sans-serif',
    captionSize: 60,
    captionColor: '#C6528E',
    captionStroke: '#FFFFFF',
    captionStrokeWidth: 8,
    captionY: 0.68,
    accent: '#F7A8D0',
    tagline: 'パステル・丸文字・ゆるふわ/推し活/かわいい系',
    overlay: { color: '#FDE7F3', alpha: 0.22 },
    group: '美容・ライフ',
    defaultDuration: 4.5,
    transition: 'dissolve',
  },
  {
    id: 'minimal',
    label: 'ミニマル',
    emoji: '◽',
    bg: '#F5F3EF',
    captionFont: '"Noto Sans JP", sans-serif',
    captionSize: 46,
    captionColor: '#2A2A28',
    captionStroke: '#F5F3EF',
    captionStrokeWidth: 4,
    captionY: 0.88,
    accent: '#9A9284',
    tagline: '余白たっぷり・細字・上質でミニマルな世界観',
    group: '美容・ライフ',
    defaultDuration: 5.0,
    transition: 'fade',
  },
  {
    id: 'real',
    label: '日常Vlog',
    emoji: '🌿',
    bg: '#17130E',
    captionFont: '"Noto Sans JP", sans-serif',
    captionSize: 50,
    captionColor: '#FFFFFF',
    captionStroke: '#17130E',
    captionStrokeWidth: 5,
    captionY: 0.8,
    accent: '#B8A98C',
    tagline: 'ナチュラル・等身大・日常/ルーティン/暮らし',
    group: '美容・ライフ',
    defaultDuration: 4.0,
    transition: 'fade',
  },

  // ── グルメ・店舗 ─────────────────────────────
  {
    id: 'food',
    label: 'グルメ・カフェ',
    emoji: '🍰',
    bg: '#2A1D14',
    captionFont: '"Klee One", "Noto Sans JP", sans-serif',
    captionSize: 56,
    captionColor: '#FFF4E6',
    captionStroke: '#3A2417',
    captionStrokeWidth: 5,
    captionY: 0.78,
    accent: '#E8A552',
    tagline: '温かみ・手書き風・カフェ/飲食/スイーツ向け',
    group: 'グルメ・店舗',
    defaultDuration: 4.5,
    transition: 'fade',
  },
  {
    id: 'retro',
    label: 'レトロ・エモい',
    emoji: '🎞️',
    bg: '#241E1A',
    captionFont: '"Shippori Mincho", serif',
    captionSize: 52,
    captionColor: '#EAD9C0',
    captionStroke: '#1A1510',
    captionStrokeWidth: 4,
    captionY: 0.76,
    accent: '#C08457',
    tagline: 'くすみ・フィルム調・エモい思い出/旅の記録',
    group: 'グルメ・店舗',
    defaultDuration: 5.5,
    transition: 'fade',
  },
  {
    id: 'travel',
    label: '旅・風景',
    emoji: '🏝️',
    bg: '#0E1420',
    captionFont: '"Noto Serif JP", serif',
    captionSize: 54,
    captionColor: '#FFFFFF',
    captionStroke: '#0A0F18',
    captionStrokeWidth: 5,
    captionY: 0.82,
    accent: '#6FB3C9',
    tagline: 'シネマ調・風景/旅行/絶景リール向け',
    group: 'グルメ・店舗',
    defaultDuration: 5.0,
    transition: 'fade',
  },

  // ── モード・高級 ─────────────────────────────
  {
    id: 'fashion',
    label: 'ファッション',
    emoji: '🖤',
    bg: '#111111',
    captionFont: '"Bebas Neue", "Noto Sans JP", sans-serif',
    captionSize: 66,
    captionColor: '#FFFFFF',
    captionStroke: '#000000',
    captionStrokeWidth: 4,
    captionY: 0.86,
    accent: '#FFFFFF',
    tagline: 'モノクロ・洗練・ファッション/ルックブック',
    group: 'モード・高級',
    defaultDuration: 3.5,
    transition: 'cut',
  },
  {
    id: 'luxury',
    label: '高級・ラグジュアリー',
    emoji: '👑',
    bg: '#0B0B0C',
    captionFont: '"Noto Serif JP", serif',
    captionSize: 54,
    captionColor: '#E7CF9B',
    captionStroke: '#000000',
    captionStrokeWidth: 4,
    captionY: 0.5,
    accent: '#C9A24B',
    tagline: '黒×ゴールド・明朝・高級/宝飾/上質サービス',
    accentTopBar: true,
    group: 'モード・高級',
    defaultDuration: 5.0,
    transition: 'dissolve',
  },

  // ── バズ・告知 ─────────────────────────────
  {
    id: 'fitness',
    label: '筋トレ・ダイエット',
    emoji: '🔥',
    bg: '#0A0A0A',
    captionFont: '"Dela Gothic One", "Noto Sans JP", sans-serif',
    captionSize: 68,
    captionColor: '#E6FF3A',
    captionStroke: '#000000',
    captionStrokeWidth: 7,
    captionY: 0.5,
    accent: '#E6FF3A',
    tagline: '力強い・ネオン・筋トレ/ダイエット/ジム向け',
    group: 'バズ・告知',
    defaultDuration: 2.5,
    transition: 'cut',
  },
  {
    id: 'viral',
    label: 'バズ狙い',
    emoji: '⚡',
    bg: '#000000',
    captionFont: '"Dela Gothic One", "Noto Sans JP", sans-serif',
    captionSize: 76,
    captionColor: '#FFEC3D',
    captionStroke: '#000000',
    captionStrokeWidth: 8,
    captionY: 0.42,
    accent: '#FF2D55',
    tagline: '特大・黄×黒・ハイテンポでバズを狙う',
    accentTopBar: true,
    group: 'バズ・告知',
    defaultDuration: 2.0,
    transition: 'cut',
  },
  {
    id: 'sale',
    label: 'セール・告知',
    emoji: '📣',
    bg: '#B4121B',
    captionFont: '"Dela Gothic One", "Noto Sans JP", sans-serif',
    captionSize: 64,
    captionColor: '#FFFFFF',
    captionStroke: '#6E0A10',
    captionStrokeWidth: 6,
    captionY: 0.5,
    accent: '#FFE14D',
    tagline: '赤×白・緊急感・セール/キャンペーン/イベント告知',
    lowerBar: { color: '#FFE14D', height: 96, tickerText: 'SALE' },
    group: 'バズ・告知',
    defaultDuration: 3.0,
    transition: 'cut',
  },
];

export function getPreset(id: PresetId | null | undefined): ReelPreset | null {
  if (!id) return null;
  return REEL_PRESETS.find(p => p.id === id) || null;
}

/** プリセットに応じて、Q&A 系なら 3 シーンの字幕を [質問, "...", 答え] の形に整える */
export function applyQaPattern(captions: string[]): string[] {
  if (captions.length < 3) return captions;
  return [
    captions[0].endsWith('?') || captions[0].endsWith('？') ? captions[0] : captions[0] + '？',
    '…',
    captions[2],
  ];
}

/** Canvas にプリセットの装飾を描画する (背景オーバーレイ + 下部バー) */
export function drawPresetDecorations(
  ctx: CanvasRenderingContext2D,
  preset: ReelPreset,
  canvasW: number,
  canvasH: number,
  time: number,
) {
  // 全画面オーバーレイ
  if (preset.overlay) {
    ctx.save();
    ctx.globalAlpha = preset.overlay.alpha;
    ctx.fillStyle = preset.overlay.color;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  }
  // 下部バー (ニュース系のティッカー)
  if (preset.lowerBar) {
    const lb = preset.lowerBar;
    const scaledH = lb.height * (canvasW / 1080);
    const y = canvasH - scaledH;
    ctx.save();
    ctx.fillStyle = lb.color;
    ctx.fillRect(0, y, canvasW, scaledH);
    if (lb.tickerText) {
      ctx.fillStyle = '#0A0A0F';
      ctx.font = `900 ${scaledH * 0.55}px "Bebas Neue", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // 流れるティッカー (時間に応じて左へスクロール)
      const text = lb.tickerText + '  •  ';
      const measure = ctx.measureText(text).width;
      const offset = (time * 80 * (canvasW / 1080)) % measure;
      let x = -offset;
      while (x < canvasW) {
        ctx.fillText(text, x, y + scaledH / 2);
        x += measure;
      }
    }
    ctx.restore();
  }
  // アクセント帯 (上部 8px) — 既定は news/story、新テーマは accentTopBar で任意に
  if (preset.accentTopBar ?? (preset.id === 'news' || preset.id === 'story')) {
    ctx.save();
    ctx.fillStyle = preset.accent;
    ctx.fillRect(0, 0, canvasW, 8 * (canvasW / 1080));
    ctx.restore();
  }
}

/** プリセットに応じた背景塗りつぶし (素材が無い時 or 素材未ロード時) */
export function drawPresetBackground(
  ctx: CanvasRenderingContext2D,
  preset: ReelPreset | null,
  canvasW: number,
  canvasH: number,
) {
  ctx.fillStyle = preset?.bg || '#0a0a0f';
  ctx.fillRect(0, 0, canvasW, canvasH);
}
