// ============================================================
// CORE Studio /studio/film — OG画像 (1200x630) v3
// 2026-08-21 オーナー支給の起動画面ロゴ (黒地に白字) を切り抜き・反転して
// 白地に黒字のワードマークにしたものを使用。サイト本体が白基調・法人トーンのため
// OGカードも黒背景から白背景へ揃える。本文コピーは v2 (価格修正版) を踏襲し、
// 「初回1本 20秒 ¥49,800」等の正しい価格・尺表記はそのまま引き継ぐ。
// ============================================================
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const logoBuf = readFileSync(path.join(PUBLIC, 'core-studio-logo.png'));
const logoB64 = logoBuf.toString('base64');

// core-studio-logo.png の実寸 720x148 (crop+invert 済み)
const LOGO_W = 720, LOGO_H = 148;
const logoDrawW = 300;
const logoDrawH = Math.round(logoDrawW * (LOGO_H / LOGO_W));

const C = {
  bg: '#FFFFFF',
  ink: '#111827',
  body: '#374151',
  mute: '#6B7280',
  gold: '#A8823C',
  goldText: '#8a6a2d',
};

const SVG = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 1200 630' width='1200' height='630'>
  <rect width='1200' height='630' fill='${C.bg}'/>

  <!-- ロゴ (切り抜き・反転済み) -->
  <image href='data:image/png;base64,${logoB64}' x='90' y='76' width='${logoDrawW}' height='${logoDrawH}'/>

  <!-- 右上ラベル -->
  <text x='1110' y='118' text-anchor='end' font-family='Noto Sans JP, Inter, sans-serif' font-size='15' font-weight='700'
    letter-spacing='3' fill='${C.goldText}'>FILM &amp; MOTION</text>

  <!-- 金の短いアクセント線 -->
  <rect x='90' y='176' width='56' height='3' rx='1.5' fill='${C.gold}'/>

  <!-- 見出し (2行) -->
  <text x='88' y='282' font-family='Noto Serif JP, serif' font-size='56' font-weight='700' fill='${C.ink}'>撮影をせずに、</text>
  <text x='88' y='352' font-family='Noto Serif JP, serif' font-size='56' font-weight='700' fill='${C.ink}'>広告に出せる映像を。</text>

  <!-- サブ -->
  <text x='90' y='410' font-family='Noto Sans JP, sans-serif' font-size='21' fill='${C.mute}'>企画・脚本・ディレクション・仕上げまで、一貫制作。</text>

  <!-- バッジ 3枚 -->
  <g font-family='Noto Sans JP, sans-serif' font-size='18' font-weight='600' fill='${C.ink}'>
    <rect x='90' y='452' width='240' height='46' rx='23' fill='#FFFFFF' stroke='#C9CDD4' stroke-width='1.5'/>
    <text x='210' y='481' text-anchor='middle'>初回1本 20秒 ¥49,800</text>

    <rect x='344' y='452' width='214' height='46' rx='23' fill='#FFFFFF' stroke='#C9CDD4' stroke-width='1.5'/>
    <text x='451' y='481' text-anchor='middle'>撮影費・出演費 0円</text>

    <rect x='572' y='452' width='268' height='46' rx='23' fill='#FFFFFF' stroke='#C9CDD4' stroke-width='1.5'/>
    <text x='706' y='481' text-anchor='middle'>修正無制限（STANDARD以上）</text>
  </g>
</svg>
`;

async function main() {
  const out = await sharp(Buffer.from(SVG)).resize(1200, 630).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(path.join(PUBLIC, 'og-studio-film-v3.png'), out);
  console.log('✓ og-studio-film-v3.png (1200x630, 白背景)');
}

main().catch(e => { console.error(e); process.exit(1); });
