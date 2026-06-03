// ============================================================
// avatarGen.ts — 名前から決定的に SVG アバターを生成
//
// オーナー指示 (2026-06-03 第 10 波 TT):
//   オンボの「名前」step を打ち終わった瞬間に DiceBear / Boring Avatars 風の
//   SVG アバターを自動生成。ユーザーが画像を準備しなくても顔が出る。
//
// 設計:
//   外部 API 依存ゼロ。文字列をハッシュ → 6 色パレットから色を選ぶ →
//   形状 (beam / marble / circle stripes) のいずれかを描画。
//   同じ名前 → 同じアバター (決定的)。
// ============================================================

// 名前のハッシュ (FNV-1a 32bit)
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// 8 色のパレット (彩度高めで Web UI 親和性が高い)
const PALETTES: string[][] = [
  ['#F97316', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'], // 虹
  ['#1F2937', '#FBBF24', '#F472B6', '#FEFCE8'],                       // ダーク + 黄
  ['#FFD8E4', '#FFB6C1', '#FFC4D1', '#FFD6E5'],                       // パステル ピンク
  ['#0EA5E9', '#22D3EE', '#34D399', '#A3E635'],                       // 海
  ['#7C3AED', '#A78BFA', '#C084FC', '#E9D5FF'],                       // 紫
  ['#EAB308', '#F97316', '#EA580C', '#9A3412'],                       // 暖色
  ['#10B981', '#0D9488', '#0F766E', '#134E4A'],                       // 緑
  ['#EC4899', '#F472B6', '#FB7185', '#FDA4AF'],                       // ローズ
];

function pickPalette(seed: number): string[] {
  return PALETTES[seed % PALETTES.length];
}

// 0..1 の決定的疑似乱数 (xorshift32)
function rng(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

// アバター本体 (Beam 風 — 名前のイニシャルを大きく重ねる)
function buildBeamSvg(name: string, size = 128): string {
  const seed = hash32(name);
  const palette = pickPalette(seed);
  const r = rng(seed);
  const bg = palette[Math.floor(r() * palette.length)];
  const fg = palette[Math.floor(r() * palette.length)];
  const accent = palette[Math.floor(r() * palette.length)];
  const initial = (name.trim().slice(0, 1) || '?').toUpperCase();
  // 背景の幾何 (3 つの円 + 1 つのリング)
  const cx1 = Math.floor(r() * size);
  const cy1 = Math.floor(r() * size);
  const cr1 = size * 0.35 + Math.floor(r() * size * 0.25);
  const cx2 = Math.floor(r() * size);
  const cy2 = Math.floor(r() * size);
  const cr2 = size * 0.20 + Math.floor(r() * size * 0.20);
  const cx3 = Math.floor(r() * size);
  const cy3 = Math.floor(r() * size);
  const cr3 = size * 0.10 + Math.floor(r() * size * 0.15);
  // クリッピングして角を丸く (super-ellipse 風)
  const rounded = Math.round(size * 0.22);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <clipPath id="rounded-${seed}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${rounded}" ry="${rounded}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#rounded-${seed})">
    <rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>
    <circle cx="${cx1}" cy="${cy1}" r="${cr1}" fill="${accent}" opacity="0.85"/>
    <circle cx="${cx2}" cy="${cy2}" r="${cr2}" fill="${fg}" opacity="0.75"/>
    <circle cx="${cx3}" cy="${cy3}" r="${cr3}" fill="${palette[(seed + 1) % palette.length]}" opacity="0.8"/>
    <text x="50%" y="54%" font-family="'Inter','Hiragino Kaku Gothic ProN',sans-serif" font-size="${size * 0.5}" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="#fff" style="text-shadow:0 1px 2px rgba(0,0,0,0.25)">
      ${escapeXml(initial)}
    </text>
  </g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch] || ch));
}

/** 名前 から SVG dataURL を生成 (決定的) */
export function generateAvatarDataUrl(name: string, size = 128): string {
  const svg = buildBeamSvg(name, size);
  // URL encode (btoa は Unicode で失敗するので encodeURIComponent 経由)
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27');
  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

/** 名前 から アクセントカラー も決定的に決める (主に subtitle 等の使い回し用) */
export function pickAvatarAccent(name: string): string {
  const palette = pickPalette(hash32(name));
  return palette[0];
}
