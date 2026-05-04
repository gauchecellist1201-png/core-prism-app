// ============================================================
// インフルエンサー / クリエイターの案件管理 — 型定義
// PR / タイアップ / アンバサダー案件を「打診→交渉→契約→制作→投稿→報告」まで
// ============================================================

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'threads' | 'note' | 'multi';
export type ContentType = 'reel' | 'story' | 'post' | 'short' | 'longform' | 'tweet' | 'live' | 'article';

export type DealStage =
  | 'inquiry'         // 打診あり (新着)
  | 'negotiating'     // 交渉中 (条件詰め)
  | 'contracted'      // 契約完了 / 着手前
  | 'drafting'        // 制作中
  | 'draft-submitted' // 下書き提出済み (承認待ち)
  | 'approved'        // 承認OK / 投稿待ち
  | 'posted'          // 投稿済み (レポート待ち)
  | 'reported'        // レポート提出済み
  | 'closed'          // 完了 (入金済み)
  | 'declined';       // お断り / 失注

export interface PlatformMetrics {
  reach?: number;
  impressions?: number;
  engagementRate?: number; // パーセント (例: 4.5)
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  views?: number;          // 動画用
  watchTimeSec?: number;   // YouTube用
  clicks?: number;         // リンクトラッキング
}

export interface InfluencerDeal {
  id: string;
  personaId: string;
  /** ブランド名 (例: SHISEIDO, Apple) */
  brandName: string;
  /** 代理店名 (例: 電通, リーディング) */
  agencyName?: string;
  /** 商品/キャンペーン名 */
  productName?: string;
  /** SNS プラットフォーム */
  platform: Platform;
  /** コンテンツ形式 */
  contentType: ContentType;
  /** 報酬 (税抜・円) */
  fee: number;
  /** 二次利用料 (任意) */
  usageFee?: number;
  /** 納品物の説明 (例: フィード1本+ストーリー3本) */
  deliverables: string;
  /** 下書き提出期限 (ISO) */
  draftDeadline?: string;
  /** 本投稿期限 */
  postDeadline?: string;
  /** レポート提出期限 */
  reportDeadline?: string;
  /** 実際に投稿した日 */
  postedDate?: string;
  /** 投稿 URL */
  postUrl?: string;
  /** ステージ */
  stage: DealStage;
  /** 投稿後の数値 */
  metrics?: PlatformMetrics;
  /** 担当者名 */
  contactName?: string;
  contactEmail?: string;
  /** チームメンバーへの内部アサイン (Iris Team 機能) */
  assignedToMemberId?: string;
  /** 自由メモ (商品の特徴、相手の好み等) */
  notes?: string;
  /** ハッシュタグ・必須記載事項 */
  guidelines?: string;
  /** 投稿の下書き本文 */
  draftCopy?: string;
  createdAt: string;
  updatedAt: string;
}

/** 交渉メッセージの種類 */
export type NegotiationType =
  | 'first-reply'        // 初回返信 (受領 + 質問)
  | 'rate-counter'       // 報酬交渉 (カウンターオファー)
  | 'schedule-adjust'    // スケジュール調整
  | 'usage-rights'       // 二次利用 / 期間の交渉
  | 'scope-clarify'      // 業務範囲・修正回数の確認
  | 'decline-polite'     // 丁寧にお断り
  | 'follow-up'          // 返信なしへのリマインド
  | 'invoice-request'    // 請求書送付
  | 'report-cover';      // レポート送付の挨拶文

export interface NegotiationDraft {
  id: string;
  dealId: string;
  type: NegotiationType;
  subject?: string;
  body: string;
  /** AI が選んだトーン */
  tone: string;
  /** 自分が想定する成立確率 (0-100) */
  successProbability?: number;
  status: 'draft' | 'sent' | 'replied' | 'no-reply';
  generatedAt: string;
}

