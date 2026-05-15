// ============================================================
// emailNotify — 3 段フォールバック
// 1) Resend  (/api/email/send)
// 2) Gmail SMTP  (/api/mail/gmail)
// 3) アプリ内通知トースト (window 'core:notify')
// どこで届いたかにかかわらず UI は止めない
// ============================================================
import { notifyInApp } from './inAppNotify';

type Template = 'welcome' | 'trial_ending' | 'cancel_save' | 'reengagement';

interface EmailData {
  name?: string;
  brand?: string;
  plan?: string;
  code?: string;
  days?: number;
  upgradeUrl?: string;
}

export type SendResult =
  | { ok: true; via: 'resend' | 'gmail' | 'inapp' }
  | { ok: false };

async function tryEndpoint(
  path: string,
  to: string,
  template: Template,
  data: EmailData,
): Promise<{ ok: boolean; status: number }> {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, template, data }),
    });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function inAppFallback(template: Template, data: EmailData): void {
  const brand = data.brand === 'iris' ? 'Iris' : 'CORE Prism';
  const name = data.name || '';
  if (template === 'welcome') {
    notifyInApp({
      kind: 'success',
      title: `ようこそ${name ? '、' + name + ' さん' : ''}`,
      body: `${brand} の準備ができました。ダッシュボードから始められます。`,
    });
    return;
  }
  if (template === 'trial_ending') {
    notifyInApp({
      kind: 'warn',
      title: `無料トライアルがあと ${data.days ?? 3} 日`,
      body: '使い続けるには有料プランへの切り替えをご検討ください。',
    });
    return;
  }
  if (template === 'cancel_save') {
    notifyInApp({
      kind: 'info',
      title: 'ご利用ありがとうございました',
      body: `気が変わったらいつでも戻ってこられます。クーポン: ${data.code || 'COMEBACK50'}`,
    });
    return;
  }
  if (template === 'reengagement') {
    notifyInApp({
      kind: 'info',
      title: `${brand} がお待ちしています`,
      body: '今日のブリーフが準備できています。',
    });
    return;
  }
}

export async function sendEmail(
  to: string,
  template: Template,
  data: EmailData = {},
): Promise<SendResult> {
  // 1) Resend
  const r1 = await tryEndpoint('/api/email/send', to, template, data);
  if (r1.ok) return { ok: true, via: 'resend' };

  // 2) Gmail SMTP
  const r2 = await tryEndpoint('/api/mail/gmail', to, template, data);
  if (r2.ok) return { ok: true, via: 'gmail' };

  // 3) アプリ内通知
  inAppFallback(template, data);
  return { ok: true, via: 'inapp' };
}
