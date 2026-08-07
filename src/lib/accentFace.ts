// ============================================================
// accentFace — 「アクセント色を面にして、その上に文字やアイコンを置く」ときの色を決める
// ============================================================
//
// もともと Iris (src/iris/irisStyle.ts) だけに置いていたが、
// Prism の共有部品 (src/components/**) が同じ壊れ方を約40箇所で抱えていたので
// ここへ移して 1 つの出どころにした（irisStyle は本ファイルを再輸出する）。
//
// 何が壊れていたか（2026-08-08 実測）:
//   画面側が `linear-gradient(135deg, ${accent}, ${accent}cc)` の面に `color:'#fff'` を
//   べた書きしていたが、Prism のペルソナ・アクセントは白の比が
//     黄 #FBBF24 1.67 / 緑 #34D399 1.92 / 橙 #FB923C 2.26 / 金 #c9a96e 2.24 /
//     桃 #F472B6 2.65 / 青 #60A5FA 2.54 / 水 #06B6D4 2.43 / 赤 #EF4444 3.76 /
//     藍 #6366F1 4.47
//   ＝**どのペルソナを選んでも白文字が AA(4.5) に届かない**。
//   さらに終端の `cc`(80%) は下の明るい地が透けて、面の中でいちばん薄い所を作る。
//
// 直し方は「書き手に守らせる」ではなく **面の側で保証する**。
// 画面側は accentFaceBg(accent) と accentFaceInk(accent) を対で使えば必ず読める。

/**
 * `#RRGGBB` に正規化する。`#fff` の 3 桁も受ける。
 * これ以外（`var(--accent)` や `rgba(...)`）は null＝計算をあきらめて元の値をそのまま使う。
 * 計算を素通しすると `#NaNNaNNaN` という色になり、面が消える（黙って壊れる）。
 */
export function normalizeHex(input: string): string | null {
  if (typeof input !== 'string') return null;
  const h = input.trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (/^[0-9a-fA-F]{6}$/.test(h)) return '#' + h;
  return null;
}

/** Hex を HSL に変換 */
export function hexToHsl(hex: string): [number, number, number] {
  const h = (normalizeHex(hex) ?? hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let H = 0, S = 0;
  const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: H = ((b - r) / d + 2); break;
      case b: H = ((r - g) / d + 4); break;
    }
    H *= 60;
  }
  return [H, S, L];
}

/** HSL を Hex に変換 */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60)        [r, g, b] = [c, x, 0];
  else if (h < 120)  [r, g, b] = [x, c, 0];
  else if (h < 180)  [r, g, b] = [0, c, x];
  else if (h < 240)  [r, g, b] = [0, x, c];
  else if (h < 300)  [r, g, b] = [x, 0, c];
  else               [r, g, b] = [c, 0, x];
  const to2 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

