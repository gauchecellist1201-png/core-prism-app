// ============================================================
// POST /api/iris/extract-deal-from-screenshot
//
// インフルエンサーが受けた「DM 案件オファー」のスクショ (Instagram DM / X DM
// / メール画面の写真) を 1〜3 枚送るだけで、Claude Vision が読み取って
// 「案件カード」用の構造化データを返す。
//
// プレゼン用の中核機能 — 写真をポンと送るだけ + 長い DM は 3 枚連結 OK。
//
// Body (multipart/form-data):
//   image: File (PNG / JPEG / WebP) - 単一 (後方互換)
//   image, image, image: File... - 複数 (最大 3 枚)
// または JSON:
//   { imageDataUrl: "data:image/png;base64,..." }                    // 1 枚
//   { imageDataUrls: ["data:image/png;base64,...", "..." (最大 3)] } // 複数
//
// Response (成功):
//   {
//     ok: true,
//     deal: {
//       brandName, senderHandle, contactName, category,
//       fee, requirements, deadline, summary, rawText,
//     },
//     confidence: 'high' | 'medium' | 'low',
//     weakFields: string[],          // 空欄 / 推定込みのフィールド一覧
//     followUpQuestions: string[],   // 補完のためにユーザーに聞きたい質問 (最大 3)
//     imageCount: number,
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

複数枚 (最大 3 枚) が渡された場合は、同じ DM スレッドのスクロール画像として
**時系列順に統合**して 1 件の案件にまとめてください
(例: 1 枚目が前半、2 枚目が後半、3 枚目に金額提示があるなど)。

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
  "weakFields": ["fee", "deadline" など、自信が低い or 空欄のフィールド名],
  "followUpQuestions": [
    "ユーザーに聞いて補完したい質問 (例: '報酬は 5 万円で合っていますか?')。最大 3 つ。
     weakFields がある時だけ。なければ空配列。"
  ],
  "notDm": この画像が DM / メール / 案件オファーでない場合 true (デフォルト false)
}

## 重要ルール
- 値が読み取れないフィールドは null (推測しない)
- 報酬は半角数字に正規化 (税抜優先、税込/税抜の区別が不明なら fee に入れて summary に "(税抜/税込不明)" を補足)
- summary は必ず日本語の自然な 1-2 文
- rawText は省略せずに DM 内の文章をそのまま書く (改行は \\n で)
- confidence: 案件名・報酬・締切が全部読み取れた = high、半分以上読み取れた = medium、それ未満 = low
- weakFields は brandName/senderHandle/contactName/category/fee/requirements/deadline の中から、
  読み取れなかった or 推定が混じったフィールド名を返す
- followUpQuestions は weakFields を埋める為の自然な質問 (例: '依頼の納品物は何ですか?')。
  「**やさしい日本語で 1 文ずつ**」「最大 3 問」、なければ空配列
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
  weakFields?: string[];
  followUpQuestions?: string[];
  notDm?: boolean;
}

async function extractWithClaudeVision(
  imageDataUrls: string[],
  claudeApiKey: string,
): Promise<{ ok: true; deal: ExtractedDeal } | { ok: false; status: number; detail: string }> {
  // 各 dataURL を parse
  const images: { mediaType: string; base64: string }[] = [];
  for (const url of imageDataUrls) {
    const m = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!m) return { ok: false, status: 400, detail: 'invalid image data URL' };
    images.push({ mediaType: m[1], base64: m[2] });
  }

  // Claude messages content に画像を順に並べる
  const content: any[] = [];
  images.forEach((img, idx) => {
    if (images.length > 1) {
      content.push({ type: 'text', text: `[スクショ ${idx + 1}/${images.length}]` });
    }
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
  });
  const promptText = images.length > 1
    ? `上記 ${images.length} 枚の DM スクリーンショットは同じスレッドの連続画像です。時系列順に統合して 1 件の案件として JSON で抽出してください。`
    : '上記の DM スクリーンショットから案件情報を JSON で抽出してください。';
  content.push({ type: 'text', text: promptText });

  const aiBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 2560,
    system: VISION_SYS,
    messages: [{ role: 'user', content }],
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

  let imageDataUrls: string[] = [];

  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.startsWith('multipart/form-data')) {
      const fd = await req.formData();
      // 「image」キーで送られた全ファイルを拾う (複数対応)
      const files = fd.getAll('image').filter(v => v instanceof File) as File[];
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const b64 = btoa(bin);
        const mt = file.type || 'image/png';
        imageDataUrls.push(`data:${mt};base64,${b64}`);
      }
    } else {
      const body = await req.json() as { imageDataUrl?: string; imageDataUrls?: string[] };
      if (Array.isArray(body.imageDataUrls)) {
        imageDataUrls = body.imageDataUrls.filter(s => typeof s === 'string' && s.length > 0);
      } else if (body.imageDataUrl) {
        imageDataUrls = [body.imageDataUrl];
      }
    }
  } catch {
    return new Response(JSON.stringify({
      ok: false, error: 'invalid_body',
      message: '画像が読み取れませんでした',
      recovery: 'PNG または JPEG 形式でもう一度お試しください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  // 最大 3 枚に制限
  if (imageDataUrls.length > 3) imageDataUrls = imageDataUrls.slice(0, 3);

  if (imageDataUrls.length === 0) {
    return new Response(JSON.stringify({
      ok: false, error: 'no_image',
      message: '画像が選ばれていません',
      recovery: 'DM のスクリーンショット (PNG / JPEG) を 1〜3 枚アップロードしてください',
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

  const result = await extractWithClaudeVision(imageDataUrls, claudeKey);
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

  // weakFields を server 側でも保険補完 (AI が返してこない時の fallback)
  const weakFields: string[] = Array.isArray(d.weakFields)
    ? d.weakFields.filter((s: any) => typeof s === 'string')
    : [];
  const autoWeak: string[] = [];
  if (!d.brandName) autoWeak.push('brandName');
  if (d.fee == null) autoWeak.push('fee');
  if (!d.deadline) autoWeak.push('deadline');
  if (!d.requirements) autoWeak.push('requirements');
  for (const f of autoWeak) if (!weakFields.includes(f)) weakFields.push(f);

  // follow up questions も無ければ自動生成 (yasashii nihongo)
  const fieldQ: Record<string, string> = {
    brandName:    'ブランド名 / 会社名は何ですか?',
    fee:          '報酬はいくらと書いてありましたか? (税抜・円)',
    deadline:     '締切はいつですか? (例: 11/30 まで)',
    requirements: '依頼の納品物は何ですか? (例: リール 1 本 + ストーリー 2 枚)',
    senderHandle: '送り主の @ ハンドルは何ですか?',
    contactName:  '担当者の名前は何ですか?',
    category:     '案件のカテゴリは何ですか? (コスメ / ファッションなど)',
  };
  let followUpQuestions: string[] = Array.isArray(d.followUpQuestions)
    ? d.followUpQuestions.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 3)
    : [];
  if (followUpQuestions.length === 0 && weakFields.length > 0) {
    followUpQuestions = weakFields.slice(0, 3).map(f => fieldQ[f] || `${f} について教えてください`);
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
    weakFields,
    followUpQuestions,
    imageCount: imageDataUrls.length,
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...ch } });
}
