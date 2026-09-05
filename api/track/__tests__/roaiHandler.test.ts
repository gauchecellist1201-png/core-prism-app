import { describe, it, expect } from 'vitest';
import handler from '../roai';

// Upstash 未設定のまま（テスト環境に env は無い）＝書き込みは console.log に落ちる。
// ここで見たいのは「誰の・どのイベントを受け付け、誰を弾くか」の入口の判定。

const post = (body: unknown, origin?: string, contentType = 'application/json') =>
  handler(new Request('https://www.core-ai.jp/api/track/roai', {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  }));

describe('/api/track/roai の入口', () => {
  it('従来どおり site 無しの corp イベントを受ける（既存の呼び出しを壊さない）', async () => {
    const res = await post({ event: 'corp_page_view', label: 'home' });
    expect(res.status).toBe(200);
  });

  it('NERI LP から共通語彙を text/plain で受ける（別ドメインの preflight を避ける形）', async () => {
    const res = await post({ site: 'neri_lp', event: 'pricing_view', label: 'pricing' },
      'https://nexus.core-ai.jp', 'text/plain;charset=UTF-8');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://nexus.core-ai.jp');
  });

  it('知らない site は 400（勝手なキーを増やさせない）', async () => {
    const res = await post({ site: 'evil', event: 'page_view' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_site' });
  });

  it('知らないイベント名は 400', async () => {
    const res = await post({ site: 'corp', event: 'whatever_click' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_event' });
  });

  it('許可していない origin には CORS を返さない（返事は返すが読ませない）', async () => {
    const res = await post({ site: 'corp', event: 'page_view' }, 'https://example.com');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('OPTIONS は許可 origin にだけ 204 + CORS', async () => {
    const ok = await handler(new Request('https://www.core-ai.jp/api/track/roai', {
      method: 'OPTIONS', headers: { Origin: 'https://core-nexus-kappa.vercel.app' },
    }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('POST');

    const ng = await handler(new Request('https://www.core-ai.jp/api/track/roai', {
      method: 'OPTIONS', headers: { Origin: 'https://evil.example' },
    }));
    expect(ng.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('壊れた本文は 400（例外で落とさない）', async () => {
    const res = await handler(new Request('https://www.core-ai.jp/api/track/roai', {
      method: 'POST', body: 'not json',
    }));
    expect(res.status).toBe(400);
  });
});

describe('/api/track/roai の読み出し', () => {
  it('master key が無ければ 403（生カウントは社外に出さない）', async () => {
    const res = await handler(new Request('https://www.core-ai.jp/api/track/roai?days=7'));
    expect(res.status).toBe(403);
  });

  it('master key があれば scope=core を返す（Upstash 未設定なら configured:false）', async () => {
    const res = await handler(new Request('https://www.core-ai.jp/api/track/roai?scope=core&days=7&master_key=GAUCHE2026'));
    expect(res.status).toBe(200);
    const j = await res.json() as { configured: boolean; scope: string };
    expect(j.configured).toBe(false);
    expect(j.scope).toBe('core');
  });
});
