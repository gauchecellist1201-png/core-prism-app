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
//     tone?: 'polite' | 'friendly' | 'pro' | 'passionate',  // 明示プリセット
//     mediaKit?: { followers?, audience?, category?, engagement? },
//     mentionMediaKit?: boolean,                             // MediaKit 自動反映
//     ngWords?: string[],                                    // ブランドガイド NG ワード
//   }
//
// Response:
//   {
//     ok: true,
//     draft: { subject?, body, tone, callToAction },
//     alternatives: [ { body, tone } x 2 ],
//     warnings?: string[],
//     ngHits?: string[],                                      // NG ワード違反 (本文内に含まれた語)
//     replyPredictions?: { label: string; example: string }[], // 返信予測 2-3 件
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

interface MediaKitSummary {
  followers?: number | string;
  audience?: string;
  category?: string;
  engagement?: number | string;
}

type Tone = 'polite' | 'friendly' | 'pro' | 'passionate';

// ── 旧 Tone (professional|casual|friendly) との互換マッピング ─
function normalizeTone(t: string | undefined): Tone {
  switch (t) {
    case 'polite':
    case 'professional': return 'polite';
    case 'friendly':
    case 'casual':       return 'friendly';
    case 'pro':          return 'pro';
    case 'passionate':   return 'passionate';
    default:             return 'polite';
  }
}

interface Draft {
  subject?: string;
  body: string;
  tone: Tone;
  callToAction: string;
}

interface ReplyPrediction { label: string; example: string }

interface DraftResponse {
  ok: true;
  draft: Draft;
  alternatives: { body: string; tone: Tone }[];
  warnings?: string[];
  ngHits?: string[];
  replyPredictions?: ReplyPrediction[];
  _meta?: { source: 'ai' | 'fallback'; reason?: string };
}

// ── トーンプリセット定義 ────────────────────────────────────
const TONE_PRESETS: Record<Tone, { label: string; systemHint: string }> = {
  polite: {
    label: '丁寧 / 大人',
    systemHint:
      'ですます調で敬語ベース。落ち着いた大人の文体。簡潔で礼儀正しく、ブランドへの敬意を全文に通す。絵文字は最大1つまで(なしでも良い)。',
  },
  friendly: {
    label: 'フレンドリー / 親近感',
    systemHint:
      'ですます調を維持しつつ温かみのある言葉選び。「いつも楽しみにしています」「大好きで」のような親近感ある一言を1つ含める。絵文字は2つまで。',
  },
  pro: {
    label: 'プロフェッショナル / 簡潔',
    systemHint:
      'ビジネスメール調。3-4文の簡潔な構成。要点を箇条書き的に明示してもよい。エンゲージメント率やリーチなど数字で実績を示す。絵文字なし。',
  },
  passionate: {
    label: 'コラボ熱量高め / 情熱',
    systemHint:
      'ですます調だが熱量高め。「ぜひ」「本当に」「心から」など気持ちを込めた言葉。ブランドへの愛と共創への意欲を率直に伝える。絵文字は2-3個使ってOK(✨💛🤝など)。',
  },
};

// ── 旧トーン推定 (フォロワー規模 × カテゴリ) ───────────────────
function inferTone(profile: IgProfile, deal: DealInput): Tone {
  const f = profile.followers || 0;
  const cat = `${deal.category} ${deal.brandName}`.toLowerCase();
  const isLuxury = /luxury|hermes|chanel|gucci|プレステージ|ハイブランド|ラグジュアリー/.test(cat);
  if (isLuxury) return 'polite';
  if (f >= 50000) return 'pro';
  if (f < 10000) return 'friendly';
  return 'polite';
}

// ── NG ワード検出 ────────────────────────────────────────────
function detectNgHits(text: string, ngWords?: string[]): string[] {
  if (!text || !ngWords || ngWords.length === 0) return [];
  const hits: string[] = [];
  for (const w of ngWords) {
    const t = (w || '').trim();
    if (!t) continue;
    if (text.includes(t) && !hits.includes(t)) hits.push(t);
  }
  return hits;
}

