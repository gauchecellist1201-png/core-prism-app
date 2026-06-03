// ============================================================
// secretsHealth.ts — 各 env キーの存在 + 動作疎通テスト
//
// オーナー指示 (2026-06-04 第 14 波 FFF):
//   /master/secrets-health で env 変数の有無 + 疎通を一目で確認。
//   キーの値は先頭 4 字 + 末尾 2 字だけ返す (秘密の漏洩防止)。
// ============================================================

export interface SecretCheck {
  key: string;
  label: string;
  present: boolean;
  preview: string; // 先頭 4 + ... + 末尾 2、または '—'
  reachOk: boolean | null; // null = 疎通テスト無し / true = OK / false = NG
  reachLatencyMs: number | null;
  reachNote: string;
}

function maskKey(v: string | undefined): string {
  if (!v) return '—';
  const s = String(v);
  if (s.length < 10) return s.slice(0, 2) + '…';
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value: T | null; note: string }> {
  const start = Date.now();
  try {
    const v = await fn();
    return { ok: true, ms: Date.now() - start, value: v, note: 'ok' };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, value: null, note: (e as Error).message?.slice(0, 200) || 'unknown error' };
  }
}

// ─── Anthropic ping (models 一覧 1 件で OK) ───
async function pingAnthropic(key: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json() as { data?: Array<{ id?: string }> };
  return `${j.data?.[0]?.id || 'model'} 取得 OK`;
}

