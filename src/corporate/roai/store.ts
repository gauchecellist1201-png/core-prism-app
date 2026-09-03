// ============================================================
// roai/store — 診断の回答を手元（localStorage）に残す。
//   ・途中で閉じても、戻ったら続きから（Diagnosis Completion Rate のため）
//   ・結果画面を再表示できる（Result View Rate のため）
//   ・個人情報（会社名・メール）は結果と分けて保存し、送信後に消す
// 書き込み結果を見ずに「保存しました」と言わない（[[env_ui_claims_success_without_checking_write]]）。
// ============================================================
import type { Answers } from './schema';

const KEY = 'core_roai_v1';
export const ROAI_SCHEMA_VERSION = 1;

export interface RoaiSession {
  v: number;
  answers: Answers;
  /** 最後に見ていた質問の index（再開位置） */
  idx: number;
  startedAt: number;
  completedAt?: number;
  /** どのページ・章から診断を始めたか（Analytics: source） */
  source?: string;
  /** 詳細レポートを申し込んだか（同じ人に二度フォームを出さない） */
  leadSent?: 'report' | 'consult';
}

export function loadSession(): RoaiSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RoaiSession;
    if (!s || s.v !== ROAI_SCHEMA_VERSION || typeof s.answers !== 'object') return null;
    return s;
  } catch { return null; }
}

export function saveSession(s: RoaiSession): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return localStorage.getItem(KEY) !== null;
  } catch { return false; }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

export function newSession(source?: string): RoaiSession {
  return { v: ROAI_SCHEMA_VERSION, answers: {}, idx: 0, startedAt: Date.now(), source };
}
