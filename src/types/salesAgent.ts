// ============================================================
// 商談 AI エージェント — 型定義 (リサーチ・リスト・アプローチ・シグナル)
// ============================================================

export interface CompanyResearch {
  id: string;
  personaId: string;
  companyName: string;
  url?: string;
  industry?: string;
  /** 売上規模 推定 */
  revenueEstimate?: string;
  /** 従業員数 推定 */
  employeeCount?: string;
  /** 公式情報・概要 */
  overview?: string;
  /** AI 推定の課題リスト */
  predictedChallenges?: string[];
  /** AI 提案: 売り込み方の核心 */
  pitchAngle?: string;
  /** AI 提案: 重要人物の探し方 */
  keyPersonHints?: string[];
  /** AI 推奨アプローチ手順 */
  recommendedSteps?: string[];
  /** ホットシグナル 推定 */
  signals?: string[];
  /** カスタムメモ */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** リード = 営業対象 (1人 or 企業の窓口) */
export interface SalesLead {
  id: string;
  personaId: string;
  companyId?: string;        // CompanyResearch.id へのリンク
  companyName: string;
  contactName?: string;
  contactRole?: string;
  email?: string;
  phone?: string;
  /** AI スコアリング 0-100 */
  score: number;
  /** AI が判定したスコア理由 */
  scoreReason?: string;
  /** ステータス */
  stage: 'new' | 'researching' | 'approached' | 'replied' | 'meeting-set' | 'closed-won' | 'closed-lost';
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApproachDraft {
  id: string;
  leadId: string;
  type: 'email' | 'linkedin' | 'phone-script';
  subject?: string;
  body: string;
  /** AI が選んだトーン */
  tone: string;
  /** ヒット予測 (AI 推定) 0-100 */
  hitProbability?: number;
  status: 'draft' | 'sent' | 'replied' | 'no-reply';
  generatedAt: string;
}

export interface IntentSignal {
  id: string;
  personaId: string;
  companyId?: string;
  companyName: string;
  /** "採用拡大" "資金調達" "新製品リリース" 等 */
  signalType: string;
  /** 重要度 */
  severity: 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
  /** "次にすべきアクション" の AI 提案 */
  suggestedAction?: string;
  read?: boolean;
}

export const SALES_STAGE_LABELS: Record<SalesLead['stage'], { label: string; emoji: string; color: string }> = {
  'new':           { label: '新規',       emoji: '🌱', color: '#9088A8' },
  'researching':   { label: '調査中',     emoji: '🔍', color: '#5BA8FF' },
  'approached':    { label: 'アプローチ済', emoji: '📨', color: '#C084FC' },
  'replied':       { label: '返信あり',   emoji: '💬', color: '#FFA94D' },
  'meeting-set':   { label: '商談確定',   emoji: '🤝', color: '#4ADE80' },
  'closed-won':    { label: '受注',       emoji: '🎉', color: '#10B981' },
  'closed-lost':   { label: '失注',       emoji: '✗',  color: '#F87171' },
};
