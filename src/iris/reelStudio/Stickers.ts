// ============================================================
// Stickers.ts — Lucide アイコン / 矢印 / 吹き出し / 絵文字オーバーレイ
//
// Captions と同じく時間軸上に配置できるビジュアル要素。
// CapCut の「ステッカー」相当。
// 絵文字 NG ルール (オーナー指示) のため、Lucide アイコン + 矩形を使う
// ============================================================

export type StickerAnim = 'none' | 'pop' | 'shake' | 'spin' | 'bounce';

export type StickerKind =
  | 'icon'      // Lucide-like SVG path
  | 'arrow'    // 矢印
  | 'bubble'   // 吹き出し (text 付き)
  | 'badge';   // バッジ (text 付き)

export interface StickerInstance {
  id: string;
  kind: StickerKind;
  /** icon の場合は IconId, bubble/badge の場合は表示テキスト, arrow は方向 */
  payload: string;
  /** 表示開始秒 */
  start: number;
  /** 表示終了秒 */
  end: number;
  /** 中心の正規化座標 (0-1) */
  x: number;
  y: number;
  /** サイズ (OUT_W 基準の px。typical 80-300) */
  size: number;
  /** 回転 (度) */
  rotation: number;
  /** 色 */
  color: string;
  /** アニメーション */
  anim: StickerAnim;
}

/** Lucide 風アイコンを Path で持つ。size 24 viewBox の path d */
export interface IconDef {
  id: string;
  label: string;
  /** path の d 属性。viewBox 24 */
  d: string;
  /** Path2D キャッシュ */
  _p?: Path2D;
}

