import { describe, it, expect, beforeEach, vi } from 'vitest';

// /api/roai/leads の ?id=（1件・回答を日本語のラベルに直して返す）
//   ・鍵が無ければ 403（一覧と同じ）
//   ・保存されていない id は 404
//   ・schema から消えた質問・選択肢は捨てずに raw のまま出す
// import は巻き上げられるので env は vi.hoisted で先に入れる（UPSTASH_OK がモジュール読込時に決まる）
vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://kv.test.local';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  process.env.MASTER_KEY = 'TESTKEY';
});

import handler, { labelAnswers } from '../roai/leads';

const RECORD = {
  id: 'ld_1',
  kind: 'consult',
  ts: 1_757_000_000_000,
  source: 'home-hero',
  contact: { email: 'ceo@example.co.jp', company: 'テスト社', name: '山田', phone: '', message: 'まず営業から' },
  answers: { employees: 'e3', industry: 'it', gone_question: 'x1', budget: 'no_such_option' },
  result: { score: 71, readiness: 55, tier: 'HOT', leadScore: 82, factors: ['予算あり'], total: { low: 1, mid: 2, high: 3 }, top: 'save', mode: 'full', version: '2026.09.03-1' },
};

let store: Record<string, string>;
function mockFetch() {
  store = { 'roai:lead:ld_1': JSON.stringify(RECORD) };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url === 'https://kv.test.local' && Array.isArray(body) && body[0] === 'GET') {
      return new Response(JSON.stringify({ result: store[String(body[1])] ?? null }));
    }
    return new Response(JSON.stringify({ result: 'OK' }));
  }));
}
function req(qs: string, headers: Record<string, string> = {}) {
  return new Request(`https://www.core-ai.jp/api/roai/leads${qs}`, { headers });
}
const KEY = { 'x-master-key': 'TESTKEY' };

describe('labelAnswers', () => {
  it('質問文と選択肢を日本語に直す', () => {
    const out = labelAnswers({ industry: 'it', employees: 'e3' });
    const ind = out.find(x => x.id === 'industry');
    expect(ind?.a).toBe('IT・ソフトウェア');
    expect(ind?.q).toContain('業種');
    expect(ind?.group).toBe('会社について');
    expect(ind?.known).toBe(true);
    expect(out.find(x => x.id === 'employees')?.a).toBe('21〜50人');
  });

  it('並び順は保存時のキー順ではなく質問の順', () => {
    const out = labelAnswers({ employees: 'e3', industry: 'it' });
    expect(out.map(x => x.id)).toEqual(['industry', 'employees']);
  });

  it('schema から消えた質問は捨てずに raw で出す', () => {
    const out = labelAnswers({ gone_question: 'x1' });
    expect(out).toEqual([{ id: 'gone_question', group: '', q: 'gone_question', a: 'x1', known: false }]);
  });

  it('選択肢だけ未知なら、質問文は出しつつ値をそのまま出す', () => {
    const out = labelAnswers({ industry: 'no_such_option' });
    expect(out[0].q).toContain('業種');
    expect(out[0].a).toBe('no_such_option');
    expect(out[0].known).toBe(false);
  });

  it('回答が空・不正でも落ちない', () => {
    expect(labelAnswers(undefined)).toEqual([]);
    expect(labelAnswers({} as Record<string, string>)).toEqual([]);
  });
});

describe('GET /api/roai/leads?id=', () => {
  beforeEach(mockFetch);

  it('鍵が無ければ 403（中身を出さない）', async () => {
    const res = await handler(req('?id=ld_1'));
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('ceo@example.co.jp');
  });

  it('1件をラベル付きで返す', async () => {
    const res = await handler(req('?id=ld_1', KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead.id).toBe('ld_1');
    expect(body.lead.result.tier).toBe('HOT');
    expect(body.lead.labeled.find((x: { id: string }) => x.id === 'industry').a).toBe('IT・ソフトウェア');
    // 生の answers も残す（読む側が自分で突き合わせたい時のため）
    expect(body.lead.answers.industry).toBe('it');
  });

  it('保存されていない id は 404', async () => {
    const res = await handler(req('?id=ld_none', KEY));
    expect(res.status).toBe(404);
    expect((await res.json()).lead).toBeNull();
  });

  it('妙な id は Upstash を叩かずに 400', async () => {
    const res = await handler(req('?id=' + encodeURIComponent('a b/../*'), KEY));
    expect(res.status).toBe(400);
  });

  it('id が無ければ従来どおり一覧', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (Array.isArray(body) && body[0] === 'LRANGE') return new Response(JSON.stringify({ result: ['ld_1'] }));
      if (Array.isArray(body) && body[0] === 'GET') return new Response(JSON.stringify({ result: JSON.stringify(RECORD) }));
      return new Response(JSON.stringify({ result: 'OK' }));
    }));
    const res = await handler(req('?limit=5', KEY));
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.leads[0].labeled).toBeUndefined();
  });
});
