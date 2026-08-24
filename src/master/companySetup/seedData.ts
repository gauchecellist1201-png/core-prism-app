// ============================================================
// /master/company-setup — 初期データ (2026-08-24 時点の実際の進捗を反映)
// ============================================================
import type {
  CompanySetupPhase,
  CompanySetupTask,
  CompanyPayment,
  CompanyDocument,
  CompanySetupState,
} from './types';

const SEED_AT = '2026-08-24T00:00:00.000+09:00';
const DUE_825 = '2026-08-25';

export const PHASES: CompanySetupPhase[] = [
  { id: 'prep', title: '準備', order: 0 },
  { id: 'docs-prep', title: '書類準備', order: 1 },
  { id: 'drafting', title: '書類作成', order: 2 },
  { id: 'confirm', title: '確認・認証', order: 3 },
  { id: 'payment', title: '払込', order: 4 },
  { id: 'registration', title: '登記', order: 5 },
  { id: 'post-registration', title: '登記後', order: 6 },
];

function task(partial: Omit<CompanySetupTask, 'createdAt' | 'updatedAt' | 'activatedAt' | 'completedAt'> & {
  completed?: boolean;
}): CompanySetupTask {
  const completed = partial.completed ?? false;
  return {
    id: partial.id,
    phaseId: partial.phaseId,
    title: partial.title,
    description: partial.description,
    status: completed ? 'completed' : partial.status,
    priority: partial.priority,
    dueDate: partial.dueDate,
    completedAt: completed ? SEED_AT : null,
    activatedAt: partial.dependencies.length === 0 || completed ? SEED_AT : null,
    memo: partial.memo,
    cost: partial.cost,
    actualCost: partial.actualCost,
    documents: partial.documents,
    nextAction: partial.nextAction,
    dependencies: partial.dependencies,
    waitingFor: partial.waitingFor,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  };
}

