// ============================================================
// 人物ケア — 1on1 履歴 + センチメント分析 (第3弾)
// ============================================================

export type InteractionType = 'meeting' | '1on1' | 'email' | 'call' | 'note';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface PersonRecord {
  id: string;
  personaId: string;
  name: string;
  role?: string;
  company?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
  /** ISO date string of most recent interaction */
  lastInteraction?: string;
  createdAt: string;
  notes?: string;
  tags?: string[];
}

export interface PersonInteraction {
  id: string;
  personId: string;
  date: string;             // YYYY-MM-DD
  type: InteractionType;
  summary: string;
  sentiment?: SentimentType;
  highlights?: string[];
  concerns?: string[];
  nextTopics?: string[];
}
