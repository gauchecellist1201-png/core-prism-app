// ============================================================
// BgRemove.ts — 画像の背景除去 (依存ゼロ・完全クライアント)
//
// CapCut の「背景除去」相当。重い AI モデルは使わず、
// 画像の縁から優勢な色をサンプルし、その色に近い画素を α=0 にする
// シンプルなアルゴリズムで「白背景の商品写真」「単色背景のポートレート」
// 等で実用的に動く。透過 PNG の blob:URL を返す。
// ============================================================

export interface BgRemoveOptions {
  /** RGB 距離の許容しきい値 (0-255 平方距離。デフォルト 48*48=2304) */
  tolerance?: number;
  /** 縁から何 px サンプリングするか (デフォルト 4) */
  edgeSamplePx?: number;
  /** 半透明にする境界帯 px (0=ハード, 4=羽毛) */
  feather?: number;
}

interface ColorSample { r: number; g: number; b: number }

function sampleEdgeColor(data: Uint8ClampedArray, w: number, h: number, edge: number): ColorSample {
  // 縁画素を集めて最頻色帯 (16-bin) の平均を取る
  const buckets = new Map<string, { sum: ColorSample; n: number }>();
  const push = (i: number) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(k);
    if (cur) { cur.sum.r += r; cur.sum.g += g; cur.sum.b += b; cur.n++; }
    else buckets.set(k, { sum: { r, g, b }, n: 1 });
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= edge && x < w - edge && y >= edge && y < h - edge) continue;
      push((y * w + x) * 4);
    }
  }
  let best: { sum: ColorSample; n: number } | undefined;
  for (const v of buckets.values()) {
    if (!best || v.n > best.n) best = v;
  }
  if (!best) return { r: 255, g: 255, b: 255 };
  return { r: best.sum.r / best.n, g: best.sum.g / best.n, b: best.sum.b / best.n };
}

export async function removeBackgroundFromUrl(srcUrl: string, opts: BgRemoveOptions = {}): Promise<{ blobUrl: string }> {
  const tol = opts.tolerance ?? 2304; // 48^2
  const edge = opts.edgeSamplePx ?? 4;
  const feather = Math.max(0, opts.feather ?? 3);

  const img = await loadImage(srcUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = id.data;
  const W = canvas.width, H = canvas.height;
  const bg = sampleEdgeColor(data, W, H, Math.min(edge, Math.floor(Math.min(W, H) / 8)));
  const tolFeather = tol * (1 + feather * 0.4);

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bg.r;
    const dg = data[i + 1] - bg.g;
    const db = data[i + 2] - bg.b;
    const d2 = dr * dr + dg * dg + db * db;
    if (d2 < tol) {
      data[i + 3] = 0;
    } else if (d2 < tolFeather) {
      // 羽毛: 線形 α
      const t = (d2 - tol) / (tolFeather - tol);
      data[i + 3] = Math.round(t * data[i + 3]);
    }
  }
  ctx.putImageData(id, 0, 0);
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
  return { blobUrl: URL.createObjectURL(blob) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image load failed'));
    im.src = src;
  });
}