export const INITIAL_TASKS: CompanySetupTask[] = [
  task({
    id: 'name-decided', phaseId: 'prep', title: '法人名決定', description: '株式会社COREとして商号を確定する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'seal-ordered', phaseId: 'prep', title: '法人印鑑注文', description: '代表印・銀行印・角印を注文する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: 6580, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'service-selected', phaseId: 'prep', title: '設立サービス選定', description: '井坂事務所を設立代行として選定する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'karte-sent', phaseId: 'prep', title: '設立カルテ送信', description: '井坂事務所へ設立カルテ (基本情報) を送信する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'capital-decided', phaseId: 'prep', title: '資本金決定', description: '資本金200万円に決定。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'no-board', phaseId: 'prep', title: '取締役会非設置決定', description: '取締役会を設置しない機関設計に決定。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'representative-decided', phaseId: 'prep', title: '代表取締役決定', description: '代表取締役を確定する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),
  task({
    id: 'purpose-drafted', phaseId: 'prep', title: '事業目的基本案入力', description: '定款に記載する事業目的の基本案を入力する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '', dependencies: [], waitingFor: null, completed: true,
  }),

  task({
    id: 'personal-seal-cert', phaseId: 'docs-prep', title: '個人印鑑証明書を取得する',
    description: '代表者本人の印鑑登録証明書を取得する。',
    status: 'not_started', priority: 'critical', dueDate: DUE_825, memo: '', cost: null, actualCost: null,
    documents: ['doc-personal-seal-cert'], nextAction: '市区町村窓口またはコンビニ交付で印鑑登録証明書を取得する',
    dependencies: [], waitingFor: null,
  }),
  task({
    id: 'id-verification-docs', phaseId: 'docs-prep', title: '本人確認書類を準備する',
    description: '運転免許証など本人確認書類のコピーを準備する。',
    status: 'not_started', priority: 'critical', dueDate: DUE_825, memo: '', cost: null, actualCost: null,
    documents: ['doc-id-verification'], nextAction: '本人確認書類のコピーを用意する',
    dependencies: [], waitingFor: null,
  }),
  task({
    id: 'send-to-isaka', phaseId: 'docs-prep', title: '井坂事務所へ必要資料を送付する',
    description: '個人印鑑証明書・本人確認書類を井坂事務所へ送付する。',
    status: 'not_started', priority: 'high', dueDate: DUE_825, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '印鑑証明書・本人確認書類をまとめて井坂事務所へ送る',
    dependencies: ['personal-seal-cert', 'id-verification-docs'], waitingFor: null,
  }),
  task({
    id: 'pay-8360', phaseId: 'docs-prep', title: '8,360円を振り込む',
    description: '井坂事務所への設立代行手数料を振り込む。',
    status: 'not_started', priority: 'high', dueDate: DUE_825, memo: '', cost: 8360, actualCost: null,
    documents: [], nextAction: '井坂事務所へ8,360円を振り込む',
    dependencies: [], waitingFor: null,
  }),

  task({
    id: 'isaka-drafting', phaseId: 'drafting', title: '井坂事務所「書類作成中」',
    description: '井坂事務所が設立書類一式の作成に着手する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '井坂事務所からの書類到着を待つ',
    dependencies: ['karte-sent', 'send-to-isaka', 'pay-8360'], waitingFor: '井坂事務所からの書類到着',
  }),
  task({
    id: 'docs-arrived', phaseId: 'drafting', title: '設立書類が到着する',
    description: '井坂事務所から設立書類一式が到着する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: ['doc-articles-package'], nextAction: '郵送物を受け取り、内容を確認する',
    dependencies: ['isaka-drafting'], waitingFor: null,
  }),

  task({
    id: 'review-and-seal', phaseId: 'confirm', title: '書類を確認し、押印する',
    description: '届いた設立書類一式を確認し、必要箇所に押印する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: [], nextAction: '書類の内容を確認し、押印する',
    dependencies: ['docs-arrived'], waitingFor: null,
  }),
  task({
    id: 'articles-notarization', phaseId: 'confirm', title: '定款認証を受ける',
    description: '公証役場で定款認証を受ける。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: 42000, actualCost: null,
    documents: ['doc-certified-articles'], nextAction: '公証役場で定款認証の手続きを行う',
    dependencies: ['review-and-seal'], waitingFor: null,
  }),

  task({
    id: 'capital-payment', phaseId: 'payment', title: '資本金2,000,000円を払い込む',
    description: '発起人の口座へ資本金を払い込む。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: ['doc-capital-proof'], nextAction: '発起人口座へ資本金2,000,000円を払い込む',
    dependencies: ['articles-notarization'], waitingFor: null,
  }),

  task({
    id: 'registration-application', phaseId: 'registration', title: '登記申請を行う',
    description: '法務局へ設立登記を申請する。この申請日が会社の設立日になる。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: 150000, actualCost: null,
    documents: [], nextAction: '法務局へ設立登記を申請する',
    dependencies: ['capital-payment'], waitingFor: null,
  }),

  task({
    id: 'registry-certificate', phaseId: 'post-registration', title: '履歴事項全部証明書を取得する',
    description: '登記完了後、履歴事項全部証明書を取得する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: ['doc-registry-certificate'], nextAction: '法務局で履歴事項全部証明書を取得する',
    dependencies: ['registration-application'], waitingFor: null,
  }),
  task({
    id: 'corporate-seal-certificate', phaseId: 'post-registration', title: '法人印鑑証明書を取得する',
    description: '登記完了後、法人印鑑証明書を取得する。',
    status: 'not_started', priority: 'normal', dueDate: null, memo: '', cost: null, actualCost: null,
    documents: ['doc-corporate-seal-cert'], nextAction: '法務局で法人印鑑証明書を取得する',
    dependencies: ['registration-application'], waitingFor: null,
  }),
];

export const INITIAL_PAYMENTS: CompanyPayment[] = [
  {
    // 「法人印鑑注文」タスクは完了済みだが、注文 = 支払い確定ではないため relatedTaskId は結び付けない
    // (結び付けると完了タスクの自動連動で「支払済み」を断定してしまい、未確認の金額を確定させてしまう)。
    id: 'pay-company-seal', label: '会社印鑑', plannedAmount: 6580, actualAmount: null,
    dueDate: null, status: 'unpaid', paidAt: null, memo: '', relatedTaskId: null,
    isCapital: false, createdAt: SEED_AT, updatedAt: SEED_AT,
  },
  {
    id: 'pay-isaka', label: '井坂事務所', plannedAmount: 8360, actualAmount: null,
    dueDate: DUE_825, status: 'unpaid', paidAt: null, memo: '', relatedTaskId: 'pay-8360',
    isCapital: false, createdAt: SEED_AT, updatedAt: SEED_AT,
  },
  {
    id: 'pay-notary', label: '公証役場', plannedAmount: 42000, actualAmount: null,
    dueDate: null, status: 'unpaid', paidAt: null, memo: '約42,000円 (定款認証時に確定)', relatedTaskId: 'articles-notarization',
    isCapital: false, createdAt: SEED_AT, updatedAt: SEED_AT,
  },
  {
    id: 'pay-registration-tax', label: '登録免許税', plannedAmount: 150000, actualAmount: null,
    dueDate: null, status: 'unpaid', paidAt: null, memo: '', relatedTaskId: 'registration-application',
    isCapital: false, createdAt: SEED_AT, updatedAt: SEED_AT,
  },
  {
    id: 'pay-capital', label: '資本金', plannedAmount: 2000000, actualAmount: null,
    dueDate: null, status: 'locked', paidAt: null, memo: '', relatedTaskId: 'capital-payment',
    isCapital: true, createdAt: SEED_AT, updatedAt: SEED_AT,
  },
];

export const INITIAL_DOCUMENTS: CompanyDocument[] = [
  { id: 'doc-personal-seal-cert', name: '個人印鑑証明書', status: 'not_acquired', fileUrl: null, relatedTaskId: 'personal-seal-cert', memo: '', updatedAt: SEED_AT },
  { id: 'doc-id-verification', name: '本人確認書類', status: 'not_acquired', fileUrl: null, relatedTaskId: 'id-verification-docs', memo: '', updatedAt: SEED_AT },
  { id: 'doc-articles-package', name: '設立書類', status: 'not_acquired', fileUrl: null, relatedTaskId: 'docs-arrived', memo: '', updatedAt: SEED_AT },
  { id: 'doc-certified-articles', name: '認証済み定款', status: 'not_acquired', fileUrl: null, relatedTaskId: 'articles-notarization', memo: '', updatedAt: SEED_AT },
  { id: 'doc-capital-proof', name: '資本金払込証明', status: 'not_acquired', fileUrl: null, relatedTaskId: 'capital-payment', memo: '', updatedAt: SEED_AT },
  { id: 'doc-registry-certificate', name: '履歴事項全部証明書', status: 'not_acquired', fileUrl: null, relatedTaskId: 'registry-certificate', memo: '', updatedAt: SEED_AT },
  { id: 'doc-corporate-seal-cert', name: '法人印鑑証明書', status: 'not_acquired', fileUrl: null, relatedTaskId: 'corporate-seal-certificate', memo: '', updatedAt: SEED_AT },
];

export function buildInitialState(): CompanySetupState {
  return {
    version: 1,
    phases: PHASES,
    tasks: INITIAL_TASKS,
    payments: INITIAL_PAYMENTS,
    documents: INITIAL_DOCUMENTS,
    settings: {
      foundingDateTarget: null,
      docPrepStartDateOverride: null,
    },
  };
}
