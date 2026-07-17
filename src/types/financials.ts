// ============================================================
// 財務諸表 (BS / PL) の型定義
//
// 方針（数字の嘘禁止）:
// - 売上・経費・売掛金など「実データから導ける値」は自動で入れる
// - 現金預金・借入金・資本金など、実データが無い項目は必ずユーザー入力
// - 自動値と手入力を画面で区別し、未入力は 0 ではなく「未入力」として扱う
// ============================================================

/** BS の手入力項目（期末時点の残高・円） */
export interface BalanceSheetInput {
  personaId: string;
  /** 対象期末 (YYYY-MM-DD) */
  asOf: string;

  // ── 資産の部 ──
  /** 流動資産 */
  cash?: number;              // 現金及び預金
  accountsReceivable?: number; // 売掛金（未入力なら未回収請求から自動）
  inventory?: number;          // 棚卸資産
  otherCurrentAssets?: number; // その他流動資産
  /** 固定資産 */
  tangibleAssets?: number;     // 有形固定資産
  intangibleAssets?: number;   // 無形固定資産
  investments?: number;        // 投資その他の資産

  // ── 負債の部 ──
  /** 流動負債 */
  accountsPayable?: number;    // 買掛金
  shortTermDebt?: number;      // 短期借入金
  accruedExpenses?: number;    // 未払費用
  otherCurrentLiabilities?: number;
  /** 固定負債 */
  longTermDebt?: number;       // 長期借入金
  otherFixedLiabilities?: number;

  // ── 純資産の部 ──
  capital?: number;            // 資本金
  retainedEarnings?: number;   // 利益剰余金（期首）

  updatedAt: string;
}

/** PL の手入力項目（期間中の金額・円）。売上/販管費は実データから自動。 */
export interface ProfitLossInput {
  personaId: string;
  /** 対象期間キー（例 2026-07 / 2026-Q3 / 2026） */
  periodKey: string;

  costOfSales?: number;          // 売上原価（未入力なら0＝サービス業想定）
  nonOperatingIncome?: number;   // 営業外収益
  nonOperatingExpense?: number;  // 営業外費用（支払利息など）
  extraordinaryIncome?: number;  // 特別利益
  extraordinaryLoss?: number;    // 特別損失
  incomeTax?: number;            // 法人税等

  updatedAt: string;
}

/** 円 → 表示用（未入力は null を返し「—」で出す＝0と区別する） */
export function yenOrNull(v: number | undefined): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}
export function n(v: number | undefined): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}