// ── MediaKit 1 行 ──────────────────────────────────────────
function mediaKitLine(kit?: MediaKitSummary): string {
  if (!kit) return '';
  const bits: string[] = [];
  if (kit.followers) bits.push(`フォロワー${kit.followers}`);
  if (kit.audience) bits.push(`主要層${kit.audience}`);
  if (kit.category) bits.push(`${kit.category}発信`);
  if (kit.engagement) bits.push(`平均ER${kit.engagement}${typeof kit.engagement === 'number' ? '%' : ''}`);
  if (bits.length === 0) return '';
  return `私の特徴は ${bits.join(' / ')} です。`;
}

// ── フォールバック (AI 失敗時にもユーザー体験を壊さない) ──
function fallbackDraft(
  profile: IgProfile,
  deal: DealInput,
  customNote?: string,
  preferredTone?: Tone,
  mediaKit?: MediaKitSummary,
  mentionMediaKit?: boolean,
  ngWords?: string[],
): DraftResponse {
  const handle = profile.handle || 'creator';
  const followers = profile.followers ? profile.followers.toLocaleString() : '?';
  const femalePct = profile.audienceGender?.female ?? 0;
  const malePct = profile.audienceGender?.male ?? 0;
  const topAge = profile.audienceAge?.[0]?.range || '';
  const audienceLine = (femalePct > 0 || malePct > 0)
    ? `フォロワーは${topAge ? `${topAge}の` : ''}${femalePct >= 55 ? '女性' : malePct >= 55 ? '男性' : '混合'}層が中心で、${deal.category}の感度が高い方が多いです。`
    : `${deal.category}に関心のあるフォロワーが中心です。`;
  const customLine = customNote?.trim() ? `\n\n${customNote.trim()}` : '';
  const kitLine = mentionMediaKit ? mediaKitLine(mediaKit) : '';
  const kitBlock = kitLine ? `\n${kitLine}` : '';
  const feeLine = deal.fee
    ? `\n\nもしご相談可能でしたら、想定報酬や進め方について詳しくお伺いできますと幸いです。`
    : '\n\nもしご興味をお持ちいただけましたら、案件の進め方や条件について詳しくお伺いできますと幸いです。';

  const tone = preferredTone || inferTone(profile, deal);

  const bodyPolite =
`${deal.brandName} ご担当者様

はじめまして。Instagram で @${handle} として活動している ${handle} と申します。
フォロワーは ${followers} 名、${audienceLine}${kitBlock}

${deal.brandName} さんの世界観が好きで、いつも投稿を拝見しております。${deal.category}カテゴリで、ぜひ一度ご一緒できる機会があればと思いご連絡しました。${customLine}${feeLine}

ご返信お待ちしております。
@${handle}`;

  const bodyFriendly =
`${deal.brandName} さん

こんにちは!Instagram でクリエイター活動をしている @${handle} です ☺️
いつも素敵な投稿を楽しみにしています。${audienceLine}${kitBlock}

${deal.brandName} さんの商品が本当に好きで、いつかご一緒できたらいいなと思いずっとフォローしていました。
もし PR や商品レビューの機会がありましたら、ぜひ詳しくお話を伺いたいです。${customLine}

お時間ある時にお返事いただけたら嬉しいです。
@${handle}`;

  const bodyPro =
`${deal.brandName} ご担当者様

@${handle} です。フォロワー ${followers} 名、${deal.category}領域で活動しています。
${audienceLine}${kitBlock}

${deal.brandName} さんのブランドコンセプトに親和性を感じております。タイアップ案件のご相談が可能でしたら、条件・進行スケジュールについて伺えますと幸いです。${customLine}

ご検討よろしくお願いいたします。
@${handle}`;

  const bodyPassionate =
`${deal.brandName} さん

突然のご連絡失礼します!@${handle} で発信している ${handle} です ✨
${deal.brandName} さんのことが本当に大好きで、いつもチェックさせていただいてます💛

${audienceLine}フォロワーは ${followers} 名規模です。${kitBlock}
もしご一緒できる機会があるなら、心を込めて発信したいです🤝${customLine}

ぜひ一度お話だけでも伺えませんか?
@${handle}`;

  const allBodies: Record<Tone, string> = {
    polite: bodyPolite,
    friendly: bodyFriendly,
    pro: bodyPro,
    passionate: bodyPassionate,
  };

  const mainBody = allBodies[tone];
  const altTones: Tone[] = (['polite', 'friendly', 'pro', 'passionate'] as Tone[])
    .filter(t => t !== tone)
    .slice(0, 2);
  const alternatives = altTones.map(t => ({ body: allBodies[t], tone: t }));

  const warnings: string[] = [];
  if (!deal.fee) warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
  warnings.push('送信前に必ず本文を自分の言葉で見直してください。AI が生成した雛形です。');

  const ngHits = detectNgHits(mainBody, ngWords);

  return {
    ok: true,
    draft: {
      body: mainBody,
      tone,
      callToAction: '案件の進め方・条件についてお伺いできますか?',
    },
    alternatives,
    warnings,
    ngHits: ngHits.length > 0 ? ngHits : undefined,
    replyPredictions: defaultReplyPredictions(deal),
    _meta: { source: 'fallback', reason: 'ai_unavailable' },
  };
}

