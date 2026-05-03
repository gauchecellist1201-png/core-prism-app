// ============================================================
// 売上台帳 (Sales Ledger) 型定義
// ============================================================

export type SalesEntrySource = 'invoice' | 'manual';
export type SalesPaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface SalesEntry {
  id: string;
  personaId: string;
  source: SalesEntrySource;
  /** 請求書由来の場合は invoice.id */
  invoiceId?: string;
  /** 取引日 (請求書なら issueDate、手動なら任意) YYYY-MM-DD */
  date: string;
  /** 取引先名 */
  clientName: string;
  /** 件名・摘要 */
  subject: string;
  /** 内訳: 税率別の小計 */
  subtotal10: number; // 10%対象 税抜
  subtotal8: number;  // 軽減 8% 対象 税抜
  subtotal0: number;  // 非課税
  tax10: number;
  tax8: number;
  /** 合計 */
  totalExcl: number;  // 税抜合計
  totalTax: number;   // 消費税合計
  totalIncl: number;  // 税込合計
  /** 入金状況 */
  status: SalesPaymentStatus;
  paidAmount?: number;       // 部分入金額 (status=partial)
  paidDate?: string;         // 入金日 (YYYY-MM-DD)
  /** メモ */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesSummary {
  /** 期間ラベル */
  label: string;
  /** ISO 開始 */
  start: string;
  /** ISO 終了 */
  end: string;
  count: number;
  totalExcl: number;
  totalTax: number;
  totalIncl: number;
  paidIncl: number;
  unpaidIncl: number;
}
