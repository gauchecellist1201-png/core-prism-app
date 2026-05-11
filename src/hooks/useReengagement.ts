// ============================================================
// useReengagement — 1 日以上ブランクで再訪したユーザーへ朝メール送信
// ============================================================
// 真にユーザーが「不在」中にメールを送るにはサーバーサイドの
// クーロンが必要だが、現状はユーザー情報が localStorage のみ。
// 妥協案: 再訪時の最初の起動で「翌朝に届くはずだったメール」を
// その場でキックする。送信後は同日内に二重送信しないよう記録する。
// ============================================================
import { useEffect } from 'react';
import { type TouchResult, markReengagedToday, shouldSendReengagement } from '../lib/dailyStreak';
import { loadBillingUser } from '../lib/billing';

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

    // 送信はバックグラウンドで。失敗しても UI には影響を与えない。
    const payload = {
      to: user.email,
      template: 'reengagement',
      data: {
        name: user.email.split('@')[0],
        brand,
        days: streakInfo.gapDays,
      },
    };
    fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => {
        // EMAIL_NOT_CONFIGURED (503) でも例外にしない。次に Resend 設定されたら送れる
        if (r.ok) markReengagedToday();
      })
      .catch(() => { /* オフライン等 */ });
  }, [streakInfo.returnedAfterAbsence, streakInfo.gapDays, brand, enabled]);
}
