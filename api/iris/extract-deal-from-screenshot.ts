// ============================================================
// POST /api/iris/extract-deal-from-screenshot
//
// インフルエンサーが受けた「DM 案件オファー」のスクショ (Instagram DM / X DM
// / メール画面の写真) を 1 枚送るだけで、Claude Vision が読み取って
// 「案件カード」用の構造化データを返す。
//
// プレゼン用の中核機能 — ボタン 1 つ + 写真 1 枚 で案件が登録できる。
//
// Body (multipart/form-data):
//   image: File (PNG / JPEG / WebP)
// または JSON:
//   { imageDataUrl: "data:image/png;base64,..." }
//
// Response (成功):
//   {
//     ok: true,
//     deal: {
//       brandName, senderHandle, contactName, category,
//       fee, requirements, deadline, summary, rawText,
//     },
//     confidence: 'high' | 'medium' | 'low',
//   }
// Response (失敗):
//   { ok: false, error, message, recovery }
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173', 'http://localhost:4173', 'http://localhost:5181',
];
function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key, x-claude-api-key',
    'Access-Control-Max-Age': '86400',
  };
}

const VISION_SYS = `あなたは、インフルエンサー / クリエイターが受信した
「案件オファーの DM (Instagram / X / Threads) 」「PR 依頼メールのスクリーンショット」
を読み取って、案件カード用に構造化する OCR + 抽出 AI です。

返答は JSON のみ (前置き・コードブロック禁止):
{
  "brandName": "送り主のブランド名 / 会社名 (例: SHISEIDO, ABEMA)",
  "senderHandle": "@で始まる送り主のハンドル (例: @shiseido_jp)。@ を含める",
  "contactName": "DM 内で名乗っている担当者名 (例: 田中)。「○○のお仕事担当の田中です」等から",
  "category": "案件のカテゴリ (コスメ / スキンケア / ファッション / グルメ / 旅行 / ガジェット / ヘルスケア / その他)",
  "fee": 報酬の数値 (税抜・円) 。「3 万円」は 30000、「¥50,000」は 50000。記載なしなら null,
  "requirements": "依頼内容 (例: 'リール 1 本 + ストーリー 2 枚')。文章で",
  "deadline": "締切 (例: '11/30 まで', '3 月末日', '2026-06-15')。文字列のままで OK",
  "summary": "DM 全体を 1-2 文で要約 (例: 'SHISEIDO 新作リップの PR リール 1 本依頼。報酬 5 万円、11 月末まで。')",
  "rawText": "スクショから読み取った全テキスト (デバッグ用)",
  "confidence": "high" | "medium" | "low",
  "notDm": この画像が DM / メール / 案件オファーでない場合 true (デフォルト false)
}

## 重要ルール
- 値が読み取れないフィールドは null (推測しない)
- 報酬は半角数字に正規化 (税抜優先、税込/税抜の区別が不明なら fee に入れて summary に "(税抜/税込不明)" を補足)
- summary は必ず日本語の自然な 1-2 文
- rawText は省略せずに DM 内の文章をそのまま書く (改行は \\n で)
- confidence: 案件名・報酬・締切が全部読み取れた = high、半分以上読み取れた = medium、それ未満 = low
- これが DM / 案件オファー / PR 依頼メール以外 (風景写真、料理写真、ホーム画面など) なら notDm: true を立てる`;

interface ExtractedDeal {
  brandName: string | null;
  senderHandle: string | null;
  contactName: string | null;
  category: string | null;
  fee: number | null;
  requirements: string | null;
  deadline: string | null;
  summary: string;
  rawText: string;
  confidence?: 'high' | 'medium' | 'low';
  notDm?: boolean;
}

