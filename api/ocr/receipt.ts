// ============================================================
// POST /api/ocr/receipt
//
// 経費レシートの写真 1 枚 → Claude Vision で OCR → 構造化データを返す。
// Prism の経費入力フォームを「写真撮るだけで完成」にするためのエンドポイント。
// オーナー指示 (2026-05-27 オーナー帰宅前後):
//   API キー連携はハードル高い → スクショ / 画像から AI が読み取る経路を増やす
// Iris の profile-from-screenshot と同じパターンを再利用。
//
// Body (multipart/form-data):
//   image: File (PNG / JPEG / WebP / HEIC)
// または JSON:
//   { imageDataUrl: "data:image/png;base64,..." }
//
// Response 成功:
//   { ok: true, receipt: {
//       date: 'YYYY-MM-DD' | null,
//       totalJpy: number | null,            // 税込合計
//       taxJpy: number | null,              // 消費税額 (分かる時のみ)
//       vendor: string | null,              // 店舗・会社名
//       category: '交通費' | '飲食' | '消耗品' | '通信費' | '会議' | '広告' | 'その他',
//       memo: string,                       // 自由メモ (項目名一覧など)
//       confidence: 'high' | 'medium' | 'low',
//     } }
// Response 失敗:
//   { ok: false, error, message, recovery, detail? }
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

const VISION_SYS = `あなたは日本のレシート・領収書を読み取る OCR 専門家です。
ユーザーが送ったレシート画像から、経費計上に必要な情報を JSON で抽出してください。
読み取れない値は null にしてください。推測は禁止です。

返答は JSON のみ:
{
  "date": "YYYY-MM-DD" (発行日。和暦は西暦変換),
  "totalJpy": 合計金額 (税込・数値、¥ や , を除く),
  "taxJpy": 消費税額 (数値、レシートに明示されていれば。無ければ null),
  "vendor": "発行元の店舗・会社名 (例: スターバックス渋谷店)",
  "category": 以下のいずれか1つ:
    - "交通費"  (タクシー / 電車 / 駐車場 / ガソリン)
    - "飲食"    (レストラン / カフェ / 弁当 / 接待)
    - "消耗品"  (文具 / 雑貨 / オフィス用品)
    - "通信費"  (携帯 / インターネット)
    - "会議"   (貸会議室 / 打ち合わせ場所)
    - "広告"   (Web 広告 / 印刷)
    - "その他"  (判定できない時),
  "memo": "主な明細 1-3 行 (商品名 + 数量)。例: '抹茶ラテ x2、ベーグル x1'。プライバシー配慮で氏名は除く",
  "confidence": "high" / "medium" / "low" (画像の鮮明さと情報の完全性で判定)
}

ルール:
- 数字は半角に正規化 (「1,234」→ 1234)
- 日付は YYYY-MM-DD (例: 「令和6年5月27日」→「2024-05-27」、年が無ければ今年と推定)
- 合計が無い時は totalJpy: null (項目別の最大金額ではなく)
- レシートでないと判定したら error: "not_receipt" を返す`;

interface ExtractedReceipt {
  date: string | null;
  totalJpy: number | null;
  taxJpy: number | null;
  vendor: string | null;
  category: string | null;
  memo: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  error?: string;
}

async function extractWithClaudeVision(
  imageDataUrl: string,
  claudeApiKey: string,
): Promise<{ ok: true; receipt: ExtractedReceipt } | { ok: false; status: number; detail: string }> {
  const m = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return { ok: false, status: 400, detail: 'invalid image data URL' };
  const mediaType = m[1];
  const base64 = m[2];

  const aiBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: VISION_SYS,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: '上記のレシート画像を JSON で抽出してください。' },
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
    const parsed = JSON.parse(jm[0]) as ExtractedReceipt;
    return { ok: true, receipt: parsed };
  } catch (e: any) {
    return { ok: false, status: 500, detail: e?.message || String(e) };
  }
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
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
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
      message: 'レシート画像が見つかりません',
      recovery: 'レシートの写真を 1 枚アップロードしてください',
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
      recovery: 'レシートが鮮明に映った写真をもう一度。光の反射や手ブレに注意してください',
      detail: result.detail,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const r = result.receipt;
  if (r.error === 'not_receipt') {
    return new Response(JSON.stringify({
      ok: false, error: 'not_receipt',
      message: 'レシート / 領収書の画像ではないようです',
      recovery: 'レシート全体が枠内に映るように撮り直してください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  if (r.totalJpy == null || !r.totalJpy) {
    return new Response(JSON.stringify({
      ok: false, error: 'no_total',
      message: '合計金額が読み取れませんでした',
      recovery: 'レシート下部の「合計」が枠内に入るように撮り直してください',
      partial: r,
    }), { status: 422, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  return new Response(JSON.stringify({
    ok: true,
    receipt: {
      date: r.date || new Date().toISOString().slice(0, 10),
      totalJpy: r.totalJpy,
      taxJpy: r.taxJpy ?? null,
      vendor: r.vendor || null,
      category: r.category || 'その他',
      memo: r.memo || '',
      confidence: r.confidence || 'medium',
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...ch } });
}
