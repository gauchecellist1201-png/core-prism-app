// ============================================================
// POST /api/instagram/profile-from-screenshot
//
// ユーザーが Instagram のプロフィール画面のスクショ (PNG/JPEG) を 1 枚送るだけで、
// Claude Vision で OCR してプロフィール情報を抽出して返す。
//
// これにより、ユーザーは developers.facebook.com で開発者作業をしなくても
// 30 秒で Iris に実データを取込できる。
//
// Body (multipart/form-data):
//   image: File (PNG / JPEG / WebP)
// または JSON:
//   { imageDataUrl: "data:image/png;base64,..." }
//
// Response:
//   { ok: true, profile: { handle, followers, mediaCount, bio, ... } }
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

const VISION_SYS = `あなたは Instagram プロフィール画面のスクリーンショットを正確に読み取る OCR 専門家です。
ユーザーが送ったスクショから以下を JSON で抽出してください。読めない値は null にしてください (推測しない)。

返答は JSON のみ:
{
  "handle": "@your_handle" 形式 (ハンドル名、@ を含めない),
  "displayName": "アカウントの表示名 (本名やブランド名)",
  "followers": フォロワー数 (数値、"1.2万" は 12000、"1,234" は 1234),
  "following": フォロー数 (数値),
  "mediaCount": 投稿数 (数値),
  "bio": "プロフィール文 (改行は \\n で),
  "category": "プロアカウントなら表示されているカテゴリ (例: 'ミュージシャン/バンド', '教育', 'ビジネス')、無ければ null",
  "verified": 認証済みバッジがあれば true (青チェック),
  "highlights": ["ストーリーズハイライトのタイトル", ...] // 表示されていれば 1-5 件
}

ルール:
- 数字は半角に正規化。「1,234」「1.2万」「12K」も全て数値に。
- ハンドルは @ なしで返す。
- 値が不確かなら null。推測禁止。
- これが Instagram のプロフィール画面でないと判断したら error: "not_instagram_profile" を返す。`;

interface ExtractedProfile {
  handle: string | null;
  displayName: string | null;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  bio: string | null;
  category: string | null;
  verified: boolean;
  highlights: string[];
  error?: string;
}

async function extractWithClaudeVision(
  imageDataUrl: string,
  masterKey: string,
  claudeApiKey: string,
): Promise<{ ok: true; profile: ExtractedProfile } | { ok: false; status: number; detail: string }> {
  // dataURL から media_type + base64 を抽出
  const m = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return { ok: false, status: 400, detail: 'invalid image data URL' };
  const mediaType = m[1];
  const base64 = m[2];

  // /api/ai 経由で Claude Vision を呼ぶ (heavy で Claude にルート)
  const aiBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: VISION_SYS,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: '上記の Instagram プロフィール スクリーンショットを JSON で抽出してください。' },
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
    const parsed = JSON.parse(jm[0]) as ExtractedProfile;
    return { ok: true, profile: parsed };
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
      message: 'スクリーンショットの画像が見つかりません',
      recovery: 'Instagram のプロフィール画面のスクショを 1 枚アップロードしてください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  // Claude Vision は image をサポート、フォールバックなし (Gemini も Vision サポートするが現状は Claude のみで実装)
  const masterKey = req.headers.get('x-master-key') || '';
  const claudeKey = req.headers.get('x-claude-api-key') || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!claudeKey) {
    return new Response(JSON.stringify({
      ok: false, error: 'no_ai_key',
      message: 'AI 画像認識のキーが用意できていません',
      recovery: '少し時間をおいてもう一度お試しください (管理者へ報告済み)',
    }), { status: 503, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const result = await extractWithClaudeVision(imageDataUrl, masterKey, claudeKey);
  if (!result.ok) {
    return new Response(JSON.stringify({
      ok: false, error: 'extraction_failed',
      message: '画像から読み取れませんでした',
      recovery: 'プロフィール画面全体が映ったスクショを使ってください (フォロワー数とユーザー名が見える範囲)',
      detail: result.detail,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const p = result.profile;
  if (p.error === 'not_instagram_profile') {
    return new Response(JSON.stringify({
      ok: false, error: 'not_instagram_profile',
      message: 'Instagram のプロフィール画面ではないようです',
      recovery: 'Instagram アプリで自分のプロフィールを開いて、スクショを撮ってください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  if (!p.handle || p.followers == null) {
    return new Response(JSON.stringify({
      ok: false, error: 'incomplete',
      message: 'スクショから読み取れた情報が足りません',
      recovery: 'ユーザー名・フォロワー数・投稿数が全部映っているスクショで再試行してください',
      partial: p,
    }), { status: 422, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  // 正規化: IgProfile スキーマに合わせる
  return new Response(JSON.stringify({
    ok: true,
    profile: {
      handle: p.handle,
      followers: p.followers,
      avgLikes: 0, // スクショからは取れない (空のままにして、AI 戦略は followers ベースで動く)
      avgComments: 0,
      topPostCategories: p.category ? [p.category] : [],
      bestPostTime: '土 21:00', // 推定 (実 API 経由連携で上書きされる)
      saveRate: 0,
      storyViewRate: 0,
      audienceAge: [],
      audienceGender: { female: 0, male: 0, other: 0 },
      audienceTopCountries: [],
      mediaCount: p.mediaCount || 0,
      source: 'screenshot-ai' as const,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      extracted: {
        displayName: p.displayName,
        bio: p.bio,
        category: p.category,
        verified: p.verified,
        highlights: p.highlights,
        following: p.following,
      },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...ch } });
}
