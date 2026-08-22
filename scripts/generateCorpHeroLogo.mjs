/**
 * /corp ヒーローのロゴ画像を、支給された原画から生成する。
 *
 * 原画 public/corp-hero-logo.webp (1536x1024) は左右 42% / 下 17% が真っ黒な余白で、
 * object-fit:contain がヒーローの枠に合わせて縮めると、ロゴ本体はさらにその 58% しか
 * 残らなかった（375x667 の本番実測で 68x45＝画面幅の 18%）。
 *
 * ここで余白を落とした表示用の trim 版を作る。
 *  - 切り出し box は輝度 >10 の外接矩形 x[300,1195] y[40,838] に余裕を足した値
 *  - 下端は水面反射が「下へ行くほど明るくなる」ため、切っただけだと
 *    真っ黒な section の上に明るい横線が出る（実測: 最下行 mean RGB 21/41/60）。
 *    最後の FADE_PX を黒へ落として継ぎ目を消す。
 *
 * 実行: node scripts/generateCorpHeroLogo.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'public/corp-hero-logo.webp');
const OUT = path.join(root, 'public/corp-hero-logo-trim.webp');

const CROP = { left: 272, top: 10, width: 952, height: 868 };
const FADE_PX = 46; // ワードマーク下端(≈y822)から下端までを黒へ

const { data, info } = await sharp(SRC)
  .extract(CROP)
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const fadeStart = height - FADE_PX;
for (let y = fadeStart; y < height; y++) {
  // smoothstep で 1 → 0。線形だと減衰の開始点そのものが線に見える。
  const t = (y - fadeStart) / FADE_PX;
  const k = 1 - t * t * (3 - 2 * t);
  const row = y * width * channels;
  for (let i = row; i < row + width * channels; i++) data[i] = Math.round(data[i] * k);
}

await sharp(data, { raw: { width, height, channels } })
  .webp({ quality: 90, effort: 6 })
  .toFile(OUT);

const out = await sharp(OUT).stats();
console.log(`wrote ${path.relative(root, OUT)} ${width}x${height} (aspect ${(width / height).toFixed(3)})`);
console.log('channel max:', out.channels.map(c => c.max).join(','));