// ─── Stripe whoami (account.retrieve) ───
async function pingStripe(key: string): Promise<string> {
  const res = await fetch('https://api.stripe.com/v1/account', {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json() as { id?: string; charges_enabled?: boolean; payouts_enabled?: boolean };
  const live = key.startsWith('sk_live') || key.startsWith('rk_live') ? 'live' : 'test';
  return `${j.id} (${live}, charges=${j.charges_enabled ? 'ON' : 'OFF'}, payouts=${j.payouts_enabled ? 'ON' : 'OFF'})`;
}

// ─── Resend ping (api keys 一覧 1 件) ───
async function pingResend(key: string): Promise<string> {
  const res = await fetch('https://api.resend.com/api-keys', {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json() as { data?: Array<{ id?: string; name?: string }> };
  return `keys=${j.data?.length || 0} 件`;
}

// ─── Gemini (Google AI Studio) ping ───
async function pingGemini(key: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json() as { models?: Array<{ name?: string }> };
  return `${j.models?.[0]?.name || 'model'} OK`;
}

// ─── Upstash ping (PING) ───
async function pingUpstash(url: string, token: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['PING']),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json() as { result?: string };
  return j.result === 'PONG' ? 'PONG' : `unexpected: ${j.result}`;
}

// ─── Slack Webhook ping (POST 空メッセージは弾かれるので URL の形だけ確認) ───
function checkSlackWebhook(url: string): string {
  if (/^https:\/\/hooks\.slack\.com\/services\//.test(url)) return 'URL 形式 OK (空 POST は Slack 側で 4xx 返るため、本番送信時に検証されます)';
  return 'URL が hooks.slack.com 形式ではありません';
}

export async function runSecretsHealth(): Promise<{ asOf: string; checks: SecretCheck[] }> {
  const out: SecretCheck[] = [];

  const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (claudeKey) {
    const r = await timed(() => pingAnthropic(claudeKey));
    out.push({
      key: 'CLAUDE_API_KEY', label: 'Anthropic Claude',
      present: true, preview: maskKey(claudeKey),
      reachOk: r.ok, reachLatencyMs: r.ms, reachNote: r.ok ? String(r.value) : r.note,
    });
  } else {
    out.push({ key: 'CLAUDE_API_KEY', label: 'Anthropic Claude', present: false, preview: '—', reachOk: null, reachLatencyMs: null, reachNote: '未設定' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (stripeKey) {
    const r = await timed(() => pingStripe(stripeKey));
    out.push({
      key: 'STRIPE_SECRET_KEY', label: 'Stripe',
      present: true, preview: maskKey(stripeKey),
      reachOk: r.ok, reachLatencyMs: r.ms, reachNote: r.ok ? String(r.value) : r.note,
    });
  } else {
    out.push({ key: 'STRIPE_SECRET_KEY', label: 'Stripe', present: false, preview: '—', reachOk: null, reachLatencyMs: null, reachNote: '未設定' });
  }

  const resendKey = process.env.RESEND_API_KEY || '';
  if (resendKey) {
    const r = await timed(() => pingResend(resendKey));
    out.push({
      key: 'RESEND_API_KEY', label: 'Resend',
      present: true, preview: maskKey(resendKey),
      reachOk: r.ok, reachLatencyMs: r.ms, reachNote: r.ok ? String(r.value) : r.note,
    });
  } else {
    out.push({ key: 'RESEND_API_KEY', label: 'Resend', present: false, preview: '—', reachOk: null, reachLatencyMs: null, reachNote: '未設定' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (geminiKey) {
    const r = await timed(() => pingGemini(geminiKey));
    out.push({
      key: 'GEMINI_API_KEY', label: 'Gemini (Google AI Studio)',
      present: true, preview: maskKey(geminiKey),
      reachOk: r.ok, reachLatencyMs: r.ms, reachNote: r.ok ? String(r.value) : r.note,
    });
  } else {
    out.push({ key: 'GEMINI_API_KEY', label: 'Gemini', present: false, preview: '—', reachOk: null, reachLatencyMs: null, reachNote: '未設定' });
  }

  const upUrl = process.env.UPSTASH_REDIS_REST_URL || '';
  const upTok = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (upUrl && upTok) {
    const r = await timed(() => pingUpstash(upUrl, upTok));
    out.push({
      key: 'UPSTASH_REDIS_REST_*', label: 'Upstash Redis',
      present: true, preview: `URL=${maskKey(upUrl)} / TOK=${maskKey(upTok)}`,
      reachOk: r.ok, reachLatencyMs: r.ms, reachNote: r.ok ? String(r.value) : r.note,
    });
  } else {
    out.push({
      key: 'UPSTASH_REDIS_REST_*', label: 'Upstash Redis',
      present: false, preview: '—',
      reachOk: null, reachLatencyMs: null,
      reachNote: '未設定 (オンボ funnel / DAU / push 購読が永続化されません)',
    });
  }

  const slack = process.env.SLACK_WEBHOOK_URL || '';
  out.push({
    key: 'SLACK_WEBHOOK_URL', label: 'Slack Webhook',
    present: !!slack, preview: slack ? maskKey(slack) : '—',
    reachOk: slack ? true : null, reachLatencyMs: null,
    reachNote: slack ? checkSlackWebhook(slack) : '未設定 (Slack 日次通知が動きません)',
  });

  const cron = process.env.CRON_SECRET || '';
  out.push({
    key: 'CRON_SECRET', label: 'Vercel Cron Secret',
    present: !!cron, preview: cron ? maskKey(cron) : '—',
    reachOk: cron ? true : null, reachLatencyMs: null,
    reachNote: cron ? '設定済' : '未設定 (cron が誰でも叩ける状態。設定推奨)',
  });

  const vapidPub = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPriv = process.env.VAPID_PRIVATE_KEY || '';
  out.push({
    key: 'VAPID_*', label: 'Web Push (VAPID)',
    present: !!(vapidPub && vapidPriv), preview: vapidPub ? `PUB=${maskKey(vapidPub)} / PRIV=${maskKey(vapidPriv)}` : '—',
    reachOk: vapidPub && vapidPriv ? true : null, reachLatencyMs: null,
    reachNote: vapidPub && vapidPriv ? '鍵ペア揃ってます' : '未設定 (Push 通知が無効)',
  });

  return { asOf: new Date().toISOString(), checks: out };
}
