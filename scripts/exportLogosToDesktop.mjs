// ============================================================
// CORE / Prism / Iris のロゴを高解像度 PNG + 透過 SVG でデスクトップへ出力
// ============================================================
import sharp from 'sharp';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const DESKTOP = path.join(homedir(), 'Desktop', 'CORE-Logos');
if (!existsSync(DESKTOP)) mkdirSync(DESKTOP, { recursive: true });

const PUBLIC = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public');

// CORE ロゴ単体 SVG (透過、暗背景なし)
const CORE_TRANS_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='2048' height='2048'>
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

const CORE_DARK_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='2048' height='2048'>
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
    <radialGradient id='bg' cx='50%' cy='50%' r='70%'>
      <stop offset='0%' stop-color='#1e293b'/>
      <stop offset='100%' stop-color='#020617'/>
    </radialGradient>
    <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
      <feGaussianBlur stdDeviation='1.4' result='b'/>
      <feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>
    </filter>
  </defs>
  <rect width='100' height='100' fill='url(#bg)'/>
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

// CORE + ワードマーク (横長、暗背景)
const CORE_WORDMARK_SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 240' width='2400' height='720'>
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
    <radialGradient id='bg' cx='50%' cy='50%' r='70%'>
      <stop offset='0%' stop-color='#1e293b'/>
      <stop offset='100%' stop-color='#020617'/>
    </radialGradient>
    <linearGradient id='wm' x1='0%' y1='0%' x2='100%' y2='0%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='50%' stop-color='#BAE6FD'/>
      <stop offset='100%' stop-color='#38BDF8'/>
    </linearGradient>
    <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
      <feGaussianBlur stdDeviation='1.4' result='b'/>
      <feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>
    </filter>
  </defs>
  <rect width='800' height='240' fill='url(#bg)'/>
  <g transform='translate(40 20) scale(2)'>
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
  <text x='280' y='148' font-family='Cinzel, Noto Serif JP, serif' font-size='100' font-weight='700' letter-spacing='30' fill='url(#wm)'>
    CORE
  </text>
</svg>
`;

async function main() {
  // SVG を 4 枚保存
  writeFileSync(path.join(DESKTOP, 'CORE-logo-transparent.svg'), CORE_TRANS_SVG);
  writeFileSync(path.join(DESKTOP, 'CORE-logo-dark.svg'), CORE_DARK_SVG);
  writeFileSync(path.join(DESKTOP, 'CORE-wordmark-dark.svg'), CORE_WORDMARK_SVG);
  console.log('✓ SVG 3 枚');

  // PNG 高解像度 (透過, 2048x2048) — density は控えめにしてpixel制限回避
  await sharp(Buffer.from(CORE_TRANS_SVG), { density: 200 })
    .resize(2048, 2048, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(DESKTOP, 'CORE-logo-transparent-2048.png'));
  console.log('✓ CORE-logo-transparent-2048.png (透過)');

  // PNG 高解像度 (暗背景, 2048x2048)
  await sharp(Buffer.from(CORE_DARK_SVG), { density: 200 })
    .resize(2048, 2048)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DESKTOP, 'CORE-logo-dark-2048.png'));
  console.log('✓ CORE-logo-dark-2048.png (暗背景)');

  // PNG ワードマーク (2400x720, 暗背景)
  await sharp(Buffer.from(CORE_WORDMARK_SVG), { density: 100 })
    .resize(2400, 720)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DESKTOP, 'CORE-wordmark-dark-2400.png'));
  console.log('✓ CORE-wordmark-dark-2400.png (横長)');

  // 既存の og-core.png もコピー
  if (existsSync(path.join(PUBLIC, 'og-core.png'))) {
    writeFileSync(path.join(DESKTOP, 'CORE-OG-1200x630.png'), readFileSync(path.join(PUBLIC, 'og-core.png')));
    console.log('✓ CORE-OG-1200x630.png (Twitter/Facebook 用)');
  }

  console.log('\n保存先: ' + DESKTOP);
}

main().catch(e => { console.error(e); process.exit(1); });