/** 自分のメディアキット (フォロワー / 平均ER 等を AI に渡すコンテキスト) */
export interface MediaKit {
  personaId: string;
  /** 表示名 */
  handleName?: string;
  /** プラットフォーム別フォロワー数 */
  followers?: Partial<Record<Platform, number>>;
  /** プラットフォーム別 平均エンゲージメント率 (%) */
  avgEngagementRate?: Partial<Record<Platform, number>>;
  /** 月間平均リーチ */
  monthlyReach?: number;
  /** 主なオーディエンス層 */
  audienceProfile?: string;
  /** 過去の代表案件 */
  caseHistory?: string;
  /** 希望報酬レンジ (例: フィード 1本 5万円〜) */
  rateCard?: string;
  /** 自身のブランド観・NG事項 */
  brandValues?: string;
  /** 法人/個人 */
  entity?: 'individual' | 'corporate';
  /** 屋号・会社名 (請求書発行用) */
  legalName?: string;
}

/** ステージ表示用ラベル + 色 */
export const DEAL_STAGE_META: Record<DealStage, { label: string; emoji: string; color: string; order: number }> = {
  'inquiry':         { label: '打診あり',     emoji: '📩', color: '#5BA8FF', order: 1 },
  'negotiating':     { label: '交渉中',       emoji: '💬', color: '#C084FC', order: 2 },
  'contracted':      { label: '契約完了',     emoji: '✍',  color: '#A78BFA', order: 3 },
  'drafting':        { label: '制作中',       emoji: '🎨', color: '#FFA94D', order: 4 },
  'draft-submitted': { label: '下書き提出',   emoji: '📋', color: '#FFC857', order: 5 },
  'approved':        { label: '承認OK',       emoji: '✅', color: '#4ADE80', order: 6 },
  'posted':          { label: '投稿済み',     emoji: '🚀', color: '#FF5C9C', order: 7 },
  'reported':        { label: 'レポート済み', emoji: '📊', color: '#10B981', order: 8 },
  'closed':          { label: '入金完了',     emoji: '🎉', color: '#059669', order: 9 },
  'declined':        { label: 'お断り',       emoji: '✗',  color: '#9CA3AF', order: 99 },
};

export const PLATFORM_META: Record<Platform, { label: string; emoji: string; color: string }> = {
  'instagram': { label: 'Instagram', emoji: '📷', color: '#E1306C' },
  'tiktok':    { label: 'TikTok',    emoji: '🎵', color: '#000000' },
  'youtube':   { label: 'YouTube',   emoji: '📺', color: '#FF0000' },
  'x':         { label: 'X (Twitter)', emoji: '𝕏', color: '#000000' },
  'threads':   { label: 'Threads',   emoji: '🧵', color: '#000000' },
  'note':      { label: 'note',      emoji: '📝', color: '#41C9B4' },
  'multi':     { label: '複数プラットフォーム', emoji: '🌐', color: '#6B7280' },
};

export const CONTENT_TYPE_META: Record<ContentType, string> = {
  'reel':     'リール',
  'story':    'ストーリー',
  'post':     'フィード投稿',
  'short':    'ショート動画',
  'longform': '長尺動画',
  'tweet':    'ポスト (X)',
  'live':     'ライブ配信',
  'article':  '記事',
};

export const NEGOTIATION_TYPE_META: Record<NegotiationType, { label: string; emoji: string; hint: string }> = {
  'first-reply':     { label: '初回返信',         emoji: '👋', hint: 'まずは興味あり / 詳細確認の質問を含む丁寧な受領文' },
  'rate-counter':    { label: '報酬カウンター',   emoji: '💴', hint: 'メディアキットの数字を根拠に、丁寧かつ毅然と提示' },
  'schedule-adjust': { label: 'スケジュール調整', emoji: '📅', hint: '納期の前倒し or 後ろ倒しを依頼' },
  'usage-rights':    { label: '二次利用の交渉',   emoji: '📜', hint: '広告利用範囲・期間・追加料金の合意形成' },
  'scope-clarify':   { label: '業務範囲の確認',   emoji: '🔍', hint: '修正回数・着手金・キャンセル料を含むスコープ詰め' },
  'decline-polite':  { label: '丁寧にお断り',     emoji: '🙏', hint: '関係を切らずに、また機会があればの柔らかな辞退' },
  'follow-up':       { label: 'リマインド',       emoji: '⏰', hint: '返信なしの相手に、催促感を出さずに状況確認' },
  'invoice-request': { label: '請求書送付',       emoji: '🧾', hint: '案件完了後、請求書送付の連絡 + 支払期日の確認' },
  'report-cover':    { label: 'レポート送付',     emoji: '📊', hint: '実績数値 + 振り返りコメント + 次回提案を含むカバー文' },
};
