// ============================================================
// 請求書 (Invoice) — インボイス制度 (2023.10〜) 対応の型定義
// ============================================================

export type TaxRate = 10 | 8 | 0; // 標準 / 軽減 / 非課税

export interface IssuerProfile {
  /** 人格に紐づく */
  personaId: string;
  companyName: string;          // 例: CORE株式会社
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
