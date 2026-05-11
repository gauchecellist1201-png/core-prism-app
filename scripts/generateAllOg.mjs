// ============================================================
// 全 OG 画像を「白背景 + ロゴのみ・テキストなし」で再生成
// 出力: public/og-core-v2.png / og-prism-v2.png / og-iris-v2.png
// 旧ファイルは残す (互換性) が、HTML は v2 を参照させる
// SNS キャッシュ強制無効化のためファイル名にバージョン付与
// ============================================================
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const W = 1200;
const H = 630;
const LOGO_BOX = 360; // 中央ロゴの 1 辺

// 中央配置用 transform を作るヘルパー
const centerTransform = (svgViewBoxSize) => {
  const scale = LOGO_BOX / svgViewBoxSize;
  const tx = (W - LOGO_BOX) / 2;
  const ty = (H - LOGO_BOX) / 2;
  return `translate(${tx} ${ty}) scale(${scale})`;
};

// CORE: 同心円 + 8 軸 + 中央コア
const CORE_LOGO = `
  <defs>
    <linearGradient id='core-ring' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#0EA5E9'/>
      <stop offset='50%' stop-color='#38BDF8'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </linearGradient>
    <radialGradient id='core-center' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#FFFFFF'/>
      <stop offset='55%' stop-color='#7DD3FC'/>
      <stop offset='100%' stop-color='#0284C7'/>
    </radialGradient>
  </defs>
  <g transform='${centerTransform(100)}'>
    <g stroke='url(#core-ring)' fill='none' stroke-linecap='round' stroke-linejoin='round'>
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
    <circle cx='50' cy='50' r='7' fill='url(#core-center)'/>
    <circle cx='48' cy='47' r='2.2' fill='#FFFFFF' opacity='0.85'/>
  </g>
`;

// PRISM: 多面体ポリゴン
const PRISM_LOGO = `
  <g transform='${centerTransform(100)}'>
    <polygon points='50,5 30,55 50,55' fill='#C13584'/>
    <polygon points='50,5 50,55 65,32' fill='#7B2CBF'/>
    <polygon points='65,32 50,55 78,55' fill='#06A77D'/>
    <polygon points='65,32 78,55 88,38' fill='#118AB2'/>
    <polygon points='30,55 50,55 40,75' fill='#E1306C'/>
    <polygon points='50,55 78,55 60,75' fill='#833AB4'/>
    <polygon points='10,92 30,55 40,75' fill='#FFD60A'/>
    <polygon points='10,92 40,75 60,75' fill='#F77F00'/>
    <polygon points='60,75 78,55 90,92' fill='#06A77D'/>
    <polygon points='60,75 90,92 88,38' fill='#5B2C8A' opacity='0.7'/>
  </g>
`;

// IRIS: 6 弁の花
const IRIS_LOGO = `
  <defs>
    <linearGradient id='iris-line' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#FF8A1A'/>
      <stop offset='25%' stop-color='#F77737'/>
      <stop offset='50%' stop-color='#E1306C'/>
      <stop offset='75%' stop-color='#C13584'/>
      <stop offset='100%' stop-color='#833AB4'/>
    </linearGradient>
  </defs>
  <g transform='${centerTransform(100)}'>
    <g stroke='url(#iris-line)' fill='none' stroke-linejoin='round'>
      ${[0, 60, 120, 180, 240, 300].map(deg => `
        <g transform='rotate(${deg} 50 50)'>
          <path d='M 50 12 C 42 24, 42 38, 50 50 C 58 38, 58 24, 50 12 Z' stroke-width='3'/>
          <path d='M 50 18 C 45 28, 45 38, 50 47 C 55 38, 55 28, 50 18 Z' stroke-width='2'/>
        </g>
      `).join('')}
    </g>
  </g>
`;

const wrap = (logo) => `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='${W}' height='${H}'>
  <rect width='${W}' height='${H}' fill='#FFFFFF'/>
  ${logo}
</svg>`;

async function render(svg, outName) {
  const buf = await sharp(Buffer.from(svg), { density: 300 })
    .resize(W, H)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path.join(PUBLIC, outName), buf);
  console.log(`✓ ${outName} (${W}x${H}, 白背景, ロゴのみ)`);
}

async function main() {
  await render(wrap(CORE_LOGO), 'og-core-v2.png');
  await render(wrap(PRISM_LOGO), 'og-prism-v2.png');
  await render(wrap(IRIS_LOGO), 'og-iris-v2.png');
  console.log('\n生成完了 — 全 OG 画像を白背景＋ロゴのみに統一');
}

main().catch(e => { console.error(e); process.exit(1); });
