// ============================================================
// CORE Identity OS — 型定義
// ============================================================

export type PersonaId = string; // UUID

export interface Persona {
  id: PersonaId;
  name: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  accentColorLight: string;
  description: string;           // AIへの人格説明
  createdAt: string;
  meetingSlug: string;           // ミーティングリンク用スラグ
  calendarColor?: string;        // Googleカレンダー連携カラー
  tasks: Task[];
  cashflow: CashflowData;
  timeAllocation: number;        // %（全人格合計100%）
}

// ── ナレッジベース ──────────────────────────────────────
export interface KnowledgeAnalysis {
  summary: string;               // 3-5行の要約
  insights: string[];            // 重要ポイント
  strategy: string[];            // 戦略提案
  actions: string[];             // 推奨アクション
  risks: string[];               // リスク・懸念
  generatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  personaId: PersonaId;
  title: string;
  content: string;               // 全文テキスト
  chunks: KnowledgeChunk[];      // RAG用チャンク
  sourceType: 'file' | 'note' | 'url' | 'auto';
  fileKind?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'text' | 'image' | 'unknown';
  fileName?: string;
  fileSize?: number;
  pages?: number;
  imageBase64?: string;
  createdAt: string;
  tags: string[];
  analysis?: KnowledgeAnalysis;
  analysisStatus?: 'pending' | 'done' | 'error';
  analysisError?: string;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  score?: number;                // 検索スコア
}

// ── タスク ────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  priority: 'high' | 'mid' | 'low';
  due: string;
  done: boolean;
  personaId?: PersonaId;
  calendarEventId?: string;      // Googleカレンダー連携ID
}

// ── 財務 ──────────────────────────────────────────────────
export interface CashflowData {
  income: number;
  expense: number;
  label: string;
}

// ── チャット ──────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  usedKnowledge?: string[];      // RAGで使ったナレッジのID
  tokensUsed?: number;
}

// ── ミーティング ──────────────────────────────────────────
export interface MeetingLink {
  id: string;
  personaId: PersonaId;
  slug: string;
  title: string;
  duration: 15 | 30 | 45 | 60;
  description: string;
  url: string;
}

// ── Googleカレンダーイベント ──────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  personaId?: PersonaId;
  colorId?: string;
  meetingUrl?: string;
  description?: string;
}

// ── アプリ設定 ────────────────────────────────────────────
export interface AppSettings {
  claudeApiKey: string;
  preferredModel: 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'claude-opus-4-5';
  googleCalendarConnected: boolean;
  googleAccessToken?: string;
  userName: string;
  onboardingComplete: boolean;
  usageStats: UsageStats;
  // 能動提案
  proactiveEnabled?: boolean;
  voiceEnabled?: boolean;
  voiceLang?: string;
  proactiveIntervalMin?: number;
  /** AI の文体 (デフォルト: gentle = やさしく) */
  aiTone?: 'gentle' | 'professional' | 'casual';
}

// ── 能動提案 ─────────────────────────────────────────────
export interface Proposal {
  id: string;
  personaId: PersonaId;
  title: string;          // 短い見出し (10-20文字)
  message: string;        // 本文 (音声用、簡潔に)
  actions: string[];      // 推奨アクション (タスク化候補)
  context: string;        // 何を見て出した提案か
  generatedAt: string;
  spoken?: boolean;
  dismissed?: boolean;
}

export interface UsageStats {
  totalTokensUsed: number;
  totalMessages: number;
  estimatedCostUsd: number;
  lastReset: string;
}
