// emailNotify.ts — クライアント側メール送信ヘルパー
// /api/email/send を叩く。失敗時はログのみ (UI を止めない)

export type EmailTemplate = 'welcome' | 'trial_ending' | 'cancel_save';

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, string>,
): Promise<void> {
  try {
    await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, template, data }),
    });
  } catch (e) {
    console.warn('[emailNotify] failed to send email:', e);
  }
}
