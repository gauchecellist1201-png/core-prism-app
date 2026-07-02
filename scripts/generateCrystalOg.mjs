// ============================================================
// Crystal OG 画像生成 — ガラスの蓮ロゴ (白×クリスタル×金) を
// 深い闇色の上に中央配置 + CRYSTAL セリフ・ワードマーク
// 出力: public/og-crystal-v1.png (1200x630)
// SNS キャッシュ対策でファイル名にバージョン付与 (更新時は v2, v3…)
// ============================================================
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const W = 1200;
const H = 630;

// CrystalLogo (src/components/Logo.tsx) と同じ花弁ジオメトリ
const OUTER = 'M50,8 C59,22 61,36 50,50 C39,36 41,22 50,8 Z';
const INNER = 'M50,26 C56,34 57,43 50,50 C43,43 44,34 50,26 Z';

const LOGO_BOX = 330;
const logoScale = LOGO_BOX / 100;
const logoX = (W - LOGO_BOX) / 2;
const logoY = 96;

const outerPetals = Array.from({ length: 8 }, (_, i) =>
  `<path d='${OUTER}' fill='url(#czOuter)' stroke='rgba(255,255,255,0.85)' stroke-width='1.1' transform='rotate(${i * 45} 50 50)'/>`
).join('');

const innerPetals = Array.from({ length: 6 }, (_, i) =>
  `<path d='${INNER}' fill='url(#czInner)' stroke='rgba(255,255,255,0.9)' stroke-width='0.9' transform='rotate(${i * 60 + 30} 50 50)'/>`
).join('');

const svg = `
<svg width='${W}' height='${H}' viewBox='0 0 ${W} ${H}' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <radialGradient id='czBg' cx='50%' cy='36%' r='75%'>
      <stop offset='0%' stop-color='#161B28'/>
      <stop offset='55%' stop-color='#0D111B'/>
      <stop offset='100%' stop-color='#07090F'/>
    </radialGradient>
    <linearGradient id='czOuter' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#F4F7FC' stop-opacity='0.95'/>
      <stop offset='55%' stop-color='#C7D8F0' stop-opacity='0.72'/>
      <stop offset='100%' stop-color='#8FA8CC' stop-opacity='0.55'/>
    </linearGradient>
    <linearGradient id='czInner' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#FFFFFF' stop-opacity='0.98'/>
      <stop offset='100%' stop-color='#D9E4F5' stop-opacity='0.8'/>
    </linearGradient>
    <radialGradient id='czCore'>
      <stop offset='0%' stop-color='#FFF3DC'/>
      <stop offset='55%' stop-color='#C9A96E'/>
      <stop offset='100%' stop-color='#C9A96E' stop-opacity='0'/>
    </radialGradient>
    <radialGradient id='czHalo'>
      <stop offset='0%' stop-color='#AAC4EC' stop-opacity='0.28'/>
      <stop offset='60%' stop-color='#AAC4EC' stop-opacity='0.08'/>
      <stop offset='100%' stop-color='#AAC4EC' stop-opacity='0'/>
    </radialGradient>
    <linearGradient id='czWord' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0%' stop-color='#F4F7FC'/>
      <stop offset='68%' stop-color='#D9E4F5'/>
      <stop offset='100%' stop-color='#C9A96E'/>
    </linearGradient>
  </defs>

  <rect width='${W}' height='${H}' fill='url(#czBg)'/>
  <circle cx='${W / 2}' cy='${logoY + LOGO_BOX / 2}' r='300' fill='url(#czHalo)'/>

  <g transform='translate(${logoX} ${logoY}) scale(${logoScale})'>
    ${outerPetals}
    ${innerPetals}
    <circle cx='50' cy='50' r='11' fill='url(#czCore)'/>
    <circle cx='50' cy='50' r='4' fill='#FFF8EA'/>
  </g>

  <text x='${W / 2}' y='524' text-anchor='middle'
    font-family='Didot, "Bodoni 72", Georgia, "Times New Roman", serif'
    font-size='64' font-weight='500' letter-spacing='30' fill='url(#czWord)'>CRYSTAL</text>
  <text x='${W / 2}' y='578' text-anchor='middle'
    font-family='"Hiragino Mincho ProN", "Yu Mincho", serif'
    font-size='21' letter-spacing='6' fill='rgba(217,228,245,0.62)'>話しかけるだけで、すべて解決。</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC, 'og-crystal-v1.png'));
console.log('og-crystal-v1.png generated');
