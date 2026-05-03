export type ExpenseCategory =
  | '会議費' | '交際費' | '旅費交通費' | '通信費' | '消耗品費'
  | '広告宣伝費' | '外注費' | '地代家賃' | '水道光熱費' | '新聞図書費'
  | '研修費' | '支払手数料' | '租税公課' | '保険料' | 'その他';

export type ExpenseTaxRate = 10 | 8 | 0;

export interface ExpenseEntry {
  id: string;
  personaId: string;
  date: string;            // YYYY-MM-DD
  vendor: string;          // 店舗・取引先
  category: ExpenseCategory;
  description?: string;    // 摘要
  amountIncl: number;      // 税込
  taxRate: ExpenseTaxRate;
  amountExcl: number;      // 税抜 (自動計算)
  taxAmount: number;       // 税額 (自動計算)
  payment?: 'cash' | 'card' | 'bank' | 'paypay' | 'other';
  receiptDataUrl?: string; // レシート画像 (任意)
  notes?: string;
  source: 'manual' | 'ocr';
  createdAt: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; emoji: string; color: string }[] = [
  { value: '会議費',       emoji: '🍽',  color: '#FFA94D' },
  { value: '交際費',       emoji: '🥂',  color: '#FF6FB5' },
  { value: '旅費交通費',   emoji: '🚆',  color: '#5BA8FF' },
  { value: '通信費',       emoji: '📡',  color: '#4ADE80' },
  { value: '消耗品費',     emoji: '📦',  color: '#FACC15' },
  { value: '広告宣伝費',   emoji: '📢',  color: '#C084FC' },
  { value: '外注費',       emoji: '🤝',  color: '#5BA8FF' },
  { value: '地代家賃',     emoji: '🏢',  color: '#FFA94D' },
  { value: '水道光熱費',   emoji: '⚡',  color: '#FACC15' },
  { value: '新聞図書費',   emoji: '📚',  color: '#C084FC' },
  { value: '研修費',       emoji: '🎓',  color: '#4ADE80' },
  { value: '支払手数料',   emoji: '💳',  color: '#5BA8FF' },
  { value: '租税公課',     emoji: '🧾',  color: '#FF6FB5' },
  { value: '保険料',       emoji: '🛡',  color: '#4ADE80' },
  { value: 'その他',       emoji: '📌',  color: '#9088A8' },
];