// ── デフォルト返信予測 (AI 失敗時用) ──────────────────────
function defaultReplyPredictions(deal: DealInput): ReplyPrediction[] {
  const out: ReplyPrediction[] = [
    {
      label: '前向きに条件確認',
      example: `ご連絡ありがとうございます。${deal.brandName}でございます。タイアップのご提案について、媒体資料(MediaKit)を拝見させてください。`,
    },
    {
      label: '丁寧にお断り',
      example: '現在、新規のタイアップは募集を停止しております。ご提案いただきありがとうございました。',
    },
    {
      label: '具体的な条件提示',
      example: `${deal.brandName}です。ご興味ありがとうございます。フィード1本+ストーリーズ2本のセット案件で、報酬は${deal.fee ? '¥' + deal.fee.toLocaleString() : 'ご相談'}を想定しています。ご検討ください。`,
    },
  ];
  return out;
}

// ── システムプロンプト ──────────────────────────────────────
function buildSystemPrompt(tone: Tone, ngWords: string[], hasMediaKit: boolean): string {
  const ngLine = ngWords.length > 0
    ? `\n\n## 禁止語(絶対に本文に含めない): ${ngWords.join('、')}\nこれらの言葉は薬機法・景表法・ブランドガイドの観点で NG です。類義語も避けてください。`
    : '';
  const kitLine = hasMediaKit
    ? '\n\n## MediaKit 反映指示: ユーザーが MediaKit 反映を ON にしているため、「私の特徴は◯◯です」のような1文を必ず本文に1度だけ自然に挿入してください。'
    : '';
  return `あなたはインフルエンサー本人の代わりに、ブランドへ送る「初回 DM 下書き」を書くプロです。
押し売りせず、相手のブランドへの敬意と、自分が選ばれる理由を1往復目で簡潔に伝えるのが仕事です。

## 指定トーン: ${TONE_PRESETS[tone].label}
${TONE_PRESETS[tone].systemHint}${ngLine}${kitLine}

返答は JSON のみ:
{
  "draft": {
    "body": "DM 本文 (200-400 字、宛名 → 自己紹介 → ブランドへの共感 → なぜ自分が合うか → CTA → 署名)",
    "tone": "${tone}",
    "callToAction": "DM 末尾で促す次のアクション (1 文)"
  },
  "alternatives": [
    { "body": "別トーンの本文", "tone": "polite | friendly | pro | passionate (指定トーン以外)" },
    { "body": "もう一つの別トーンの本文", "tone": "別のトーン" }
  ],
  "warnings": ["送信前の注意点", ...],
  "replyPredictions": [
    { "label": "前向きに条件確認", "example": "ブランド側からの返信例 (1-3文)" },
    { "label": "丁寧にお断り", "example": "..." },
    { "label": "具体的な条件提示", "example": "..." }
  ]
}

ルール:
- DM なので件名は不要、冒頭は「{ブランド名} ご担当者様」または「{ブランド名} 様」「{ブランド名} さん」(トーンに応じて)
- 本文 200-400 字。長すぎ NG、5-7 行以内が理想
- フォロワー数・オーディエンス層・カテゴリ感度を「数字で 1 度だけ」具体的に触れる(誇張禁止)
- ブランドの世界観への共感を 1 文 (具体的に)
- CTA は控えめ。「ご相談可能でしたら、進め方や条件についてお伺いできますと幸いです」のようなお伺いベース
- 末尾は「@ハンドル名」で署名
- alternatives は 必ず 2 件、指定トーン以外の 2 つを選ぶ
- replyPredictions は ブランド側が返してきそうなパターンを2-3 件、それぞれ label と example で
- 数字を捏造しない。渡されていないデータには触れない
- 全部日本語
- 押し売り NG、自己アピール過多 NG`;
}

