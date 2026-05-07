// ============================================================
// Cloudflare Worker — Gemini プロキシ (Anthropic 互換)
//
// このファイルは将来 Vercel から Cloudflare Workers に移行する場合の
// 実装テンプレ。/api/ai と同じ仕様で、Anthropic 形式 → Gemini 変換。
//
// デプロイ:
//   1. Cloudflare アカウントで Workers を有効化
//   2. wrangler init iris-ai-proxy
//   3. wrangler.toml に [vars] と secret を設定
//   4. wrangler secret put GEMINI_API_KEY
//   5. wrangler deploy
//
// セキュリティ:
//   - DDoS 自動防御 (Cloudflare 標準)
//   - レート制限 (Cloudflare WAF + KV ベース)
//   - Bot 検知
// ============================================================

export interface Env {
  GEMINI_API_KEY: string;
  // 必要なら KV をバインドして IP レート制限を永続化
  // RATE_KV?: KVNamespace;
}

interface AnthropicTextPart { type: 'text'; text: string }
interface AnthropicImagePart {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}
type AnthropicPart = AnthropicTextPart | AnthropicImagePart;
interface AnthropicMessage { role: 'user' | 'assistant'; content: string | AnthropicPart[] }
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
}

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin: string) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function pickGeminiModel(anthropic?: string): string {
  if (!anthropic) return 'gemini-2.5-flash';
  const m = anthropic.toLowerCase();
  if (m.includes('opus') || m.includes('sonnet-4')) return 'gemini-2.5-pro';
  return 'gemini-2.5-flash';
}

function anthropicToGemini(req: AnthropicRequest) {
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(p => p.type === 'text'
            ? { text: p.text }
            : { inlineData: { mimeType: p.source.media_type, data: p.source.data } }),
    })),
    generationConfig: {
      maxOutputTokens: req.max_tokens || 4096,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    },
  };
}

function geminiToAnthropic(geminiResp: any, modelName: string) {
  const text = geminiResp?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').filter(Boolean).join('') ?? '';
  const u = geminiResp?.usageMetadata || {};
  return {
    id: 'msg_' + Math.random().toString(36).slice(2),
    type: 'message',
    role: 'assistant',
    model: modelName,
    content: [{ type: 'text', text }],
    stop_reason: geminiResp?.candidates?.[0]?.finishReason === 'STOP' ? 'end_turn' : 'max_tokens',
    usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin') || '';
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'GEMINI_API_KEY 未設定' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    let body: AnthropicRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: { message: 'Invalid JSON' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const geminiModel = pickGeminiModel(body.model);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(anthropicToGemini(body)),
        }
      );

      if (!r.ok) {
        const err = await r.text();
        return new Response(err, { status: r.status, headers: { 'Content-Type': 'application/json', ...cors } });
      }

      const geminiResp = await r.json();
      const anthropicResp = geminiToAnthropic(geminiResp, body.model || geminiModel);

      return new Response(JSON.stringify(anthropicResp), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: { message: e.message } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
  },
};
