// ============================================================
// 日程調整 (Meeting Scheduler) の型定義
// ============================================================

export type MeetingDuration = 15 | 30 | 45 | 60 | 90;
export type LocationKind = 'google-meet' | 'zoom' | 'phone' | 'in-person' | 'custom';

export interface AvailabilityRules {
  /** 利用可能な曜日 (0=日 ... 6=土)。デフォルト 平日のみ */
  weekdays: number[];
  /** 時刻ウィンドウ。複数登録可 (例: 10-12, 14-18) */
  windows: { startHour: number; endHour: number }[]; // 0–23
  /** 何時間前から予約可能か (例: 4 = 4時間後以降のみ) */
  advanceMinHours: number;
  /** 何日先まで予約可能か */
  advanceMaxDays: number;
  /** タイムゾーン (IANA, 例: Asia/Tokyo) */
  timezone: string;
  /** 前後バッファ (分) */
  bufferMin: number;
}

export interface MeetingType {
  id: string;
  personaId: string;
  name: string;                      // 例: "30分ミーティング"
  description?: string;              // ゲスト向け説明
  duration: MeetingDuration;
  location: LocationKind;
  customLocation?: string;
  active: boolean;
  rules: AvailabilityRules;
  createdAt: string;
  /** 予約成立時にホストが受け取る通知メールアドレス */
  hostEmail: string;
  /** カラー (人格カラーとは独立に設定可) */
  color?: string;
}

/** ゲストが予約ページで使う、エンコード済みコンフィグ */
export interface BookingConfig {
  v: 1;                              // バージョン
  host: string;                      // ホスト表示名
  hostEmail: string;
  personaName: string;
  personaIcon?: string;
  personaColor?: string;
  meetingTypeId: string;
  meetingName: string;
  description?: string;
  duration: MeetingDuration;
  location: LocationKind;
  customLocation?: string;
  /** 事前計算済みの空き時間スナップショット (ISO) */
  slots: string[];
  generatedAt: string;
}
