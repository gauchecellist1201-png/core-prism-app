export type CRMStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export const STAGE_META: Record<CRMStage, { label: string; emoji: string; color: string }> = {
  lead:        { label: 'リード',     emoji: '🌱', color: '#9088A8' },
  qualified:   { label: '商談中',     emoji: '☕', color: '#5BA8FF' },
  proposal:    { label: '提案中',     emoji: '📋', color: '#C084FC' },
  negotiation: { label: '交渉中',     emoji: '🤝', color: '#FFA94D' },
  won:         { label: '受注',       emoji: '🎉', color: '#4ADE80' },
  lost:        { label: '失注',       emoji: '✗',  color: '#9088A8' },
};

export interface CRMContact {
  id: string;
  name: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface CRMActivity {
  id: string;
  date: string;          // YYYY-MM-DD
  type: 'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice';
  summary: string;
  /** 関連する内部リソース ID (任意) */
  refId?: string;
}

export interface CRMDeal {
  id: string;
  personaId: string;
  title: string;
  contact?: CRMContact;
  amount?: number;       // 想定金額 (円)
  probability?: number;  // 受注確度 0-100
  stage: CRMStage;
  expectedCloseDate?: string;
  source?: string;       // リードソース (例: 紹介、Web、SNS)
  description?: string;
  activities: CRMActivity[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;     // won/lost 時
  lostReason?: string;
}

export const STAGE_ORDER: CRMStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
