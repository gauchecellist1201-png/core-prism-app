// ============================================================
// emailNotify — /api/email/send を叩くクライアントヘルパー
// 失敗しても UI を止めない (fire-and-forget)
// ============================================================

type Template = 'welcome' | 'trial_ending' | 'cancel_save';

interface EmailData {
  name?: string;
  brand?: string;
  plan?: string;
  code?: string;
  days?: number;
  upgradeUrl?: string;
}

export async function sendEmail(
  to: string,
  template: Template,
  data: EmailData = {},
): Promise<void> {
  try {
    await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, template, data }),
    });
  } catch {
    // サイレント失敗 — UI を止めない
  }
}
