// src/lib/emailNotify.ts — クライアントから /api/email/send を呼ぶヘルパー
// 失敗時はコンソールログのみ (UI をブロックしない)

type Template = 'welcome' | 'trial_ending' | 'cancel_save';

export async function sendEmail(
  to: string,
  template: Template,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, template, data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      if (err.error === 'EMAIL_NOT_CONFIGURED') return; // env 未設定は無視
      console.warn('[emailNotify] send failed:', err.error);
    }
  } catch (e) {
    console.warn('[emailNotify] network error:', e);
  }
}
