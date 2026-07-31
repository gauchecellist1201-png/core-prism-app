// ============================================================
// リールスタジオへの「このテーマで 1 本つくる」受け渡し
// ------------------------------------------------------------
// ツアーの最後や朝ブリーフの「今日の一手」から渡すテーマ。
// prop でも渡しているが、リールスタジオは遅延読み込み (React.lazy) なので
// 回線が遅い端末では受け取り手がまだ居ないことがある。約束したテーマを
// 落とさないよう sessionStorage にも置き、受け取った側が使ったらすぐ消す。
// (小さな独立モジュールにしてあるのは、ダッシュボードから参照しても
//  リールスタジオ本体が先読みされない = 初回表示を重くしないため)
// ============================================================

export const PENDING_THEME_KEY = 'iris_pending_reel_theme';

/** これから開くリールスタジオに「このテーマで作って」と伝える */
export function stashPendingReelTheme(theme: string) {
  const t = (theme || '').trim();
  if (!t) return;
  try { sessionStorage.setItem(PENDING_THEME_KEY, t); } catch { /* プライベートモード等は prop 経由に任せる */ }
}

/** 受け取って消す (二度目の訪問で勝手に作り始めないように) */
export function takePendingReelTheme(): string {
  try {
    const t = (sessionStorage.getItem(PENDING_THEME_KEY) || '').trim();
    if (t) sessionStorage.removeItem(PENDING_THEME_KEY);
    return t;
  } catch {
    return '';
  }
}
