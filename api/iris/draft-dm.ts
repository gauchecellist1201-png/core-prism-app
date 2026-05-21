// ============================================================
// POST /api/iris/draft-dm
//
// インフルエンサー → ブランド の「初回 DM 下書き」を AI が生成する。
// IG プロフィール (オーディエンス層・フォロワー規模・カテゴリ) と
// 案件情報 (ブランド名・カテゴリ・想定報酬・要件) を渡すと、
// すぐ Instagram DM にコピペできる本文と、トーン違いの代替案 2 件を返す。
//
// Body:
//   {
//     igProfile: IgProfile,
//     deal: {
//       brandName: string,
//       category: string,
//       fee?: number,
//       requirements?: string,
//       contactHandle?: string,
//     },
//     customNote?: string,
//   }
//
// Response:
//   {
//     ok: true,
//     draft: { subject?, body, tone, callToAction },
//     alternatives: [ { body, tone } x 2 ],
//     warnings?: string[],
//     _meta?: { source: 'ai' | 'fallback' },
//   }
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

// ── 型 (instagramConnect.ts と整合) ──────────────────────────
interface IgProfile {
  handle: string;
  followers: number;
  avgLikes?: number;
  avgComments?: number;
  saveRate?: number;
  audienceAge?: { range: string; pct: number }[];
  audienceGender?: { female: number; male: number; other: number };
  topPostCategories?: string[];
}

interface DealInput {
  brandName: string;
  category: string;
  fee?: number;
  requirements?: string;
  contactHandle?: string;
}

type Tone = 'professional' | 'casual' | 'friendly';

interface Draft {
  subject?: string;
  body: string;
  tone: Tone;
  callToAction: string;
}

interface DraftResponse {
  ok: true;
  draft: Draft;
  alternatives: { body: string; tone: Tone }[];
  warnings?: string[];
  _meta?: { source: 'ai' | 'fallback'; reason?: string };
}

// ── トーン推定 (フォロワー規模 × カテゴリ) ───────────────────
function inferTone(profile: IgProfile, deal: DealInput): Tone {
  const f = profile.followers || 0;
  // 大規模 + ラグジュアリー系ブランド → professional
  const cat = `${deal.category} ${deal.brandName}`.toLowerCase();
  const isLuxury = /luxury|hermes|chanel|gucci|プレステージ|ハイブランド|ラグジュアリー/.test(cat);
  if (f >= 50000 || isLuxury) return 'professional';
  // ナノ層 (〜1万) は親しみやすく
  if (f < 10000) return 'friendly';
  // その他はカジュアル
  return 'casual';
}

// ── トーン別の文体ヒント ──────────────────────────────────
function toneStyleHint(tone: Tone): string {
  switch (tone) {
    case 'professional':
      return 'ですます調で丁寧。敬語ベース。簡潔。';
    case 'friendly':
      return 'ですます調だが温かい。「〜が大好きで」「いつも楽しみにしています」のような親近感ある一言を含める。';
    case 'casual':
    default:
      return 'ですます調で自然体。フランクすぎず、でも堅すぎない、SNS 文化に馴染んだ書き方。';
  }
}