/** 相対輝度 (WCAG) */
export function relLum(hex: string): number {
  const h = (normalizeHex(hex) ?? hex).replace('#', '');
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** WCAG コントラスト比 */
export function contrast(a: string, b: string): number {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * アクセント色を「面」にして、その上に文字やアイコンを置くときの 面と文字の組。
 *
 * 選び方は 2 段階。
 *  ① 色みは変えずに明るさだけ少し(最大 15%)落として白が通るならそれ＝見た目のトーンは保つ。
 *  ② それでも通らない明るい面(オレンジ・黄)は、面を明るいまま残して文字を濃くする。
 *     ここで面を暗くすると、ブランドのオレンジが茶色になってしまう。
 * faceEnd は「文字と反対側」へずらす＝白文字なら濃く、濃い文字なら明るく。
 * グラデーションの終端で contrast が落ちる事故（半透明終端の再来）を防ぐ。
 */
export function onAccentFace(accent: string): { face: string; faceEnd: string; ink: string } {
  const fallback = { face: accent, faceEnd: accent, ink: '#FFFFFF' };
  if (!normalizeHex(accent)) return fallback;
  try {
    const [h, s, l] = hexToHsl(accent);
    const deeper = (base: string) => {
      const [bh, bs, bl] = hexToHsl(base);
      return hslToHex(bh, bs, Math.max(0, bl * 0.88));
    };
    const lighter = (base: string) => {
      const [bh, bs, bl] = hexToHsl(base);
      return hslToHex(bh, bs, Math.min(1, bl * 1.06));
    };
    if (contrast('#FFFFFF', accent) >= 4.6) {
      return { face: accent, faceEnd: deeper(accent), ink: '#FFFFFF' };
    }
    for (let i = l; i >= l * 0.85; i -= 0.01) {
      const c = hslToHex(h, s, i);
      if (contrast('#FFFFFF', c) >= 4.6) return { face: c, faceEnd: deeper(c), ink: '#FFFFFF' };
    }
    for (let i = 0.45; i >= 0; i -= 0.01) {
      const ink = hslToHex(h, Math.min(s, 0.55), i);
      if (contrast(ink, accent) >= 4.6) return { face: accent, faceEnd: lighter(accent), ink };
    }
    return { face: accent, faceEnd: accent, ink: '#141018' };
  } catch {
    return fallback;
  }
}

/**
 * 画面側で毎回書かれていた `linear-gradient(135deg, ${accent}, ${accent}cc)` の置き換え。
 * 終端の `cc`(80%) は下の明るい地が透けて、面がグラデの中で一番薄いところを作る＝
 * そこに白文字が乗ると実測で 3.88 まで落ちていた（2026-08-05 本番計測）。
 * onAccentFace が決めた「文字と反対側へずらした終端」を使うので、面のどこでも読める。
 */
export function accentFaceBg(accent: string, deg: number = 135): string {
  if (!normalizeHex(accent)) return accent;
  const f = onAccentFace(accent);
  return `linear-gradient(${deg}deg, ${f.face}, ${f.faceEnd})`;
}

/**
 * 「白い文字を乗せる面」の色。色みは変えず、白が 4.6:1 通るまで明るさだけ落とす。
 * onAccentFace と違って濃い文字への逃げ道を持たない＝ 3 色以上のグラデのように
 * 「面の中で明るさが大きく動く」ところで、どの位置でも白が通るようにするために使う。
 */
export function whiteSafeFace(hex: string): string {
  if (!normalizeHex(hex)) return hex;
  try {
    const [h, s, l] = hexToHsl(hex);
    if (contrast('#FFFFFF', hex) >= 4.6) return hex;
    for (let i = l; i >= 0; i -= 0.005) {
      const c = hslToHex(h, s, i);
      if (contrast('#FFFFFF', c) >= 4.6) return c;
    }
    return hex;
  } catch {
    return hex;
  }
}

/** accentFaceBg の面に乗せる文字色。白が通らない明るい面（オレンジ・黄）では自動で濃い文字になる。 */
export function accentFaceInk(accent: string): string {
  return onAccentFace(accent).ink;
}

/**
 * 「白いロゴ・線画アイコンだけを乗せる面」。
 * 文字と違って濃い側へ逃げられない（白のロゴは色を変えられない）ので、
 * accentFaceBg のような「濃い文字への逃げ道」は使わず、必ず面のほうを暗くする。
 */
export function whiteFaceBg(accent: string, deg: number = 135): string {
  if (!normalizeHex(accent)) return accent;
  const face = whiteSafeFace(accent);
  const [h, s, l] = hexToHsl(face);
  return `linear-gradient(${deg}deg, ${face}, ${hslToHex(h, s, Math.max(0, l * 0.88))})`;
}

/**
 * 「白文字を乗せるグラデーションの面」を、色ごとに白が通るところまで暗くして組み立てる。
 * 色相・彩度は変えず明るさだけ落とすので、ブランドのトーン（紫→桃→橙 の流れ）は保たれる。
 * 停止位置（`'#E1306C 0%'` のような指定）はそのまま温存する。
 */
export function whiteSafeGradient(stops: string[], deg: number = 135): string {
  const safe = stops.map((s) => s.replace(/#[0-9a-fA-F]{6}\b/, (m) => whiteSafeFace(m)));
  return `linear-gradient(${deg}deg, ${safe.join(', ')})`;
}

/**
 * 「暗い面の上で、アクセント色そのものを“文字”に使う」ときの色。
 *
 * 面に白を乗せる話の裏返し。業界LPの小見出し（`FOR SMB OWNERS` `PROOF` `USE CASES` 等・11px）は
 * `color: accentLeft` をそのまま使っていたが、紫 `#9333EA` は黒に近い地の上で **3.40〜3.70**
 * ＝小さい文字に必要な 4.5 に届いていなかった（2026-08-08 本番実測）。
 * 面と違って「地を暗くする」逃げ道が無い（地はページ全体）ので、**文字のほうを明るく**する。
 * 色相・彩度は変えないのでブランドの紫/桃のままに見える。
 *
 * bg は「その文字が乗りうる、いちばん明るい地」を渡すこと（チップの淡い面など）。
 */
export function accentInkOnDark(accent: string, bg: string = '#271A44'): string {
  if (!normalizeHex(accent)) return accent;
  try {
    if (contrast(accent, bg) >= 4.6) return accent;
    const [h, s, l] = hexToHsl(accent);
    for (let i = l; i <= 1; i += 0.005) {
      const c = hslToHex(h, s, i);
      if (contrast(c, bg) >= 4.6) return c;
    }
    return '#FFFFFF';
  } catch {
    return accent;
  }
}
