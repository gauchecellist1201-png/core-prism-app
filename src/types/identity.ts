// ============================================================
// CORE Identity OS — 型定義
// ============================================================

export type PersonaId = string; // UUID

export interface Persona {
  id: PersonaId;
  name: string;
  subtitle: string;
  icon: string;
  /** 自動生成された SVG アバター (data URL)。未設定なら icon 絵文字にフォールバック。 */
  avatarUrl?: string;
  accentColor: string;
  accentColorLight: string;
  description: string;           // AIへの人格説明
  /** 指示書 — この人格のAIに常時守らせるルール (文体・前提・目標など)。全AI会話/提案のシステムプロンプトへ注入 */
  instructions?: string;
  createdAt: string;
  meetingSlug: string;           // ミーティングリンク用スラグ
  calendarColor?: string;        // Googleカレンダー連携カラー
  tasks: Task[];
  cashflow: CashflowData;
  timeAllocation: number;        // %（全人格合計1%）
}

// ── ナレッジベース ──────────────────────────────
export interface KnowledgeAnalysis {
  summary: string;               // 3-5行の要約
  insights: string[];            // 重要ポイント
  strategy: string[];            // 戦略提案
  actions: string[];             // 推奨アクション
  risks: string[];               // リスク・憶念
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
  /** 同じフォルダ取込 (一括取込) 単位の ID。まとめて削除に使う。旧データは未設定=個別削除のみ */
  batchId?: string;
  analysis?: KnowledgeAnalysis;
  /**
   * 取り込み進捗。'pending' は互換のため残置 (≈ 'parsing')。
   * 'parsing' → 'tagging' → 'summarizing' → 'extracting' → 'done' / 'error'
   */
  analysisStatus?: 'pending' | 'parsing' | 'tagging' | 'summarizing' | 'extracting' | 'done' | 'error';
  analysisError?: string;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  score?: number;                // 検索スコア
}

// ── タスク ──────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  priority: 'high' | 'mid' | 'low';
  due: string;
  done: boolean;
  personaId?: PersonaId;
  calendarEventId?: string;      // Googleカレンダー連携ID
  /** 完了予想時間 (分) — 時間ブロック表示用 */
  estimatedMin?: number;
  /** タスク作成時刻 (追加順ソート / streak 用) */
  createdAt?: string;
  /** 完了時刻 (streak 表示用) */
  completedAt?: string;
  /** AI 会社に委任した AgentTask の ID */
  delegatedAgentTaskId?: string;
}

// ── 財務 ──────────────────────────────────────────
export interface CashflowData {
  income: number;
  expense: number;
  label: string;
}

// ── チャット ──────────────────────────────────────────
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

// ── アプリ設定 ────────────────────────────────────────
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
  /** UI 表示言語 */
  uiLanguage?: 'ja' | 'en' | 'zh';
  /** オーナーの業種 (業界別パッケージで AI 提案を最適化) */
  industry?: 'food' | 'beauty' | 'it' | 'realestate' | 'ec' | 'medical' | 'education';
}

// ── 能動提案 ─────────────────────────────────────────
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
  /**
   * この提案の生成時にプロンプトへ実際に織り込んだナレッジ件数 (実データのみ・嘘数字禁止)。
   * 0件 or undefined の場合は UI 側で根拠チップを一切表示しない。
   */
  knowledgeUsedCount?: number;
  /**
   * この提案の生成時に実際にデータが返った連携サービスのラベル
   * (例: 'Gmail' | 'カレンダー' | 'Stripe' | 'Instagram' | 'LINE配信')。
   * 空 or undefined のときは UI 側で連携根拠チップを一切出さない (嘘の根拠を出さない)。
   */
  dataSources?: string[];
}

export interface UsageStats {
  totalTokensUsed: number;
  totalMessages: number;
  estimatedCostUsd: number;
  lastReset: string;
}