/** よく使われる 40 種を厳選 (Lucide v0 系の標準 path) */
export const STICKER_ICONS: IconDef[] = [
  { id: 'heart', label: 'ハート', d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { id: 'star', label: 'スター', d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'fire', label: 'ファイア', d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.25-2.5-.5-5 1-6 .5 2.5 2 4.06 4 5.5 2 1.44 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' },
  { id: 'sparkles', label: 'キラキラ', d: 'M9.94 14.06 6 18l3.94 3.94L18 14l-3.94-3.94L18 6.06 14.06 2.12 6 10.12l3.94 3.94zM20 3v4M22 5h-4M4 17v2M5 18H3' },
  { id: 'crown', label: 'クラウン', d: 'M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14' },
  { id: 'thumbsup', label: 'いいね', d: 'M7 22V11M2 13v7a2 2 0 0 0 2 2h13.7a2 2 0 0 0 2-1.7l1.4-9A2 2 0 0 0 19.1 9H14V4a2 2 0 0 0-2-2l-3 8v12z' },
  { id: 'message', label: 'コメント', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'bookmark', label: '保存', d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
  { id: 'check', label: 'チェック', d: 'M20 6L9 17l-5-5' },
  { id: 'x', label: 'バツ', d: 'M18 6L6 18M6 6l12 12' },
  { id: 'alert', label: '注意', d: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
  { id: 'info', label: 'インフォ', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01' },
  { id: 'zap', label: 'ライトニング', d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { id: 'eye', label: 'アイ', d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'camera', label: 'カメラ', d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'music', label: 'ミュージック', d: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { id: 'gift', label: 'ギフト', d: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' },
  { id: 'rocket', label: 'ロケット', d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' },
  { id: 'gem', label: 'ジェム', d: 'M6 3h12l4 6-10 13L2 9l4-6zM11 3 8 9l4 13 4-13-3-6M2 9h20' },
  { id: 'target', label: 'ターゲット', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { id: 'trophy', label: 'トロフィー', d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z' },
  { id: 'lightbulb', label: 'アイデア', d: 'M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z' },
  { id: 'clock', label: 'クロック', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2' },
  { id: 'tag', label: 'タグ', d: 'M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01' },
  { id: 'shoppingbag', label: 'バッグ', d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 1 1-8 0' },
  { id: 'mappin', label: 'ピン', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'phone', label: 'フォン', d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
  { id: 'mail', label: 'メール', d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6 12 13 2 6' },
  { id: 'globe', label: 'グローブ', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' },
  { id: 'play', label: 'プレイ', d: 'M5 3l14 9-14 9V3z' },
  { id: 'plus', label: 'プラス', d: 'M12 5v14M5 12h14' },
  { id: 'minus', label: 'マイナス', d: 'M5 12h14' },
  { id: 'arrowup', label: '上矢印', d: 'M12 19V5M5 12l7-7 7 7' },
  { id: 'arrowdown', label: '下矢印', d: 'M12 5v14M19 12l-7 7-7-7' },
  { id: 'arrowleft', label: '左矢印', d: 'M19 12H5M12 19l-7-7 7-7' },
  { id: 'arrowright', label: '右矢印', d: 'M5 12h14M12 5l7 7-7 7' },
  { id: 'leaf', label: 'リーフ', d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1 6.7 1.8 17.04-8.2 17.04zM2 21c0-3 1.85-5.36 5.08-6' },
  { id: 'snowflake', label: 'スノー', d: 'M2 12h20M12 2v20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07' },
  { id: 'sun', label: 'サン', d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' },
  { id: 'moon', label: 'ムーン', d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' },
];

export const STICKER_ANIMS: { id: StickerAnim; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'pop', label: 'ポップ' },
  { id: 'shake', label: 'シェイク' },
  { id: 'spin', label: 'スピン' },
  { id: 'bounce', label: 'バウンス' },
];

/** Path2D を遅延キャッシュ */
function getPath(icon: IconDef): Path2D {
  if (!icon._p) icon._p = new Path2D(icon.d);
  return icon._p;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** ステッカーをキャンバスに描く。globalT は再生秒 */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  st: StickerInstance,
  globalT: number,
  W: number,
  H: number,
) {
  if (globalT < st.start || globalT > st.end) return;
  const localT = (globalT - st.start) / Math.max(0.01, st.end - st.start);

  // アニメ補正
  let scale = 1;
  let rot = st.rotation * Math.PI / 180;
  let dy = 0;
  switch (st.anim) {
    case 'pop': {
      const popT = Math.min(1, localT * 4);  // 入場 0.25 秒
      scale = easeOutBack(popT);
      break;
    }
    case 'shake': {
      const phase = (globalT - st.start) * 20;
      rot += Math.sin(phase) * 0.08;
      break;
    }
    case 'spin': {
      rot += (globalT - st.start) * Math.PI * 2 * 0.4;
      break;
    }
    case 'bounce': {
      const phase = (globalT - st.start) * 4;
      dy = -Math.abs(Math.sin(phase)) * st.size * 0.15;
      break;
    }
  }

  const cx = st.x * W;
  const cy = st.y * H + dy;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = st.color;
  ctx.strokeStyle = st.color;

  if (st.kind === 'icon' || st.kind === 'arrow') {
    let iconId = st.payload;
    if (st.kind === 'arrow') {
      // arrow 方向: up/down/left/right
      const map: Record<string, string> = {
        up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright',
      };
      iconId = map[st.payload] || 'arrowright';
    }
    const icon = STICKER_ICONS.find(i => i.id === iconId) || STICKER_ICONS[0];
    const p = getPath(icon);
    const s = st.size / 24;
    ctx.scale(s, s);
    ctx.translate(-12, -12);
    // ストロークアイコンとして描く
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 一部 (heart/star) は塗り。それ以外はストローク
    if (iconId === 'heart' || iconId === 'star') {
      ctx.fill(p);
    } else {
      ctx.stroke(p);
    }
  } else if (st.kind === 'bubble') {
    // 角丸の吹き出し + テキスト
    const text = st.payload;
    ctx.font = `bold ${st.size * 0.42}px "Noto Sans JP", "Inter", sans-serif`;
    const metrics = ctx.measureText(text);
    const padX = st.size * 0.3;
    const padY = st.size * 0.22;
    const wBox = metrics.width + padX * 2;
    const hBox = st.size * 0.6 + padY * 2;
    ctx.fillStyle = st.color;
    roundRect(ctx, -wBox / 2, -hBox / 2, wBox, hBox, hBox / 3);
    ctx.fill();
    // しっぽ
    ctx.beginPath();
    ctx.moveTo(-hBox * 0.25, hBox / 2);
    ctx.lineTo(0, hBox / 2 + hBox * 0.35);
    ctx.lineTo(hBox * 0.05, hBox / 2);
    ctx.closePath();
    ctx.fill();
    // text
    ctx.fillStyle = '#1F1A2E';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
  } else if (st.kind === 'badge') {
    const text = st.payload;
    ctx.font = `900 ${st.size * 0.5}px "Noto Sans JP", "Inter", sans-serif`;
    const metrics = ctx.measureText(text);
    const padX = st.size * 0.25;
    const padY = st.size * 0.18;
    const wBox = metrics.width + padX * 2;
    const hBox = st.size * 0.7 + padY * 2;
    // 背景
    ctx.fillStyle = st.color;
    roundRect(ctx, -wBox / 2, -hBox / 2, wBox, hBox, 8);
    ctx.fill();
    // 太いアウトライン
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    roundRect(ctx, -wBox / 2, -hBox / 2, wBox, hBox, 8);
    ctx.stroke();
    // text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function makeStickerId(): string {
  return 'st_' + Math.random().toString(36).slice(2, 10);
}
