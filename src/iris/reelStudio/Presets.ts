// ============================================================
// IRIS ▸ Reel Visual Presets — 4 種類 (1 タップで切替)
//   - 教える系 (白背景 + ゴシック大文字 + 例示アイコン)
//   - ストーリー系 (写真重ね + 手書き風フォント + フェード)
//   - ニュース系 (黒背景 + 黄色アクセント + ティッカー風下部バー)
//   - Q&A 系 (質問 → 余白 → 答え の 3 部構成)
// ============================================================

export type PresetId = 'teach' | 'story' | 'news' | 'qa';

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
    defaultDuration: 5.0,
    transition: 'dissolve',
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
  // アクセント帯 (上部 6px) — 教える/Q&A 以外で 強調
  if (preset.id === 'news' || preset.id === 'story') {
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