// ── フォールバック (AI 失敗時にもユーザー体験を壊さない) ──
function fallbackDraft(profile: IgProfile, deal: DealInput, customNote?: string): DraftResponse {
  const handle = profile.handle || 'creator';
  const followers = profile.followers ? profile.followers.toLocaleString() : '?';
  const femalePct = profile.audienceGender?.female ?? 0;
  const malePct = profile.audienceGender?.male ?? 0;
  const topAge = profile.audienceAge?.[0]?.range || '';
  const audienceLine = (femalePct > 0 || malePct > 0)
    ? `フォロワーは${topAge ? `${topAge}の` : ''}${femalePct >= 55 ? '女性' : malePct >= 55 ? '男性' : '混合'}層が中心で、${deal.category}の感度が高い方が多いです。`
    : `${deal.category}に関心のあるフォロワーが中心です。`;
  const customLine = customNote?.trim() ? `\n\n${customNote.trim()}` : '';
  const feeLine = deal.fee
    ? `\n\nもしご相談可能でしたら、想定報酬や進め方について詳しくお伺いできますと幸いです。`
    : '\n\nもしご興味をお持ちいただけましたら、案件の進め方や条件について詳しくお伺いできますと幸いです。';

  const tone = inferTone(profile, deal);

  const body =
`${deal.brandName} ご担当者様

はじめまして。Instagram で @${handle} として活動している ${handle} と申します。
フォロワーは ${followers} 名、${audienceLine}

${deal.brandName} さんの世界観が好きで、いつも投稿を拝見しております。${deal.category}カテゴリで、ぜひ一度ご一緒できる機会があればと思いご連絡しました。${customLine}${feeLine}

ご返信お待ちしております。
@${handle}`;

  const altCasual =
`${deal.brandName} さん

突然のご連絡失礼します。@${handle} で発信している ${handle} です ✨
${audienceLine}フォロワー ${followers} 名規模で、${deal.category}案件のご投稿経験もあります。

${deal.brandName} さんの商品が本当に好きで、いつかご一緒できたらいいなと思いずっとフォローしていました。
もし PR や商品レビューの機会がありましたら、ぜひ詳しくお話を伺いたいです。

よろしくお願いします!
@${handle}`;

  const altFriendly =
`${deal.brandName} 様

こんにちは!Instagram でクリエイター活動をしている @${handle} です。
いつも素敵な投稿を楽しみにしています ☺️

私のアカウントでは ${audienceLine}フォロワー数は ${followers} 名です。
もしタイアップや PR の機会がございましたら、ぜひ一度お話を聞かせていただきたく、ご連絡しました。

お時間ある時にお返事いただけたら嬉しいです。
@${handle}`;

  const warnings: string[] = [];
  if (!deal.fee) warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
  warnings.push('送信前に必ず本文を自分の言葉で見直してください。AI が生成した雛形です。');

  return {
    ok: true,
    draft: {
      body,
      tone,
      callToAction: '案件の進め方・条件についてお伺いできますか?',
    },
    alternatives: [
      { body: altCasual, tone: 'casual' },
      { body: altFriendly, tone: 'friendly' },
    ],
    warnings,
    _meta: { source: 'fallback', reason: 'ai_unavailable' },
  };
}

// ── システムプロンプト ──────────────────────────────────────
const SYS = `あなたはインフルエンサー本人の代わりに、ブランドへ送る「初回 DM 下書き」を書くプロです。
押し売りせず、相手のブランドへの敬意と、自分が選ばれる理由を1往復目で簡潔に伝えるのが仕事です。

返答は JSON のみ:
{
  "draft": {
    "body": "DM 本文 (200-400 字、宛名 → 自己紹介 → ブランドへの共感 → なぜ自分が合うか → CTA → 署名)",
    "tone": "professional | casual | friendly のいずれか",
    "callToAction": "DM 末尾で促す次のアクション (1 文、例: '商品サンプルをお送りいただくことは可能でしょうか?')"
  },
  "alternatives": [
    { "body": "別トーンの本文", "tone": "casual" or "friendly" or "professional" },
    { "body": "もう一つの別トーンの本文", "tone": "別のトーン" }
  ],
  "warnings": ["送信前の注意点", ...] // 0-3 件
}

ルール:
- DM なので件名は不要、冒頭は「{ブランド名} ご担当者様」または「{ブランド名} 様」「{ブランド名} さん」(トーンに応じて)
- 本文 200-400 字。長すぎ NG、5 行以内が理想
- フォロワー数・オーディエンス層・カテゴリ感度を「数字で 1 度だけ」具体的に触れる(誇張禁止)
- ブランドの世界観への共感を 1 文 (具体的に)
- CTA は控えめ。「ご相談可能でしたら、進め方や条件についてお伺いできますと幸いです」のようなお伺いベース
- 末尾は「@ハンドル名」で署名
- alternatives は 必ず 2 件、トーンは draft.tone と被らない 2 つを選ぶ
- 数字を捏造しない。渡されていないデータには触れない
- 全部日本語
- 押し売り NG、自己アピール過多 NG`;

