// ============================================================
// 請求書 (Invoice) — インボイス制度 (2023.10〜) 対応の型定義
// ============================================================

export type TaxRate = 10 | 8 | 0; // 標準 / 軽減 / 非課税

export interface IssuerProfile {
  /** 人格に紐づく */
  personaId: string;
  companyName: string;          // 例: CORE
  representativeName?: string;  // 代表者氏名
  postalCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;  // 適格請求書発行事業者登録番号 (T + 13桁)
  bankInfo?: string;            // 例: "○○銀行 △△支店 普通 1234567 コア カブシキガイシャ"
  /** 押印画像 (data URL) */
  sealDataUrl?: string;
  /** ロゴ画像 (data URL) */
  logoDataUrl?: string;
  notes?: string;               // 備考の定型文
}

export interface Client {
  id: string;
  name: string;                 // 例: 株式会社サンプル 御中
  contactName?: string;         // 担当者名
  postalCode?: string;
  address?: string;
  email?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;          // 品目・サービス内容
  quantity: number;             // 数量
  unit?: string;                // 単位 (式 / 時間 / 個 / 月 など)
  unitPrice: number;            // 単価 (税抜)
  taxRate: TaxRate;
  /** 軽減税率対象なら true (※マーク表示用) */
  reducedTax?: boolean;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  personaId: string;
  number: string;               // INV-{persona}-{YYYY}-{連番}
  issuerSnapshot: IssuerProfile;
  clientSnapshot: Client;
  subject: string;              // 件名 (例: 2026年5月分 ご請求)
  issueDate: string;            // YYYY-MM-DD
  dueDate: string;              // YYYY-MM-DD
  lines: InvoiceLine[];
  notes?: string;               // 備考
  paymentTerms?: string;        // 支払条件メモ
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

/** 同じ顧客への定期請求テンプレート */
export interface InvoiceTemplate {
  id: string;
  personaId: string;
  name: string;                 // テンプレ名 (例: A社 月額顧問料)
  clientId?: string;
  subjectTemplate?: string;
  lines: Omit<InvoiceLine, 'id'>[];
  notes?: string;
  paymentTerms?: string;
  createdAt: string;
}

export interface InvoiceTotals {
  subtotal10: number;           // 10%対象 税抜小計
  subtotal8: number;            // 8%対象 税抜小計
  subtotal0: number;            // 非課税 小計
  tax10: number;                // 10%消費税額
  tax8: number;                 // 8%消費税額
  subtotal: number;             // 全税抜小計
  totalTax: number;             // 消費税合計
  total: number;                // 税込合計
}

// ============================================================
// 書類シリーズ — 見積書 / 発注書 / 納品書 / 請求書 (第3弾)
// ============================================================

export type DocumentKind = 'estimate' | 'order' | 'delivery' | 'invoice';

/**
 * ステータス遷移:
 *   estimate: draft → sent → approved
 *   order:    draft → sent
 *   delivery: draft → delivered
 *   invoice:  draft → sent → paid → cancelled
 */
export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'delivered' | 'paid' | 'cancelled';

export interface BusinessDocument {
  id: string;
  personaId: string;
  kind: DocumentKind;
  status: DocumentStatus;
  /** EST/ORD/DEL/INV-{SLUG}-{YYYY}-{SEQ} */
  number: string;
  /** 複製元ドキュメント ID (例: estimate → order のとき estimate の id) */
  sourceDocumentId?: string;
  /** CRMDeal との紐付け */
  dealId?: string;
  issuerSnapshot: IssuerProfile;
  clientSnapshot: Client;
  subject: string;
  issueDate: string;            // YYYY-MM-DD
  /** 見積有効期限 (estimate 用) */
  validUntil?: string;
  /** 納期 / 納品日 (order / delivery 用) */
  deliveryDate?: string;
  /** 支払期限 (invoice 用) */
  dueDate?: string;
  lines: InvoiceLine[];
  notes?: string;
  paymentTerms?: string;
  createdAt: string;
  updatedAt: string;
}
