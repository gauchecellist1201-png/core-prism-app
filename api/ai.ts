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
// fallback リストから順に試す。404 / 429 (quota) で次のモデルへ。
//   - gemini-1.5-flash         (無料枠 1,500req/日 — 一番堅実) ← デフォルト 1 番目
//   - gemini-1.5-flash-latest  (1.5-flash の latest alias)
//   - gemini-1.5-flash-002     (バージョン固定)
//   - gemini-2.0-flash         (一部キーで limit:0 の場合あり、後ろに)
//   - gemini-1.5-pro           (高品質、無料枠 50req/日)
function pickGeminiModels(anthropicModel?: string): string[] {
  if (!anthropicModel) {
    return [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
    ];
  }
  const m = anthropicModel.toLowerCase();
  // opus / sonnet-4 → 高品質モデル (Pro 系)
  if (m.includes('opus') || m.includes('sonnet-4')) {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro-002',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
    ];
  }
  // sonnet / haiku → 高速バランス
  return [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
  ];
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

  // ─── マスターキー判定 + 軽重ルーティング ─────────────────
  // マスターキーがあっても「重い処理だけ Claude」「軽い処理は Gemini」に振る:
  //   - 軽量: max_tokens <= 1500 かつ画像なし → Gemini (無料枠で十分)
  //   - 重量: max_tokens > 1500 or 画像あり or 'x-ai-weight: heavy' → Claude
  //   - 明示的に 'x-ai-weight: light' があれば常に Gemini (マスター含む)
  // 目的: Claude クレジット消費を抑え、月額を 1/3-1/5 にする
  const masterKey = req.headers.get('x-master-key') || '';
  const isMaster = masterKey === 'GAUCHE2026';
  const explicitWeight = (req.headers.get('x-ai-weight') || '').toLowerCase(); // 'heavy' | 'light' | ''

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

  // 重量判定
  const requestedMaxTokens = body.max_tokens || 1024;
  const hasImages = (body.messages || []).some(m =>
    Array.isArray(m.content) && m.content.some(p => p && (p as any).type === 'image')
  );
  let isHeavy: boolean;
  if (explicitWeight === 'heavy')      isHeavy = true;
  else if (explicitWeight === 'light') isHeavy = false;
  else                                  isHeavy = requestedMaxTokens > 1500 || hasImages;

  // マスターでかつ重量 → Claude。それ以外 → Gemini。
  const useClaude = isMaster && isHeavy;

  // 診断ヘッダーで動作を可視化
  const routeReason = !isMaster ? 'public:gemini'
    : isHeavy ? `master:claude (tokens=${requestedMaxTokens}, images=${hasImages}, hint=${explicitWeight || 'auto'})`
              : `master:gemini-light (tokens=${requestedMaxTokens}, hint=${explicitWeight || 'auto'})`;

  // ─── 分岐: Claude または Gemini ───
  if (useClaude) {
    // 優先順: ヘッダー x-claude-api-key (オーナーが /master 画面で入力) → Vercel env
    const headerKey = req.headers.get('x-claude-api-key') || '';
    const envKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    const claudeKey = headerKey || envKey;
    if (!claudeKey) {
      return new Response(JSON.stringify({
        error: {
          message: 'CLAUDE_API_KEY が未設定。/master 画面で Claude API キーを入力するか、Vercel env に CLAUDE_API_KEY を登録してください。',
          type: 'auth_error',
        },
        userMessage: 'マスターモード用の Claude API キーが見つかりません。',
        recovery: 'https://core-prism-app.vercel.app/master を開いて API キーを入力してください。',
      }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      const txt = await r.text();
      return new Response(txt, {
        status: r.status,
        headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: { message: e.message, type: 'claude_proxy_error' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
      });
    }
  }

  // ─── デフォルト: Gemini ───
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: { message: 'GEMINI_API_KEY が環境変数に設定されていません。Vercel の env に登録してください。' }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 変換 + フォールバック呼び出し
  const candidateModels = pickGeminiModels(body.model);
  const geminiBody = anthropicToGemini(body);

  let lastError: { status: number; message: string; model: string } | null = null;

  for (const geminiModel of candidateModels) {
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
        lastError = {
          status: r.status,
          message: errObj?.error?.message || `Gemini API error: ${r.status}`,
          model: geminiModel,
        };
        // 次のモデルにフォールバックする条件:
        //  - 404 (モデル未対応)
        //  - 400 + "not found"
        //  - 429 (rate limit / quota exceeded)
        //  - 403 (forbidden — 無料枠制限) かつ "quota" メッセージ
        const msgLow = lastError.message.toLowerCase();
        const isFallbackable =
          r.status === 404 ||
          (r.status === 400 && msgLow.includes('not found')) ||
          r.status === 429 ||
          (r.status === 403 && (msgLow.includes('quota') || msgLow.includes('limit')));
        if (isFallbackable) continue;
        // それ以外 (認証エラー等) はそのまま返す
        return new Response(JSON.stringify({
          error: { message: lastError.message, type: 'gemini_error', status: r.status, model: geminiModel },
        }), {
          status: r.status,
          headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
        });
      }

      // 成功
      const geminiResp = await r.json();
      const anthropicResp = geminiToAnthropic(geminiResp, body.model || geminiModel);
      return new Response(JSON.stringify(anthropicResp), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
      });
    } catch (e: any) {
      lastError = { status: 500, message: e.message || 'Unknown error', model: geminiModel };
      continue;
    }
  }

  // ─── すべての候補モデルが失敗 → やさしいメッセージに変換 ───
  const errMsg = (lastError?.message || '').toLowerCase();
  const isQuota = errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('limit');
  const isAuth = errMsg.includes('api key') || errMsg.includes('unauthorized') || errMsg.includes('forbidden');

  let userMessage: string;
  let recovery: string;

  if (isQuota) {
    userMessage = 'AI が一時的に混みあっています。';
    recovery = '少し待ってからもう一度お試しください。または設定からマスターモード (高品質 AI) を有効化できます。';
  } else if (isAuth) {
    userMessage = 'AI の認証に失敗しました。';
    recovery = 'サーバー設定の問題です。管理者へご連絡ください。';
  } else {
    userMessage = 'AI が応答しませんでした。';
    recovery = '少し待ってからもう一度お試しください。';
  }

  return new Response(JSON.stringify({
    error: {
      message: `${userMessage} ${recovery}`,
      type: isQuota ? 'quota_exceeded' : isAuth ? 'auth_error' : 'all_models_failed',
      detail: lastError?.message,
      candidates: candidateModels,
    },
  }), {
    status: lastError?.status || 500,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
