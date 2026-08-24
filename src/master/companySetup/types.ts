// ============================================================
// /master/company-setup — 株式会社CORE 法人設立トラッカー 型定義
// ============================================================

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface CompanySetupTask {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // ISO date (YYYY-MM-DD)
  completedAt: string | null; // ISO datetime
  activatedAt: string | null; // ISO datetime — 依存タスク解放でこのタスクに着手可能になった時刻
  memo: string;
  cost: number | null; // 予定額 (円)
  actualCost: number | null; // 実績額 (円)
  documents: string[]; // このタスクに紐づく CompanyDocument.id
  nextAction: string; // 「今すぐ何をするか」一行
  dependencies: string[]; // 先に completed が必要な CompanySetupTask.id
  waitingFor: string | null; // 外部待ち事項の自由記述 (例: 「井坂事務所からの返送」)
  createdAt: string;
  updatedAt: string;
}

export interface CompanySetupPhase {
  id: string;
  title: string;
  order: number;
}

export type PaymentStatus = 'unpaid' | 'locked' | 'paid';

export interface CompanyPayment {
  id: string;
  label: string;
  plannedAmount: number;
  actualAmount: number | null;
  dueDate: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  memo: string;
  relatedTaskId: string | null;
  isCapital: boolean; // true = 資本金 (費用集計から除外)
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 'not_acquired' | 'acquired' | 'sent';

export interface CompanyDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  fileUrl: string | null;
  relatedTaskId: string | null;
  memo: string;
  updatedAt: string;
}

export interface CompanySettings {
  /** 希望設立日 (YYYY-MM-DD) */
  foundingDateTarget: string | null;
  /** 書類作成開始日を手動で上書きしたい場合 (未設定なら井坂事務所着手タスクの activatedAt を使う) */
  docPrepStartDateOverride: string | null;
}

export interface CompanySetupState {
  version: 1;
  phases: CompanySetupPhase[];
  tasks: CompanySetupTask[];
  payments: CompanyPayment[];
  documents: CompanyDocument[];
  settings: CompanySettings;
}
