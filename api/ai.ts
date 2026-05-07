// ============================================================
// /api/ai — AI プロキシ (Vercel Edge Function)
//
// Anthropic Messages API 互換のリクエストを受け取り、
// Google Gemini API に変換して呼び出し、
// Anthropic 互換のレスポンスを返す。
//
// 目的:
// - クライアント側で API キーを持たせない (脱落防止)
// - サーバ側 (Vercel env) に GEMINI_API_KEY を保管
// - 既存の Anthropic 直叩きコードをほぼそのまま使える
// - レート制限 / CORS / セキュリティを集約
// ============================================================

export const config = { runtime: 'edge' };

// ─── 簡易レート制限 (IP ベース、メモリ内) ───────────
// (Edge は地理的に分散するので厳密ではないが、最低限の連投防止)
const RATE_BUCKET = new Map<string, { count: number; ts: number }>();
const RATE_WINDOW_MS = 60_000;       // 1 分
const RATE_MAX_PER_WINDOW = 30;      // 1 分に最大 30 リクエスト

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = RATE_BUCKET.get(ip);
  if (!b || now - b.ts > RATE_WINDOW_MS) {
    RATE_BUCKET.set(ip, { count: 1, ts: now });
    return { ok: true };
  }
  if (b.count >= RATE_MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - b.ts)) / 1000) };
  }
  b.count++;
  return { ok: true };
}

// ─── 型 (Anthropic Messages API 互換) ───
interface AnthropicTextPart { type: 'text'; text: string }
interface AnthropicImagePart {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}
type AnthropicPart = AnthropicTextPart | AnthropicImagePart;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicPart[];
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
}

// ─── Anthropic → Gemini 変換 ───
function anthropicToGemini(req: AnthropicRequest): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: 'user' | 'model'; parts: any[] }[];
  generationConfig: { maxOutputTokens: number; temperature?: number };
} {
  const contents = req.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: typeof m.content === 'string'
      ? [{ text: m.content }]
      : m.content.map(p => {
          if (p.type === 'text') return { text: p.text };
          // image
          return {
            inlineData: {
              mimeType: p.source.media_type,
              data: p.source.data,
            },
          };
        }),
  }));

  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: req.max_tokens || 4096,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    },
  };
}

// ─── モデルマッピング (Anthropic 名 → Gemini 名) ───
function pickGeminiModel(anthropicModel?: string): string {
  if (!anthropicModel) return 'gemini-2.0-flash-exp';
  const m = anthropicModel.toLowerCase();
  // opus / sonnet → 強力モデル
  if (m.includes('opus') || m.includes('sonnet-4')) return 'gemini-2.5-pro';
  if (m.includes('sonnet')) return 'gemini-2.0-flash-exp';
  // haiku → 軽量
  if (m.includes('haiku')) return 'gemini-2.0-flash-exp';
  return 'gemini-2.0-flash-exp';
}

// ─── Gemini → Anthropic レスポンス変換 ───
function geminiToAnthropic(geminiResp: any, modelName: string) {
  const text = geminiResp?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .filter(Boolean)
    .join('') ?? '';

  const usageMetadata = geminiResp?.usageMetadata || {};

  return {
    id: 'msg_' + Math.random().toString(36).slice(2),
    type: 'message',
    role: 'assistant',
    model: modelName,
    content: [{ type: 'text', text }],
    stop_reason: geminiResp?.candidates?.[0]?.finishReason === 'STOP' ? 'end_turn' : 'max_tokens',
    usage: {
      input_tokens: usageMetadata.promptTokenCount || 0,
      output_tokens: usageMetadata.candidatesTokenCount || 0,
    },
  };
}

// ─── ハンドラ ───
export default async function handler(req: Request) {
  // CORS (同一ドメインのみ許可)
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    'https://core-prism-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://core-prism-app.vercel.app';

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // レート制限
  const ip = req.headers.get('cf-connecting-ip')
          || req.headers.get('x-forwarded-for')?.split(',')[0]
          || req.headers.get('x-real-ip')
          || 'unknown';
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter || 60),
        ...corsHeaders,
      },
    });
  }

  // API キー (サーバ側 env)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: { message: 'GEMINI_API_KEY が環境変数に設定されていません。Vercel の env に登録してください。' }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // リクエストボディをパース
  let body: AnthropicRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 変換 + 呼び出し
  const geminiModel = pickGeminiModel(body.model);
  const geminiBody = anthropicToGemini(body);

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!r.ok) {
      const errText = await r.text();
      let errObj: any;
      try { errObj = JSON.parse(errText); } catch { errObj = { error: { message: errText } }; }
      return new Response(JSON.stringify({
        error: {
          message: errObj?.error?.message || `Gemini API error: ${r.status}`,
          type: 'gemini_error',
          status: r.status,
        },
      }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const geminiResp = await r.json();
    const anthropicResp = geminiToAnthropic(geminiResp, body.model || geminiModel);

    return new Response(JSON.stringify(anthropicResp), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      error: { message: e.message || 'Unknown error', type: 'proxy_error' },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
