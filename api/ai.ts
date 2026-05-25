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

import { logAiUsage } from './ai/stats';

// ─── usage 記録 (失敗しても本処理を止めない) ───
async function recordUsage(
  route: string,
  model: string,
  tokens_in: number,
  tokens_out: number,
  latency_ms: number,
) {
  try {
    await logAiUsage({ route, model, tokens_in, tokens_out, latency_ms });
  } catch (e) {
    console.warn('[ai] usage log failed:', (e as any)?.message);
  }
}

// Anthropic 形式のレスポンス文字列から usage を取り出す
function parseAnthropicUsage(txt: string): { tokens_in: number; tokens_out: number; model: string } {
  try {
    const j = JSON.parse(txt);
    return {
      tokens_in: Number(j?.usage?.input_tokens) || 0,
      tokens_out: Number(j?.usage?.output_tokens) || 0,
      model: String(j?.model || ''),
    };
  } catch {
    return { tokens_in: 0, tokens_out: 0, model: '' };
  }
}

// ─── 簡易レート制限 (IP ベース、メモリ内) ───────────
// (Edge は地理的に分散するので厳密ではないが、最低限の連投防止)
//
// 仕様 (6/1 リリース abuse 対策):
//   - master key 所持者 (オーナー) は無制限
//   - その他 IP: 1 分 30 回 / 1 時間 200 回
//   - user 鍵 (x-claude-api-key or x-gemini-api-key) を送ってる人は両 cap を 2 倍に緩和
//
// 各 edge instance ごとに独立した Map (Vercel が複数 instance で動くと cap が実質緩む)。
// 完全防御ではなく基礎防御。完全 abuse 対策は WAF / 認証層で。

type RateBucket = { count: number; resetAt: number };
const RATE_MINUTE = (globalThis as any).__RATE_MINUTE ||= new Map<string, RateBucket>();
const RATE_HOUR = (globalThis as any).__RATE_HOUR ||= new Map<string, RateBucket>();

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * 60_000;
const BASE_MINUTE_LIMIT = 30;
const BASE_HOUR_LIMIT = 200;

interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;          // 秒
  limitMinute: number;
  remainingMinute: number;
  resetMinute: number;          // unix 秒
  hitWhich?: 'minute' | 'hour';
}

function bumpBucket(
  store: Map<string, RateBucket>,
  key: string,
  windowMs: number,
  limit: number,
  now: number,
): { allowed: boolean; count: number; resetAt: number } {
  const b = store.get(key);
  if (!b || now >= b.resetAt) {
    // 期限切れ -> 新規 (古いものは set 時に上書きで自然削除)
    const fresh = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return { allowed: true, count: 1, resetAt: fresh.resetAt };
  }
  if (b.count >= limit) {
    return { allowed: false, count: b.count, resetAt: b.resetAt };
  }
  b.count++;
  return { allowed: true, count: b.count, resetAt: b.resetAt };
}

