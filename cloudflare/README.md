# Cloudflare Worker — Gemini AI プロキシ

将来 Vercel の `/api/ai` を Cloudflare Workers に移行する場合のテンプレ。

## なぜ移行するのか

| | Vercel Functions | Cloudflare Workers |
|---|---|---|
| **無料枠** | 100GB-Hours/月 | 100,000 req/日 (永続) |
| **コスト (大量)** | ¥¥¥ | ¥ |
| **エッジ分散** | 18 リージョン | 300+ |
| **DDoS 保護** | 標準 | **Cloudflare WAF** (強い) |
| **Bot 検知** | なし | **標準** |
| **レート制限** | 自前実装 | KV/Durable Object で永続 |

→ **本番運用 (月 1,000 ユーザー超え)** したら Cloudflare に移行推奨。

## デプロイ手順

### 1. Cloudflare アカウント作成
https://dash.cloudflare.com/sign-up

### 2. wrangler CLI インストール
```bash
npm install -g wrangler
wrangler login
```

### 3. このフォルダで初期化
```bash
cd cloudflare
wrangler deploy
```

### 4. Gemini API キーを secret で登録
```bash
wrangler secret put GEMINI_API_KEY
# プロンプトに API キーを貼り付け
```

### 5. アプリ側の `/api/ai` を Worker URL に切替
`vercel.json` の rewrite で `/api/ai` を Cloudflare Worker URL に転送するか、
クライアント側の fetch URL を直接 `https://iris-ai-proxy.<your>.workers.dev` に変更。

## カスタムドメイン
本番運用するなら、`api.core-prism-app.com` のような専有ドメインで Worker をホスト推奨。
`wrangler.toml` の `routes` を有効化。

## レート制限の強化
現状は同期メモリ。本格運用には Cloudflare KV または Durable Object でグローバルなレート制限を:
```ts
// 例: 1 IP あたり 1 分 30 req
const key = `rl:${ip}`;
const count = await env.RATE_KV.get(key);
if (count && parseInt(count) >= 30) {
  return new Response('Rate limit', { status: 429 });
}
await env.RATE_KV.put(key, String((parseInt(count) || 0) + 1), { expirationTtl: 60 });
```
