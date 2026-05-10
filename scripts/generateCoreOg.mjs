// ============================================================
// CORE 法人サイト OG 画像 (1200x630) を SVG → PNG で生成
// 出力: public/og-core.png + public/core-icon.svg + core-{192,512,180}.png
// ============================================================
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// CORE ロゴ単体 SVG (アイコン用) — 同心円 + 8 本スポーク + 中央発光核
const CORE_ICON_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='1024' height='1024'>
  <defs>
    <linearGradient id='ring' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#7DD3FC'/>
      <stop offset='50%' stop-color='#E0F2FE'/>
      <stop offset='100%' stop-color='#38BDF8'/>
    </linearGradient>
    <radialGradient id='core' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='55%' stop-color='#BAE6FD'/>
      <stop offset='100%' stop-color='#0EA5E9'/>
    </radialGradient>
    <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
      <feGaussianBlur stdDeviation='1.4' result='b'/>
      <feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>
    </filter>
  </defs>
  <rect width='100' height='100' fill='#0a0e1a'/>
  <g stroke='url(#ring)' fill='none' stroke-linecap='round' stroke-linejoin='round' filter='url(#glow)'>
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

// OG 画像 (1200x630) — ロゴ中央 + テキスト + グロー背景
const CORE_OG_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 630' width='1200' height='630'>
  <defs>
    <radialGradient id='bg' cx='50%' cy='50%' r='70%'>
      <stop offset='0%' stop-color='#1e293b'/>
      <stop offset='100%' stop-color='#020617'/>
    </radialGradient>
    <linearGradient id='ring' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#7DD3FC'/>
      <stop offset='50%' stop-color='#E0F2FE'/>
      <stop offset='100%' stop-color='#38BDF8'/>
    </linearGradient>
    <radialGradient id='core' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='55%' stop-color='#BAE6FD'/>
      <stop offset='100%' stop-color='#0EA5E9'/>
    </radialGradient>
    <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
      <feGaussianBlur stdDeviation='4' result='b'/>
      <feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>
    </filter>
    <filter id='softblur'>
      <feGaussianBlur stdDeviation='80'/>
    </filter>
    <linearGradient id='wordmark' x1='0%' y1='0%' x2='100%' y2='0%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='50%' stop-color='#BAE6FD'/>
      <stop offset='100%' stop-color='#38BDF8'/>
    </linearGradient>
  </defs>

  <rect width='1200' height='630' fill='url(#bg)'/>

  <!-- 周縁グロー -->
  <ellipse cx='350' cy='315' rx='200' ry='200' fill='#0EA5E9' opacity='0.18' filter='url(#softblur)'/>
  <ellipse cx='850' cy='315' rx='200' ry='200' fill='#7DD3FC' opacity='0.12' filter='url(#softblur)'/>

  <!-- ロゴ (左寄せ、サイズ 320) -->
  <g transform='translate(160 155) scale(3.2)'>
    <g stroke='url(#ring)' fill='none' stroke-linecap='round' stroke-linejoin='round' filter='url(#glow)'>
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

  <!-- テキスト -->
  <text x='540' y='250' font-family='Cinzel, Noto Serif JP, serif' font-size='110' font-weight='700' letter-spacing='30' fill='url(#wordmark)'>
    CORE
  </text>
  <text x='540' y='320' font-family='Noto Serif JP, serif' font-size='30' font-weight='500' fill='#94A3B8' letter-spacing='2'>
    すべての時代の、核となるものを。
  </text>
  <text x='540' y='420' font-family='Cinzel, serif' font-size='18' font-weight='600' fill='#64748B' letter-spacing='6'>
    CORE INC.  /  EST. 2026
  </text>

  <!-- 下部のミッションバー -->
  <line x1='540' y1='460' x2='1040' y2='460' stroke='#1e3a5f' stroke-width='1'/>
  <text x='540' y='495' font-family='Noto Serif JP, serif' font-size='18' fill='#475569' letter-spacing='1'>
    AI Agent OS  ·  CORE Prism  ·  CORE Iris
  </text>
</svg>
`;

async function main() {
  // 1) アイコン SVG (透過バージョン)
  writeFileSync(path.join(PUBLIC, 'core-icon.svg'), CORE_ICON_SVG);
  console.log('✓ core-icon.svg');

  // 2) PNG アイコン (各サイズ、暗背景版で PWA も統一)
  for (const size of [192, 512, 180]) {
    const buf = await sharp(Buffer.from(CORE_ICON_SVG), { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 14, b: 26, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeFileSync(path.join(PUBLIC, `core-${size}.png`), buf);
    console.log(`✓ core-${size}.png`);
  }

  // 3) OG 画像 (1200x630)
  const og = await sharp(Buffer.from(CORE_OG_SVG))
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path.join(PUBLIC, 'og-core.png'), og);
  console.log('✓ og-core.png (1200x630)');

  console.log('\n生成完了');
}

main().catch(e => { console.error(e); process.exit(1); });
