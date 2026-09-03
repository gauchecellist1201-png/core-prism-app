import { describe, it, expect, beforeEach, vi } from 'vitest';

// /api/roai/lead の handler を、Upstash と Resend をモックして通す。
//   ・honeypot は保存も通知もせずに 200
//   ・正常系は Upstash に SET/LPUSH/LTRIM、Resend にオーナー通知＋受付メール
//   ・Rate limit を超えると 429
//   ・Lead Score は本人へ返さない
// import は巻き上げられるので、env は vi.hoisted で先に入れる（モジュール読込時に UPSTASH_OK が決まる）
vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://kv.test.local';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  process.env.RESEND_API_KEY = 'rk';
  process.env.EMAIL_FROM = 'info@core-ai.jp';
});

import handler from '../roai/lead';

const calls: { url: string; body: unknown }[] = [];
const counters = new Map<string, number>();
function mockFetch() {
  counters.clear();
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url === 'https://kv.test.local') {
      if (Array.isArray(body) && body[0] === 'INCR') { const n = (counters.get(body[1]) || 0) + 1; counters.set(body[1], n); return new Response(JSON.stringify({ result: n })); }
      return new Response(JSON.stringify({ result: 'OK' }));
    }
    return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 });
  }));
}
const GOOD = {
  kind: 'consult',
  contact: { email: 'ceo@example.co.jp', company: 'テスト社', name: '山田', phone: '', message: 'まず営業から' },
  answers: { industry: 'it', employees: 'e3', revenue: 'r3', data_entry: 'h3', documents: 'w2', email: 'm2', budget: 'bg3', commitment: 'cm1' },
  source: 'home-hero',
};
function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://www.core-ai.jp/api/roai/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://www.core-ai.jp', ...headers }, body: JSON.stringify(body) });
}

describe('/api/roai/lead handler', () => {
  beforeEach(mockFetch);

  it('stores, notifies owner and replies to requester; never returns the lead tier', async () => {
    const res = await handler(req(GOOD));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.stored).toBe(true);
    expect(j.delivered).toBe(true);
    expect(j.replied).toBe(true);
    expect(JSON.stringify(j)).not.toMatch(/HOT|WARM|NURTURE|leadScore/);
    const kv = calls.filter(c => c.url === 'https://kv.test.local').map(c => (c.body as string[])[0]);
    expect(kv).toEqual(expect.arrayContaining(['INCR', 'SET', 'LPUSH', 'LTRIM']));
    const set = calls.find(c => c.url === 'https://kv.test.local' && (c.body as string[])[0] === 'SET')!.body as string[];
    expect(set[1]).toMatch(/^roai:lead:/);
    expect(set[3]).toBe('EX');
    const rec = JSON.parse(set[2]);
    expect(rec.result.tier).toBe('HOT');
    expect(rec.contact.email).toBe('ceo@example.co.jp');
    const mails = calls.filter(c => c.url === 'https://api.resend.com/emails').map(c => c.body as { to: string; subject: string });
    expect(mails.length).toBe(2);
    expect(mails[0].to).toBe('info@core-ai.jp');
    expect(mails[0].subject).toMatch(/\[ROAI HOT\]/);
    expect(mails[1].to).toBe('ceo@example.co.jp');
  });

  it('honeypot → 200 without any storage or mail', async () => {
    const res = await handler(req({ ...GOOD, website: 'http://spam' }));
    expect(res.status).toBe(200);
    expect(calls.length).toBe(0);
  });

  it('rejects foreign origin and invalid body', async () => {
    expect((await handler(req(GOOD, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(req({ kind: 'consult', contact: { email: 'x' }, answers: {} }))).status).toBe(400);
    expect(calls.length).toBe(0);
  });

  it('rate limits after 10 posts per hour per ip (distinct emails)', async () => {
    for (let i = 0; i < 10; i++) expect((await handler(req({ ...GOOD, contact: { ...GOOD.contact, email: `u${i}@example.co.jp` } }))).status).toBe(200);
    expect((await handler(req({ ...GOOD, contact: { ...GOOD.contact, email: 'u99@example.co.jp' } }))).status).toBe(429);
  });
  it('rate limits the 4th post to the same email within a day (third-party mailbox protection)', async () => {
    for (let i = 0; i < 3; i++) expect((await handler(req(GOOD, { 'x-forwarded-for': `10.0.0.${i}` }))).status).toBe(200);
    expect((await handler(req(GOOD, { 'x-forwarded-for': '10.0.0.9' }))).status).toBe(429);
  });
  it('strips CR/LF from contact fields and keeps PII out of logs', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await handler(req({ ...GOOD, contact: { ...GOOD.contact, company: 'Evil\r\nBcc: x@y.z', name: 'A\nB' } }));
    expect(res.status).toBe(200);
    const set = calls.find(c => c.url === 'https://kv.test.local' && (c.body as string[])[0] === 'SET')!.body as string[];
    const rec = JSON.parse(set[2]);
    expect(rec.contact.company).toBe('Evil Bcc: x@y.z');
    expect(rec.contact.name).toBe('A B');
    const logged = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logged).toContain('[roai-lead]');
    expect(logged).not.toContain('ceo@example.co.jp');
    expect(logged).not.toContain('テスト社');
    spy.mockRestore();
  });
});