// ── ハンドラ ───────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'POST メソッドで呼び出してください' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  let body: {
    igProfile?: IgProfile;
    deal?: DealInput;
    customNote?: string;
    tone?: string;
    mediaKit?: MediaKitSummary;
    mentionMediaKit?: boolean;
    ngWords?: string[];
  };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'invalid_json', message: 'リクエスト本文が JSON ではありません' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  const profile = body.igProfile;
  const deal = body.deal;
  const ngWords = Array.isArray(body.ngWords) ? body.ngWords.filter(w => typeof w === 'string') : [];
  const mediaKit = body.mediaKit;
  const mentionMediaKit = !!body.mentionMediaKit && !!mediaKit;

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

  const explicitTone = body.tone ? normalizeTone(body.tone) : undefined;
  const tone: Tone = explicitTone || inferTone(profile, deal);

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

${mentionMediaKit && mediaKit ? `## MediaKit (本文に「私の特徴は◯◯」を 1 文挿入)
- フォロワー: ${mediaKit.followers ?? '未設定'}
- 主要層: ${mediaKit.audience ?? '未設定'}
- カテゴリ: ${mediaKit.category ?? '未設定'}
- エンゲージメント: ${mediaKit.engagement ?? '未設定'}` : ''}

## 指定トーン
${tone} (${TONE_PRESETS[tone].label})

このクリエイターになりきって、${deal.brandName} へ送る初回 DM を JSON で書いてください。`;

  const SYS = buildSystemPrompt(tone, ngWords, mentionMediaKit);

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
        max_tokens: 2400,
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
        if (parsed.draft && typeof parsed.draft.body === 'string' && parsed.draft.body.trim().length > 30) {
          const draft: Draft = {
            body: parsed.draft.body,
            tone: normalizeTone(parsed.draft.tone) || tone,
            callToAction: parsed.draft.callToAction || '案件の進め方・条件についてお伺いできますか?',
            subject: parsed.draft.subject,
          };
          const alternatives = Array.isArray(parsed.alternatives)
            ? parsed.alternatives
                .filter((a: any) => a && typeof a.body === 'string' && a.body.trim().length > 30)
                .slice(0, 2)
                .map((a: any) => ({ body: a.body, tone: normalizeTone(a.tone) || 'friendly' }))
            : [];
          if (alternatives.length < 2) {
            const fb = fallbackDraft(profile, deal, body.customNote, tone, mediaKit, mentionMediaKit, ngWords);
            for (const a of fb.alternatives) {
              if (alternatives.length >= 2) break;
              if (!alternatives.find(x => x.tone === a.tone)) alternatives.push(a);
            }
          }
          const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 3) : [];
          if (!deal.fee && !warnings.find((w: string) => /報酬|条件/.test(w))) {
            warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
          }
          const replyPredictions: ReplyPrediction[] = Array.isArray(parsed.replyPredictions)
            ? parsed.replyPredictions
                .filter((p: any) => p && typeof p.label === 'string' && typeof p.example === 'string')
                .slice(0, 3)
                .map((p: any) => ({ label: p.label, example: p.example }))
            : defaultReplyPredictions(deal);

          const ngHits = detectNgHits(draft.body, ngWords);

          const resp: DraftResponse = {
            ok: true,
            draft,
            alternatives,
            warnings: warnings.length > 0 ? warnings : undefined,
            ngHits: ngHits.length > 0 ? ngHits : undefined,
            replyPredictions: replyPredictions.length > 0 ? replyPredictions : undefined,
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

  return new Response(JSON.stringify(fallbackDraft(profile, deal, body.customNote, tone, mediaKit, mentionMediaKit, ngWords)), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...ch },
  });
}