function checkRateLimit(ip: string, relaxed: boolean): RateLimitResult {
  const now = Date.now();
  const minuteLimit = relaxed ? BASE_MINUTE_LIMIT * 2 : BASE_MINUTE_LIMIT;
  const hourLimit = relaxed ? BASE_HOUR_LIMIT * 2 : BASE_HOUR_LIMIT;

  // 期限切れ Map エントリを少しだけ掃除 (毎回ではなく確率的に)
  if (Math.random() < 0.01) {
    for (const [k, v] of RATE_MINUTE) if (v.resetAt < now) RATE_MINUTE.delete(k);
    for (const [k, v] of RATE_HOUR) if (v.resetAt < now) RATE_HOUR.delete(k);
  }

  const minute = bumpBucket(RATE_MINUTE, ip, MINUTE_MS, minuteLimit, now);
  if (!minute.allowed) {
    console.warn(`[ai-ratelimit] ${ip} hit minute limit (count=${minute.count}, limit=${minuteLimit})`);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((minute.resetAt - now) / 1000)),
      limitMinute: minuteLimit,
      remainingMinute: 0,
      resetMinute: Math.floor(minute.resetAt / 1000),
      hitWhich: 'minute',
    };
  }

  const hour = bumpBucket(RATE_HOUR, ip, HOUR_MS, hourLimit, now);
  if (!hour.allowed) {
    console.error(`[ai-ratelimit] ${ip} hit hourly limit — possible abuse (count=${hour.count}, limit=${hourLimit})`);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((hour.resetAt - now) / 1000)),
      limitMinute: minuteLimit,
      remainingMinute: Math.max(0, minuteLimit - minute.count),
      resetMinute: Math.floor(minute.resetAt / 1000),
      hitWhich: 'hour',
    };
  }

  return {
    ok: true,
    limitMinute: minuteLimit,
    remainingMinute: Math.max(0, minuteLimit - minute.count),
    resetMinute: Math.floor(minute.resetAt / 1000),
  };
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

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key, x-claude-api-key, x-gemini-api-key, x-ai-weight, x-plan-tier',
    'Access-Control-Expose-Headers': 'x-ai-route, x-ratelimit-limit-minute, x-ratelimit-remaining-minute, x-ratelimit-reset-minute, retry-after',
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

  // ─── マスターキー判定 (rate limit より先に確定。master は無制限) ───
  const masterKey = req.headers.get('x-master-key') || '';
  const isMaster = masterKey === 'GAUCHE2026';

  // ─── レート制限 (master は無制限、user 鍵持ちは 2 倍緩和) ───
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('cf-connecting-ip')
          || req.headers.get('x-real-ip')
          || 'unknown';
  const hasUserClaudeKey = !!(req.headers.get('x-claude-api-key') || '').trim();
  const hasUserGeminiKey = !!(req.headers.get('x-gemini-api-key') || '').trim();
  const relaxed = hasUserClaudeKey || hasUserGeminiKey;

  // 診断用 ratelimit ヘッダ (master は計測対象外。corsHeaders にマージして下流へ)
  if (!isMaster) {
    const rl = checkRateLimit(ip, relaxed);
    corsHeaders['x-ratelimit-limit-minute'] = String(rl.limitMinute);
    corsHeaders['x-ratelimit-remaining-minute'] = String(rl.remainingMinute);
    corsHeaders['x-ratelimit-reset-minute'] = String(rl.resetMinute);
    if (!rl.ok) {
      return new Response(JSON.stringify({
        error: {
          message: 'アクセスが集中しています。1 分ほど待ってからもう一度お試しください。',
          type: 'rate_limited',
        },
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter || 60),
          ...corsHeaders,
        },
      });
    }
  }

  // ─── 軽重ルーティング ─────────────────
  // マスターキーがあっても「重い処理だけ Claude」「軽い処理は Gemini」に振る:
  //   - 軽量: max_tokens <= 1500 かつ画像なし → Gemini (無料枠で十分)
  //   - 重量: max_tokens > 1500 or 画像あり or 'x-ai-weight: heavy' → Claude
  //   - 明示的に 'x-ai-weight: light' があれば常に Gemini (マスター含む)
  // 目的: Claude クレジット消費を抑え、月額を 1/3-1/5 にする
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
  let routeReason: string = !isMaster ? 'public:gemini'
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
    const claudeStart = Date.now();
    try {
      // body.model が 'claude-opus-4-5' 等の場合、Anthropic が現存モデルとして
      // 受理しない可能性があるため、安全なデフォルトに正規化
      const claudeBody = { ...body };
      if (!claudeBody.model || /^claude-(opus|sonnet|haiku|3-)/.test(claudeBody.model) === false) {
        claudeBody.model = 'claude-haiku-4-5';
      }

      // 🛡 Opus/Sonnet 課金ガード (オーナー指示 2026-05-15)
      // Studio プラン (¥29,800/月以上) または Master 認証以外は、
      // Opus / Sonnet をリクエストされても強制的に haiku-4-5 にダウングレード。
      // 一般ユーザーが高額モデルを叩いて請求が爆発するのを防ぐ。
      // 解禁したい場合は ALLOW_PREMIUM_MODELS=true を Vercel env に設定。
      const planTier = (req.headers.get('x-plan-tier') || '').toLowerCase(); // 'free'|'lite'|'standard'|'pro'|'studio'
      const allowPremium = process.env.ALLOW_PREMIUM_MODELS === 'true';
      const isStudioOrMaster = isMaster || planTier === 'studio' || allowPremium;
      if (!isStudioOrMaster && /opus|sonnet/i.test(claudeBody.model)) {
        console.warn(`[ai-guard] downgrade ${claudeBody.model} → haiku-4-5 (plan: ${planTier || 'unknown'})`);
        claudeBody.model = 'claude-haiku-4-5';
        routeReason += ' [downgraded:non-studio]';
      }
      let r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(claudeBody),
      });
      // ─── 401/403 (ユーザー側の鍵が無効) → env 側の鍵で 1 度だけリトライ ───
      // ユーザーが Settings に古い/無効な Claude キーを残しているとここに来る。
      // env が有効なら救済する。これを入れないと「AI の認証に失敗」が画面に出る。
      if (!r.ok && (r.status === 401 || r.status === 403) && headerKey && envKey && headerKey !== envKey) {
        console.warn(`[ai] user claude key returned ${r.status}, retrying with env key`);
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': envKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(claudeBody),
        });
        routeReason += ' [env-rescued-401]';
      }
      // Claude が失敗したら Gemini にフォールバック (overload/rate-limit/サーバーエラー)
      if (!r.ok && (r.status === 429 || r.status === 503 || r.status === 529 || r.status >= 500)) {
        console.warn(`[ai] Claude failed with ${r.status}, falling back to Gemini`);
        // fall-through: Gemini ブロックへ
        // 以降の Gemini 呼び出しは "fallback:claude" としてカウント
        routeReason = `fallback:claude→gemini (claude=${r.status})`;
      } else {
        const txt = await r.text();
        const u = parseAnthropicUsage(txt);
        await recordUsage(
          'master:claude',
          u.model || claudeBody.model,
          u.tokens_in,
          u.tokens_out,
          Date.now() - claudeStart,
        );
        return new Response(txt, {
          status: r.status,
          headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
        });
      }
    } catch (e: any) {
      console.warn('[ai] Claude exception, falling back to Gemini:', e?.message);
      routeReason = `fallback:claude→gemini (exception)`;
      // フォールバック継続
    }
    // ここに到達 = Claude 失敗。Gemini に流す (routeReason を上書き済み)
  }

  // ─── デフォルト: Gemini ───
  // ユーザー個人のキーを優先 (x-gemini-api-key ヘッダ) → サーバー env に fallback。
  // これでサーバー env が quota 切れでもユーザーは自分の無料キーを登録すれば即動く
  const userGeminiKey = (req.headers.get('x-gemini-api-key') || '').trim();
  const envGeminiKey = process.env.GEMINI_API_KEY || '';
  let apiKey = userGeminiKey || envGeminiKey;
  let usedUserKeyFirst = !!userGeminiKey;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: {
        message: 'AI を動かすための鍵が設定されていません。設定 → API キー で無料の Gemini キーを登録するか、Vercel env に GEMINI_API_KEY を設定してください。',
        type: 'no_ai_key',
      },
      userMessage: '無料の AI 鍵を 1 分で登録できます',
      recovery: 'Iris/Prism の右上 → 設定 → API キー → 「無料で取得」ボタン',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  // 変換 + フォールバック呼び出し
  const candidateModels = pickGeminiModels(body.model);
  const geminiBody = anthropicToGemini(body);

  let lastError: { status: number; message: string; model: string } | null = null;
  const geminiStart = Date.now();

  for (const geminiModel of candidateModels) {
    try {
      let r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        }
      );

      // ─── ユーザー鍵が 400 invalid / 401 / 403 non-quota → env 鍵で 1 度だけリトライ ───
      // ユーザーが Settings に間違った/失効した Gemini キーを残しているとここに来る。
      // env が有効ならそちらに切り替えて続行。これを入れないと「AI の認証に失敗」が画面に出る。
      if (!r.ok && usedUserKeyFirst && envGeminiKey && envGeminiKey !== apiKey &&
          (r.status === 400 || r.status === 401 || r.status === 403)) {
        const errPeek = await r.clone().text();
        if (!/quota|rate|limit/i.test(errPeek)) {
          console.warn(`[ai] user gemini key returned ${r.status}, retrying with env key`);
          apiKey = envGeminiKey;
          usedUserKeyFirst = false; // 二度目以降は env 固定
          r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiBody),
            }
          );
          routeReason += ' [env-rescued-gemini-auth]';
        }
      }

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
      const routeBucket = routeReason.startsWith('fallback:claude') ? 'fallback:claude' : 'light:gemini';
      await recordUsage(
        routeBucket,
        geminiModel,
        anthropicResp.usage.input_tokens,
        anthropicResp.usage.output_tokens,
        Date.now() - geminiStart,
      );
      return new Response(JSON.stringify(anthropicResp), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'x-ai-route': routeReason, ...corsHeaders },
      });
    } catch (e: any) {
      lastError = { status: 500, message: e.message || 'Unknown error', model: geminiModel };
      continue;
    }
  }

  // ─── すべての候補モデルが失敗 → master なら Claude に最終フォールバック ───
  const errMsg = (lastError?.message || '').toLowerCase();
  const isQuota = errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('limit');
  const isAuth = errMsg.includes('api key') || errMsg.includes('unauthorized') || errMsg.includes('forbidden');

  // マスターモードかつ Gemini が枯渇 → Claude haiku に救済フォールバック
  if (isMaster && isQuota) {
    const headerKey = req.headers.get('x-claude-api-key') || '';
    const envKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    const claudeKey = headerKey || envKey;
    if (claudeKey) {
      const rescueStart = Date.now();
      try {
        const claudeBody = { ...body, model: 'claude-haiku-4-5' };
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(claudeBody),
        });
        if (r.ok) {
          const txt = await r.text();
          const u = parseAnthropicUsage(txt);
          await recordUsage(
            'master:claude-rescue',
            u.model || 'claude-haiku-4-5',
            u.tokens_in,
            u.tokens_out,
            Date.now() - rescueStart,
          );
          return new Response(txt, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'x-ai-route': 'master:claude-rescue (gemini quota)', ...corsHeaders },
          });
        }
      } catch {/* fall through to error */}
    }
  }

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