async function extractWithClaudeVision(
  imageDataUrl: string,
  claudeApiKey: string,
): Promise<{ ok: true; deal: ExtractedDeal } | { ok: false; status: number; detail: string }> {
  // dataURL から media_type + base64 を抽出
  const m = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return { ok: false, status: 400, detail: 'invalid image data URL' };
  const mediaType = m[1];
  const base64 = m[2];

  const aiBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: VISION_SYS,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: '上記の DM スクリーンショットから案件情報を JSON で抽出してください。' },
      ],
    }],
  };

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(aiBody),
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, status: r.status, detail: t.slice(0, 300) };
    }
    const data = await r.json() as any;
    const text = data.content?.[0]?.text || '';
    const jm = text.match(/\{[\s\S]*\}/);
    if (!jm) return { ok: false, status: 502, detail: 'AI did not return JSON' };
    let parsed: ExtractedDeal;
    try {
      parsed = JSON.parse(jm[0]) as ExtractedDeal;
    } catch (e: any) {
      return { ok: false, status: 502, detail: 'JSON parse failed: ' + (e?.message || String(e)) };
    }
    // safety defaults
    parsed.summary = parsed.summary || '';
    parsed.rawText = parsed.rawText || '';
    return { ok: true, deal: parsed };
  } catch (e: any) {
    return { ok: false, status: 500, detail: e?.message || String(e) };
  }
}

function inferConfidence(d: ExtractedDeal): 'high' | 'medium' | 'low' {
  if (d.confidence) return d.confidence;
  let score = 0;
  if (d.brandName) score++;
  if (d.fee != null) score++;
  if (d.deadline) score++;
  if (d.requirements) score++;
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  let imageDataUrl: string | null = null;

  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.startsWith('multipart/form-data')) {
      const fd = await req.formData();
      const file = fd.get('image');
      if (file instanceof File) {
        const buf = await file.arrayBuffer();
        // chunk to avoid call stack overflow on large images
        const bytes = new Uint8Array(buf);
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const b64 = btoa(bin);
        const mt = file.type || 'image/png';
        imageDataUrl = `data:${mt};base64,${b64}`;
      }
    } else {
      const body = await req.json() as { imageDataUrl?: string };
      imageDataUrl = body.imageDataUrl || null;
    }
  } catch {
    return new Response(JSON.stringify({
      ok: false, error: 'invalid_body',
      message: '画像が読み取れませんでした',
      recovery: 'PNG または JPEG 形式でもう一度お試しください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  if (!imageDataUrl) {
    return new Response(JSON.stringify({
      ok: false, error: 'no_image',
      message: '画像が選ばれていません',
      recovery: 'DM のスクリーンショット (PNG / JPEG) を 1 枚アップロードしてください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const claudeKey = req.headers.get('x-claude-api-key') || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!claudeKey) {
    return new Response(JSON.stringify({
      ok: false, error: 'no_ai_key',
      message: 'AI 画像認識のキーが用意できていません',
      recovery: '少し時間をおいてもう一度お試しください (管理者へ報告済み)',
    }), { status: 503, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const result = await extractWithClaudeVision(imageDataUrl, claudeKey);
  if (!result.ok) {
    return new Response(JSON.stringify({
      ok: false, error: 'extraction_failed',
      message: '画像から読み取れませんでした',
      recovery: 'DM の本文が読める明るさ・大きさのスクショで再試行してください。文字が小さすぎると AI が拾えません。',
      detail: result.detail,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const d = result.deal;

  // DM ではない画像
  if (d.notDm === true) {
    return new Response(JSON.stringify({
      ok: false, error: 'not_dm',
      message: 'これは DM / 案件オファーの画像ではないようです',
      recovery: 'Instagram / X の DM 画面、または PR 依頼メールのスクリーンショットを送ってください',
      rawText: d.rawText || '',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  // 何も読み取れなかった
  if (!d.brandName && !d.summary && !d.rawText) {
    return new Response(JSON.stringify({
      ok: false, error: 'extraction_failed',
      message: '画像から文字を読み取れませんでした',
      recovery: 'もう少し明るく・大きく写ったスクショで再試行してください',
      rawText: '',
    }), { status: 422, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  return new Response(JSON.stringify({
    ok: true,
    deal: {
      brandName: d.brandName ?? null,
      senderHandle: d.senderHandle ?? null,
      contactName: d.contactName ?? null,
      category: d.category ?? null,
      fee: typeof d.fee === 'number' ? d.fee : null,
      requirements: d.requirements ?? null,
      deadline: d.deadline ?? null,
      summary: d.summary || '案件内容を読み取りました',
      rawText: d.rawText || '',
    },
    confidence: inferConfidence(d),
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...ch } });
}
