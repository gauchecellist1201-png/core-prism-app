// ============================================================
// CORE Continuum OG 画像生成 — ヒーローの「金の二重丸オービット」
// (ct-ring / ct-ring2 / ct-core / ct-sat) を静止画として再現。
// 出力: public/og-continuum-v1.png (1200x630)
// ============================================================
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const W = 1200;
const H = 630;

// リング中心をやや左に置き、右側にコピーを流す
const CX = 380;
const CY = 315;
const R_OUTER = 210;
const R_INNER = 148;
const R_ORBIT = 210; // 衛星が乗る半径 (外周リング上)

const SAT_ANGLES = [0, 60, 120, 180, 240, 300]; // deg, 12時起点で時計回り

const satellites = SAT_ANGLES.map((deg) => {
  const rad = (deg - 90) * (Math.PI / 180);
  const sx = CX + R_ORBIT * Math.cos(rad);
  const sy = CY + R_ORBIT * Math.sin(rad);
  return `
    <circle cx='${sx}' cy='${sy}' r='30' fill='url(#satFill)' stroke='rgba(201,169,110,0.65)' stroke-width='1.4'/>
    <circle cx='${sx}' cy='${sy}' r='30' fill='none' stroke='rgba(231,201,135,0.35)' stroke-width='1' />
  `;
}).join('');

const svg = `
<svg width='${W}' height='${H}' viewBox='0 0 ${W} ${H}' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <radialGradient id='bg' cx='34%' cy='48%' r='80%'>
      <stop offset='0%' stop-color='#151208'/>
      <stop offset='45%' stop-color='#0a0806'/>
      <stop offset='100%' stop-color='#050505'/>
    </radialGradient>
    <radialGradient id='glow' cx='50%' cy='50%' r='50%'>
      <stop offset='0%' stop-color='#C9A96E' stop-opacity='0.30'/>
      <stop offset='55%' stop-color='#C9A96E' stop-opacity='0.10'/>
      <stop offset='100%' stop-color='#C9A96E' stop-opacity='0'/>
    </radialGradient>
    <radialGradient id='coreFill' cx='50%' cy='32%' r='65%'>
      <stop offset='0%' stop-color='#FFF3DC'/>
      <stop offset='55%' stop-color='#E7C987'/>
      <stop offset='100%' stop-color='#C9A96E'/>
    </radialGradient>
    <radialGradient id='satFill' cx='50%' cy='30%' r='65%'>
      <stop offset='0%' stop-color='rgba(231,201,135,0.30)'/>
      <stop offset='100%' stop-color='rgba(8,8,8,0.95)'/>
    </radialGradient>
    <linearGradient id='titleFill' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0%' stop-color='#F7EAD0'/>
      <stop offset='100%' stop-color='#E7C987'/>
    </linearGradient>
  </defs>

  <rect width='${W}' height='${H}' fill='url(#bg)'/>
  <circle cx='${CX}' cy='${CY}' r='320' fill='url(#glow)'/>

  <!-- 外周ダブルリング -->
  <circle cx='${CX}' cy='${CY}' r='${R_OUTER}' fill='none' stroke='rgba(201,169,110,0.55)' stroke-width='1.6'/>
  <circle cx='${CX}' cy='${CY}' r='${R_INNER}' fill='none' stroke='rgba(201,169,110,0.28)' stroke-width='1.2'/>

  <!-- 6衛星 -->
  ${satellites}

  <!-- 中心コア -->
  <circle cx='${CX}' cy='${CY}' r='56' fill='rgba(5,5,5,0.92)' stroke='rgba(201,169,110,0.7)' stroke-width='1.6'/>
  <circle cx='${CX}' cy='${CY}' r='30' fill='url(#coreFill)'/>
  <text x='${CX}' y='${CY + 6}' text-anchor='middle'
    font-family='Georgia, "Times New Roman", serif' font-size='15' font-weight='700'
    letter-spacing='2' fill='#1a1305'>CORE</text>

  <!-- コピー -->
  <text x='760' y='226' text-anchor='middle'
    font-family='Georgia, "Times New Roman", serif' font-size='19' letter-spacing='7'
    fill='#C9A96E'>CORE CONTINUUM</text>

  <text x='760' y='300' text-anchor='middle'
    font-family='"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif' font-weight='700'
    font-size='50' fill='url(#titleFill)'>あなたが働かなくても、</text>
  <text x='760' y='366' text-anchor='middle'
    font-family='"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif' font-weight='700'
    font-size='50' fill='url(#titleFill)'>事業が回り続ける。</text>

  <text x='760' y='424' text-anchor='middle'
    font-family='"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif' font-size='19'
    letter-spacing='2' fill='rgba(247,234,208,0.68)'>6つのAIエージェントが、あなたの仕事を引き受けます。</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC, 'og-continuum-v1.png'));
console.log('og-continuum-v1.png generated');
