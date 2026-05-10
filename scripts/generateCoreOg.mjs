// ============================================================
// CORE 法人サイト OG 画像 (1200x630) を SVG → PNG で生成
// 出力: public/og-core.png + public/core-icon.svg + core-{192,512,180}.png
// 仕様: SNS 共有時に違和感が出ないよう、白背景＋ロゴのみのクリーン設計
// ============================================================
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// CORE ロゴ単体 SVG (透過、アイコン用)
const CORE_ICON_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='1024' height='1024'>
  <defs>
    <linearGradient id='ring' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#0EA5E9'/>
      <stop offset='50%' stop-color='#38BDF8'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </linearGradient>
    <radialGradient id='core' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='55%' stop-color='#7DD3FC'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </radialGradient>
  </defs>
  <g stroke='url(#ring)' fill='none' stroke-linecap='round' stroke-linejoin='round'>
    <circle cx='50' cy='50' r='44' stroke-width='3.4'/>
    <circle cx='50' cy='50' r='28' stroke-width='2.4'/>
    <circle cx='50' cy='50' r='12' stroke-width='1.8'/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
      const rad = (deg * Math.PI) / 180;
      const x1 = 50 + Math.cos(rad) * 44;
      const y1 = 50 + Math.sin(rad) * 44;
      const x2 = 50 + Math.cos(rad) * 12;
      const y2 = 50 + Math.sin(rad) * 12;
      return `<line x1='${x1.toFixed(2)}' y1='${y1.toFixed(2)}' x2='${x2.toFixed(2)}' y2='${y2.toFixed(2)}' stroke-width='1.6'/>`;
    }).join('')}
  </g>
  <circle cx='50' cy='50' r='7' fill='url(#core)'/>
  <circle cx='48' cy='47' r='2.2' fill='#FFFFFF' opacity='0.85'/>
</svg>
`;

// OG 画像 — 白背景にロゴだけ。SNS で違和感ゼロ
const CORE_OG_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 630' width='1200' height='630'>
  <defs>
    <linearGradient id='ring' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#0EA5E9'/>
      <stop offset='50%' stop-color='#38BDF8'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </linearGradient>
    <radialGradient id='core' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='55%' stop-color='#7DD3FC'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </radialGradient>
  </defs>

  <!-- 純白背景 -->
  <rect width='1200' height='630' fill='#FFFFFF'/>

  <!-- 中央配置のロゴ (350×350) -->
  <g transform='translate(425 80) scale(3.5)'>
    <g stroke='url(#ring)' fill='none' stroke-linecap='round' stroke-linejoin='round'>
      <circle cx='50' cy='50' r='44' stroke-width='3.4'/>
      <circle cx='50' cy='50' r='28' stroke-width='2.4'/>
      <circle cx='50' cy='50' r='12' stroke-width='1.8'/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 50 + Math.cos(rad) * 44;
        const y1 = 50 + Math.sin(rad) * 44;
        const x2 = 50 + Math.cos(rad) * 12;
        const y2 = 50 + Math.sin(rad) * 12;
        return `<line x1='${x1.toFixed(2)}' y1='${y1.toFixed(2)}' x2='${x2.toFixed(2)}' y2='${y2.toFixed(2)}' stroke-width='1.6'/>`;
      }).join('')}
    </g>
    <circle cx='50' cy='50' r='7' fill='url(#core)'/>
    <circle cx='48' cy='47' r='2.2' fill='#FFFFFF' opacity='0.85'/>
  </g>

  <!-- ワードマーク -->
  <text x='600' y='510' font-family='Cinzel, Noto Serif JP, serif' font-size='72' font-weight='700' letter-spacing='28' fill='#0F172A' text-anchor='middle'>
    CORE
  </text>
  <text x='600' y='560' font-family='Noto Serif JP, serif' font-size='20' font-weight='400' fill='#64748B' letter-spacing='4' text-anchor='middle'>
    すべての時代の、核となるものを。
  </text>
</svg>
`;

async function main() {
  // 1) アイコン SVG (透過、シャープな線)
  writeFileSync(path.join(PUBLIC, 'core-icon.svg'), CORE_ICON_SVG);
  console.log('✓ core-icon.svg');

  // 2) PNG アイコン (透過 PNG / 192,512,180)
  for (const size of [192, 512, 180]) {
    const buf = await sharp(Buffer.from(CORE_ICON_SVG), { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeFileSync(path.join(PUBLIC, `core-${size}.png`), buf);
    console.log(`✓ core-${size}.png (透過)`);
  }

  // 3) OG 画像 (1200x630 白背景)
  const og = await sharp(Buffer.from(CORE_OG_SVG))
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path.join(PUBLIC, 'og-core.png'), og);
  console.log('✓ og-core.png (1200x630, 白背景)');

  console.log('\n生成完了');
}

main().catch(e => { console.error(e); process.exit(1); });