// ── ハンドラ ───────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'POST メソッドで呼び出してください' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  let body: { igProfile?: IgProfile; deal?: DealInput; customNote?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'invalid_json', message: 'リクエスト本文が JSON ではありません' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  const profile = body.igProfile;
  const deal = body.deal;

  if (!profile || !profile.handle) {
    return new Response(JSON.stringify({
      error: 'no_profile',
      message: 'Instagram プロフィールが渡されていません。先に Instagram 連携を完了してください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }
  if (!deal || !deal.brandName || !deal.category) {
    return new Response(JSON.stringify({
      error: 'no_deal',
      message: '案件情報 (brandName, category) が必要です',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const tone = inferTone(profile, deal);

  const userPrompt = `## クリエイターのプロフィール
ユーザー名: @${profile.handle}
フォロワー数: ${profile.followers.toLocaleString()}
${profile.audienceAge && profile.audienceAge.length > 0 ? `主要年齢層: ${profile.audienceAge[0].range} (${profile.audienceAge[0].pct}%)` : ''}
${profile.audienceGender ? `性別: 女性 ${profile.audienceGender.female}% / 男性 ${profile.audienceGender.male}%` : ''}
${profile.saveRate ? `保存率: ${profile.saveRate}%` : ''}
${profile.topPostCategories?.length ? `投稿カテゴリ: ${profile.topPostCategories.join(' / ')}` : ''}

## 送信先 (ブランド)
ブランド名: ${deal.brandName}
カテゴリ: ${deal.category}
${deal.fee ? `想定報酬: ¥${deal.fee.toLocaleString()}` : '想定報酬: 未確定 (初回 DM で確認する)'}
${deal.requirements ? `要件: ${deal.requirements}` : ''}
${deal.contactHandle ? `送付先: @${deal.contactHandle}` : ''}

## クリエイターから追加で伝えたいこと
${body.customNote?.trim() || '(なし)'}

## 推定トーン
${tone} (${toneStyleHint(tone)})

このクリエイターになりきって、${deal.brandName} へ送る初回 DM を JSON で書いてください。`;

  // /api/ai を経由 — heavy 重量で Claude 優先
  const aiUrl = new URL('/api/ai', req.url);
  try {
    const r = await fetch(aiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': req.headers.get('x-master-key') || '',
        'x-claude-api-key': req.headers.get('x-claude-api-key') || '',
        'x-ai-weight': 'heavy',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (r.ok) {
      const data = await r.json() as any;
      const text = data.content?.[0]?.text || '';
      try {
        const m = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(m ? m[0] : text);
        // 検証
        if (parsed.draft && typeof parsed.draft.body === 'string' && parsed.draft.body.trim().length > 30) {
          const draft: Draft = {
            body: parsed.draft.body,
            tone: (parsed.draft.tone as Tone) || tone,
            callToAction: parsed.draft.callToAction || '案件の進め方・条件についてお伺いできますか?',
            subject: parsed.draft.subject,
          };
          const alternatives = Array.isArray(parsed.alternatives)
            ? parsed.alternatives
                .filter((a: any) => a && typeof a.body === 'string' && a.body.trim().length > 30)
                .slice(0, 2)
                .map((a: any) => ({ body: a.body, tone: (a.tone as Tone) || 'casual' }))
            : [];
          // alternatives が足りない場合はフォールバックから補充
          if (alternatives.length < 2) {
            const fb = fallbackDraft(profile, deal, body.customNote);
            for (const a of fb.alternatives) {
              if (alternatives.length >= 2) break;
              if (!alternatives.find(x => x.tone === a.tone)) alternatives.push(a);
            }
          }
          const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 3) : [];
          if (!deal.fee && !warnings.find((w: string) => /報酬|条件/.test(w))) {
            warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
          }
          const resp: DraftResponse = {
            ok: true,
            draft,
            alternatives,
            warnings: warnings.length > 0 ? warnings : undefined,
            _meta: { source: 'ai' },
          };
          return new Response(JSON.stringify(resp), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...ch },
          });
        }
      } catch { /* fallthrough */ }
    }
  } catch { /* network error → fallback */ }

  // AI 失敗 → フォールバック (絶対に空にしない)
  return new Response(JSON.stringify(fallbackDraft(profile, deal, body.customNote)), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...ch },
  });
}
