// ============================================================
// Sales OS ローカル検証ハーネス
//
// ・Vite dev server (実UI)
// ・api/sales/*.ts を ssrLoadModule して「本物のハンドラ」を実行
// ・Upstash は同プロセス内の偽サーバー (in-memory) に向ける = 本番DBに書かない
// ・/api/ai だけ本番へ中継 (鍵はサーバー側にしかないため)
//
// 使い方: node scripts/salesDevServer.mjs   → http://localhost:5199/sales
// ============================================================
import { createServer as createHttp } from 'node:http';
import { createServer as createVite } from 'vite';

const ROOT = new URL('..', import.meta.url).pathname;
const FAKE_KV_PORT = 5598;
const PORT = 5199;
// /api/sales/* は MASTER_KEY が無ければ開かない (fail-closed)。
// ここで勝手に値を入れると、その「開かない」挙動を手元で再現できなくなるので、
// 呼び出し側が渡したときだけ通す。
const MASTER = process.env.MASTER_KEY || '';
// /api/ai (本番へ中継) は互換のため旧既定値も受けるので、そちらはこれを使う。
const AI_KEY = MASTER || 'GAUCHE2026';
const AI_UPSTREAM = 'https://core-prism-app.vercel.app/api/ai';

// ---------- 偽 Upstash ----------
const store = new Map();          // key -> string
const hashes = new Map();         // key -> Map(field -> string)
const lists = new Map();          // key -> array

function runCmd(c) {
  const op = String(c[0]).toUpperCase();
  const k = c[1] == null ? '' : String(c[1]);
  switch (op) {
    case 'PING': return 'PONG';
    case 'GET': return store.has(k) ? store.get(k) : null;
    case 'SET': {
      const v = String(c[2]);
      const rest = c.slice(3).map(x => String(x).toUpperCase());
      if (rest.includes('NX') && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    }
    case 'DEL': {
      let n = 0;
      for (const key of c.slice(1).map(String)) {
        if (store.delete(key)) n++;
        if (hashes.delete(key)) n++;
        if (lists.delete(key)) n++;
      }
      return n;
    }
    case 'HSET': {
      const h = hashes.get(k) || new Map();
      h.set(String(c[2]), String(c[3]));
      hashes.set(k, h);
      return 1;
    }
    case 'HDEL': {
      const h = hashes.get(k);
      return h && h.delete(String(c[2])) ? 1 : 0;
    }
    case 'HGETALL': {
      const h = hashes.get(k);
      if (!h) return [];
      const out = [];
      for (const [f, v] of h) out.push(f, v);
      return out;
    }
    case 'HINCRBY': {
      const h = hashes.get(k) || new Map();
      const cur = Number(h.get(String(c[2])) || 0);
      const next = cur + Number(c[3] || 1);
      h.set(String(c[2]), String(next));
      hashes.set(k, h);
      return next;
    }
    case 'EXPIRE': return 1;
    case 'LPUSH': {
      const l = lists.get(k) || [];
      l.unshift(String(c[2]));
      lists.set(k, l);
      return l.length;
    }
    case 'LTRIM': {
      const l = lists.get(k) || [];
      lists.set(k, l.slice(Number(c[2]), Number(c[3]) + 1));
      return 'OK';
    }
    case 'LRANGE': {
      const l = lists.get(k) || [];
      const stop = Number(c[3]);
      return l.slice(Number(c[2]), stop < 0 ? undefined : stop + 1);
    }
    case 'EVAL': {
      // 本物の Lua は動かせないので、営業OSが使う script を手で写して実行する。
      // (本番との差異が出ないよう、引数の並びは store.ts と必ず揃えること)
      const script = String(c[1]);
      const numKeys = Number(c[2]);
      const keys = c.slice(3, 3 + numKeys).map(String);
      const args = c.slice(3 + numKeys).map(String);

      // 札の解放 (compare-and-delete)
      if (/GET.*ARGV\[1\].*DEL/s.test(script)) {
        if (store.get(keys[0]) === args[0]) { store.delete(keys[0]); return 1; }
        return 0;
      }

      // 結果入力のまとめ書き
      const [coKey, idxKey, actKey, feedKey, dayKey] = keys;
      const [coJson, id, rowJson, raw, actKeep, feedKeep, kind, dayTtl] = args;
      runCmd(['SET', coKey, coJson]);
      runCmd(['HSET', idxKey, id, rowJson]);
      runCmd(['LPUSH', actKey, raw]);
      runCmd(['LTRIM', actKey, 0, Number(actKeep)]);
      runCmd(['LPUSH', feedKey, raw]);
      runCmd(['LTRIM', feedKey, 0, Number(feedKeep)]);
      runCmd(['HINCRBY', dayKey, kind, 1]);
      runCmd(['HINCRBY', dayKey, 'total', 1]);
      runCmd(['EXPIRE', dayKey, Number(dayTtl)]);
      return 1;
    }
    default: throw new Error(`fake-upstash: unsupported ${op}`);
  }
}

createHttp(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try { body = JSON.parse(raw || '[]'); } catch { body = []; }
  res.setHeader('Content-Type', 'application/json');
  try {
    if (req.url === '/pipeline') {
      res.end(JSON.stringify(body.map(c => ({ result: runCmd(c) }))));
    } else {
      res.end(JSON.stringify({ result: runCmd(body) }));
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(FAKE_KV_PORT, () => console.log(`fake upstash :${FAKE_KV_PORT}`));

process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${FAKE_KV_PORT}`;
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake';
if (MASTER) process.env.MASTER_KEY = MASTER;
else delete process.env.MASTER_KEY;

// ---------- Vite (実UI) + 本物のハンドラ ----------
const vite = await createVite({ root: ROOT, server: { middlewareMode: true }, appType: 'mpa' });

const ROUTES = {
  '/api/sales/config': 'config',
  '/api/sales/companies': 'companies',
  '/api/sales/analyze': 'analyze',
  '/api/sales/generate': 'generate',
  '/api/sales/activity': 'activity',
  '/api/sales/today': 'today',
  '/api/sales/report': 'report',
};

const server = createHttp(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // /api/ai は本番へ中継 (鍵がサーバーにしか無いため)
  if (url.pathname === '/api/ai') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const up = await fetch(AI_UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': AI_KEY,
        'x-ai-weight': req.headers['x-ai-weight'] || '',
        'x-ai-format': req.headers['x-ai-format'] || '',
        Origin: 'https://core-prism-app.vercel.app',
      },
      body: raw,
    });
    const txt = await up.text();
    res.statusCode = up.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(txt);
    return;
  }

  const mod = ROUTES[url.pathname];
  if (mod) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      const loaded = await vite.ssrLoadModule(`/api/sales/${mod}.ts`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
      }
      headers.set('origin', 'http://localhost:5173');
      const request = new Request(`http://localhost:${PORT}${req.url}`, {
        method: req.method,
        headers,
        ...(raw && req.method !== 'GET' && req.method !== 'HEAD' ? { body: raw } : {}),
      });
      const out = await loaded.default(request);
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await out.text());
    } catch (e) {
      console.error('[handler]', mod, e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'HARNESS', message: String(e?.stack || e) }));
    }
    return;
  }

  // /sales → sales.html
  if (url.pathname === '/sales' || url.pathname.startsWith('/sales/')) {
    req.url = '/sales.html';
  }
  vite.middlewares(req, res);
});

server.listen(PORT, () => console.log(`sales dev  http://localhost:${PORT}/sales  (MASTER_KEY ${MASTER ? 'あり' : 'なし = /api/sales/* は503'})`));
