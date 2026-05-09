// ============================================================
// PWA アイコン生成: Prism / Iris ブランド別
// 入力: public/prism-icon.svg (Prism 多面体プリズム)
//       public/iris-flower.svg (Iris 花)
// 出力: 192 / 512 / 180 (apple-touch) / 192-maskable / 512-maskable
// ============================================================
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const TARGETS = [
  // ─── Prism ─────────────────────────────────────
  { src: 'prism-icon.svg', out: 'prism-192.png', size: 192, bg: { r: 7, g: 7, b: 18, alpha: 1 } },
  { src: 'prism-icon.svg', out: 'prism-512.png', size: 512, bg: { r: 7, g: 7, b: 18, alpha: 1 } },
  { src: 'prism-icon.svg', out: 'prism-180.png', size: 180, bg: { r: 7, g: 7, b: 18, alpha: 1 } },
  { src: 'prism-icon.svg', out: 'prism-maskable-512.png', size: 512, bg: { r: 7, g: 7, b: 18, alpha: 1 }, padding: 0.18 },
  // ─── Iris ─────────────────────────────────────
  { src: 'iris-flower.svg', out: 'iris-192.png', size: 192, bg: { r: 26, g: 10, b: 38, alpha: 1 } },
  { src: 'iris-flower.svg', out: 'iris-512.png', size: 512, bg: { r: 26, g: 10, b: 38, alpha: 1 } },
  { src: 'iris-flower.svg', out: 'iris-180.png', size: 180, bg: { r: 26, g: 10, b: 38, alpha: 1 } },
  { src: 'iris-flower.svg', out: 'iris-maskable-512.png', size: 512, bg: { r: 26, g: 10, b: 38, alpha: 1 }, padding: 0.18 },
];

async function main() {
  for (const t of TARGETS) {
    const srcPath = path.join(PUBLIC, t.src);
    if (!existsSync(srcPath)) {
      console.warn(`✗ skip (no source): ${t.src}`);
      continue;
    }
    const svg = readFileSync(srcPath);
    const padding = t.padding || 0.08;
    const innerSize = Math.round(t.size * (1 - padding * 2));
    const offset = Math.round((t.size - innerSize) / 2);

    // 1) 内側サイズで SVG をラスタライズ
    const inner = await sharp(svg, { density: 384 })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // 2) 背景色のキャンバスに合成 (角を丸めるとマスカブルが綺麗)
    const composed = await sharp({
      create: {
        width: t.size,
        height: t.size,
        channels: 4,
        background: t.bg,
      },
    })
      .composite([{ input: inner, top: offset, left: offset }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    writeFileSync(path.join(PUBLIC, t.out), composed);
    console.log(`✓ ${t.out} (${t.size}x${t.size})`);
  }
  console.log('\n生成完了');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
