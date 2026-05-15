// ============================================================
// useReengagement — 1 日以上ブランクで再訪したユーザーへ朝メール送信
// ============================================================
// 真にユーザーが「不在」中にメールを送るにはサーバーサイドの
// クーロンが必要だが、現状はユーザー情報が localStorage のみ。
// 妥協案: 再訪時の最初の起動で「翌朝に届くはずだったメール」を
// その場でキックする。送信後は同日内に二重送信しないよう記録する。
// 送信先は emailNotify の 3 段フォールバック (Resend → Gmail → アプリ内通知)。
// ============================================================
import { useEffect } from 'react';
import { type TouchResult, markReengagedToday, shouldSendReengagement } from '../lib/dailyStreak';
import { loadBillingUser } from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';

interface Opts {
  brand: 'iris' | 'prism';
  enabled?: boolean;
}

export function useReengagement(streakInfo: TouchResult, { brand, enabled = true }: Opts) {
  useEffect(() => {
    if (!enabled) return;
    if (!streakInfo.returnedAfterAbsence) return;
    if (!shouldSendReengagement(streakInfo.gapDays)) return;

    const user = loadBillingUser();
    if (!user?.email) return;

    // 失敗してもアプリ内通知に必ず落ちるので、結果は気にせず markReengagedToday する
    sendEmail(user.email, 'reengagement', {
      name: user.email.split('@')[0],
      brand,
      days: streakInfo.gapDays,
    })
      .then(() => markReengagedToday())
      .catch(() => { /* noop — sendEmail は throw しない設計 */ });
  }, [streakInfo.returnedAfterAbsence, streakInfo.gapDays, brand, enabled]);
}
