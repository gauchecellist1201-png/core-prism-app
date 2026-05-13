// ============================================================
// Grading.ts — Canvas LUT (Look-Up-Table) 風カラーグレーディング
//
// CapCut Pro 同等のシネマ系プリセット 10 種。
// ctx.filter + overlay 合成で実装 (重い WebGL は使わない)
// IrisReelStudio.tsx の drawAt から呼ばれる
// ============================================================

export type GradeId =
  | 'none'
  | 'cinematic-teal'
  | 'soft-film'
  | 'cold-blue'
  | 'warm-sunset'
  | 'vintage-70s'
  | 'moody-dark'
  | 'bright-airy'
  | 'kpop-clear'
  | 'mono'
  | 'pastel-dream';

export interface Grade {
  id: GradeId;
  label: string;
  /** ctx.filter string. drawCover の直前にセット, 描画後 'none' に戻す */
  filter: string;
  /** 仕上げに合成するオーバーレイ色 (rgba) と composite mode。null なら無し */
  overlay?: { color: string; mode: GlobalCompositeOperation; alpha: number };
}

export const COLOR_GRADES: Grade[] = [
  {
    id: 'none',
    label: 'なし',
    filter: 'none',
  },
  {
    id: 'cinematic-teal',
    label: 'シネマ Teal&Orange',
    filter: 'contrast(1.15) saturate(1.25) brightness(0.97)',
    overlay: { color: 'rgba(255,140,60,0.10)', mode: 'overlay', alpha: 0.55 },
  },
  {
    id: 'soft-film',
    label: 'ソフト フィルム',
    filter: 'contrast(0.95) saturate(0.92) brightness(1.05) sepia(0.08)',
    overlay: { color: 'rgba(255,220,180,0.12)', mode: 'soft-light', alpha: 0.7 },
  },
  {
    id: 'cold-blue',
    label: 'コールド ブルー',
    filter: 'contrast(1.1) saturate(0.85) brightness(0.96) hue-rotate(-8deg)',
    overlay: { color: 'rgba(80,140,220,0.18)', mode: 'overlay', alpha: 0.5 },
  },
  {
    id: 'warm-sunset',
    label: 'ウォーム サンセット',
    filter: 'contrast(1.05) saturate(1.15) brightness(1.04) sepia(0.12)',
    overlay: { color: 'rgba(255,160,80,0.18)', mode: 'soft-light', alpha: 0.6 },
  },
  {
    id: 'vintage-70s',
    label: 'ヴィンテージ 70s',
    filter: 'contrast(0.92) saturate(0.8) brightness(1.02) sepia(0.32) hue-rotate(-6deg)',
    overlay: { color: 'rgba(180,120,60,0.15)', mode: 'multiply', alpha: 0.5 },
  },
  {
    id: 'moody-dark',
    label: 'ムーディ ダーク',
    filter: 'contrast(1.25) saturate(0.85) brightness(0.85)',
    overlay: { color: 'rgba(20,20,40,0.18)', mode: 'multiply', alpha: 0.6 },
  },
  {
    id: 'bright-airy',
    label: 'ブライト エアリー',
    filter: 'contrast(0.95) saturate(0.9) brightness(1.12)',
    overlay: { color: 'rgba(255,255,255,0.10)', mode: 'screen', alpha: 0.6 },
  },
  {
    id: 'kpop-clear',
    label: 'K-Pop クリア',
    filter: 'contrast(1.12) saturate(1.18) brightness(1.06)',
    overlay: { color: 'rgba(255,230,240,0.10)', mode: 'soft-light', alpha: 0.55 },
  },
  {
    id: 'mono',
    label: 'モノクロ',
    filter: 'grayscale(1) contrast(1.1) brightness(1.0)',
  },
  {
    id: 'pastel-dream',
    label: 'パステル ドリーム',
    filter: 'contrast(0.9) saturate(0.85) brightness(1.08) hue-rotate(8deg)',
    overlay: { color: 'rgba(255,200,220,0.14)', mode: 'soft-light', alpha: 0.65 },
  },
];

export function getGrade(id: GradeId | undefined): Grade {
  return COLOR_GRADES.find(g => g.id === id) ?? COLOR_GRADES[0];
}

/** drawCover で素材を描画した後にこの関数を呼んで overlay を被せる */
export function applyGradeOverlay(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  W: number,
  H: number,
) {
  if (!grade.overlay) return;
  const prevAlpha = ctx.globalAlpha;
  const prevMode = ctx.globalCompositeOperation;
  ctx.globalAlpha = grade.overlay.alpha;
  ctx.globalCompositeOperation = grade.overlay.mode;
  ctx.fillStyle = grade.overlay.color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevMode;
}
