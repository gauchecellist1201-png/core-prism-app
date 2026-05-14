#!/usr/bin/env node
// ============================================================
// scripts/smoke.mjs — 本番 E2E スモークテスト
//
// 使い方:
//   npm run smoke                       # SMOKE_BASE_URL or デフォルト本番
//   SMOKE_BASE_URL=https://... npm run smoke
//   SMOKE_MASTER_KEY=GAUCHE2026 npm run smoke
//
// チェック項目:
//   1. LP / トップが 200
//   2. /iris が 200
//   3. /api/ai が master キー付き haiku-4-5 で 200 + 文字列を返す
//   4. /api/stripe/checkout が url を返す (Iris lite monthly)
//   5. /api/stripe/sync が 200
// ============================================================

const BASE = (process.env.SMOKE_BASE_URL || 'https://core-prism-app.vercel.app').replace(/\/$/, '');
const MASTER_KEY = process.env.SMOKE_MASTER_KEY || 'GAUCHE2026';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);

const results = [];
let failed = 0;

function ok(name, detail = '') {
  results.push({ name, status: 'OK', detail });
  console.log(`[OK]   ${name}${detail ? '  — ' + detail : ''}`);
}
function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`[FAIL] ${name}  — ${detail}`);
  failed++;
}

async function fetchWithTimeout(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

// 1) LP
async function checkLP() {
  const url = `${BASE}/`;
  try {
    const r = await fetchWithTimeout(url);
    if (r.status === 200) ok('LP (/) 200', `${r.status}`);
    else fail('LP (/) 200', `status=${r.status}`);
  } catch (e) {
    fail('LP (/) 200', e.message);
  }
}

// 2) /iris
async function checkIris() {
  const url = `${BASE}/iris`;
  try {
    const r = await fetchWithTimeout(url);
    if (r.status === 200) ok('/iris 200', `${r.status}`);
    else fail('/iris 200', `status=${r.status}`);
  } catch (e) {
    fail('/iris 200', e.message);
  }
}

// 3) /api/ai (master + haiku-4-5)
async function checkAi() {
  const url = `${BASE}/api/ai`;
  try {
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': MASTER_KEY,
        'x-ai-weight': 'heavy',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 64,
        messages: [{ role: 'user', content: '「smoke ok」とだけ返して' }],
      }),
    });
    const txt = await r.text();
    if (r.status !== 200) {
      fail('/api/ai (master haiku) 200', `status=${r.status} body=${txt.slice(0, 200)}`);
      return;
    }
    let body;
    try { body = JSON.parse(txt); } catch {
      fail('/api/ai (master haiku) 200', 'non-JSON body');
      return;
    }
    const text = body?.content?.[0]?.text || '';
    if (typeof text === 'string' && text.length > 0) {
      ok('/api/ai (master haiku) 200', `len=${text.length} route=${r.headers.get('x-ai-route') || 'n/a'}`);
    } else {
      fail('/api/ai (master haiku) 200', `empty text: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (e) {
    fail('/api/ai (master haiku) 200', e.message);
  }
}

// 4) /api/stripe/checkout (Iris lite monthly)
async function checkStripeCheckout() {
  const url = `${BASE}/api/stripe/checkout`;
  try {
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'iris',
        plan: 'lite',
        cycle: 'monthly',
        email: 'smoke@example.com',
      }),
    });
    const txt = await r.text();
    if (r.status !== 200) {
      fail('/api/stripe/checkout url', `status=${r.status} body=${txt.slice(0, 200)}`);
      return;
    }
    let body;
    try { body = JSON.parse(txt); } catch {
      fail('/api/stripe/checkout url', 'non-JSON body');
      return;
    }
    if (typeof body.url === 'string' && /^https?:\/\//.test(body.url)) {
      ok('/api/stripe/checkout url', body.url.slice(0, 60) + '...');
    } else {
      fail('/api/stripe/checkout url', `no url: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (e) {
    fail('/api/stripe/checkout url', e.message);
  }
}

// 5) /api/stripe/sync
async function checkStripeSync() {
  const url = `${BASE}/api/stripe/sync`;
  try {
    // 存在しない subscription_id を投げる → Stripe 404 → downgrade_to_free=true で 200 が返る想定
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: 'sub_smoke_test_nonexistent' }),
    });
    const txt = await r.text();
    if (r.status === 200) {
      ok('/api/stripe/sync 200', `body=${txt.slice(0, 120)}`);
    } else {
      fail('/api/stripe/sync 200', `status=${r.status} body=${txt.slice(0, 200)}`);
    }
  } catch (e) {
    fail('/api/stripe/sync 200', e.message);
  }
}

async function main() {
  console.log(`# E2E smoke test`);
  console.log(`# base: ${BASE}`);
  console.log(`# at:   ${new Date().toISOString()}`);
  console.log('');

  await checkLP();
  await checkIris();
  await checkAi();
  await checkStripeCheckout();
  await checkStripeSync();

  console.log('');
  console.log(`# summary: ${results.length - failed}/${results.length} passed`);
  if (failed > 0) {
    console.log(`# ${failed} failure(s) — exit 1`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(2);
});
