// Crystal PWA アイコン生成 — ガラスの蓮 (闇色地に白蓮+金芯)
// 出力: public/crystal-192.png / crystal-512.png / crystal-180.png (apple-touch)
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const OUTER = 'M50,8 C59,22 61,36 50,50 C39,36 41,22 50,8 Z';
const INNER = 'M50,26 C56,34 57,43 50,50 C43,43 44,34 50,26 Z';

const outer = Array.from({ length: 8 }, (_, i) =>
  `<path d='${OUTER}' fill='url(#o)' stroke='rgba(255,255,255,0.85)' stroke-width='1.1' transform='rotate(${i * 45} 50 50)'/>`).join('');
const inner = Array.from({ length: 6 }, (_, i) =>
  `<path d='${INNER}' fill='url(#n)' stroke='rgba(255,255,255,0.9)' stroke-width='0.9' transform='rotate(${i * 60 + 30} 50 50)'/>`).join('');

// iOS はアイコンを自動角丸にするので余白 12% の正方フルブリード
const svg = `
<svg width='512' height='512' viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <radialGradient id='bg' cx='50%' cy='38%' r='80%'>
      <stop offset='0%' stop-color='#1B2333'/><stop offset='60%' stop-color='#10141F'/><stop offset='100%' stop-color='#07090F'/>
    </radialGradient>
    <linearGradient id='o' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#F4F7FC' stop-opacity='0.95'/><stop offset='55%' stop-color='#C7D8F0' stop-opacity='0.72'/><stop offset='100%' stop-color='#8FA8CC' stop-opacity='0.55'/>
    </linearGradient>
    <linearGradient id='n' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#FFFFFF' stop-opacity='0.98'/><stop offset='100%' stop-color='#D9E4F5' stop-opacity='0.8'/>
    </linearGradient>
    <radialGradient id='c'>
      <stop offset='0%' stop-color='#FFF3DC'/><stop offset='55%' stop-color='#C9A96E'/><stop offset='100%' stop-color='#C9A96E' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='512' height='512' fill='url(#bg)'/>
  <g transform='translate(61 61) scale(3.9)'>
    ${outer}${inner}
    <circle cx='50' cy='50' r='11' fill='url(#c)'/>
    <circle cx='50' cy='50' r='4' fill='#FFF8EA'/>
  </g>
</svg>`;

for (const size of [512, 192, 180]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(PUBLIC, `crystal-${size}.png`));
  console.log(`crystal-${size}.png`);
}
