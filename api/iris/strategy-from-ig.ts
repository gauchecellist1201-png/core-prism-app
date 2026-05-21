// ============================================================
// POST /api/iris/strategy-from-ig
//
// IG 実プロフィール (オーディエンス・投稿パフォーマンス・最適時間) を渡し、
// AI が「次の打ち手 3 案」を返す。Iris ホーム / 戦略カードで使う。
//
// Body:
//   { profile: IgProfile, persona?: string, focus?: '案件獲得' | '伸ばす' | '深く繋がる' }
//
// Response:
//   {
//     strategies: [
//       { title, why, action, kpi, dueDays },
//     ],
//     audienceInsight: "オーディエンス分析の 2 行サマリ",
//     contentTheme: "次に投稿すべきテーマ 1 行",
//     bestSlot: "土 21:00",
//     matchedCategories: ["コスメ / スキンケア", ...],
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

interface IgProfile {
  handle: string;
  followers: number;
  avgLikes: number;
  avgComments: number;
  saveRate: number;
  storyViewRate: number;
  bestPostTime: string;
  audienceAge: { range: string; pct: number }[];
  audienceGender: { female: number; male: number; other: number };
  audienceTopCountries: { country: string; pct: number }[];
  topPostCategories?: string[];
  reelRatio?: number;
  imageRatio?: number;
  mediaCount?: number;
  source?: string;
}

interface StrategyItem {
  title: string;
  why: string;       // なぜこの戦略か (実データ根拠)
  action: string;    // 次の 1 アクション (具体的)
  kpi: string;       // 効果指標
  dueDays: number;   // 何日以内に
}

interface StrategyResponse {
  strategies: StrategyItem[];
  audienceInsight: string;
  contentTheme: string;
  bestSlot: string;
  matchedCategories: string[];
}

const SYS = `あなたは Instagram グロースとブランド案件マッチの戦略家です。
クリエイターの Instagram 実データ (フォロワー・オーディエンス分布・投稿パフォーマンス・最適時間) を渡されます。
そのデータだけを根拠に、月内に実行できる「次の打ち手 3 つ」と、案件カテゴリのマッチ予測を返してください。

返答は JSON のみ:
{
  "strategies": [
    {
      "title": "短い見出し (15 字以内)",
      "why": "なぜこの戦略か (実データに必ず触れる、2 文以内)",
      "action": "具体的な次の 1 アクション (1 文、すぐ実行できる粒度)",
      "kpi": "達成可否を測る数字 (例: '保存率 +1.5pt', 'フォロワー +200')",
      "dueDays": 期限 (7 / 14 / 30 のいずれか)
    } // 3 件
  ],
  "audienceInsight": "オーディエンスの特徴 (2 文以内、年齢/性別/国の主観的解釈)",
  "contentTheme": "次に投稿すべきテーマ (1 文)",
  "bestSlot": "投稿に最適な曜日と時刻 (例: '土 21:00')",
  "matchedCategories": ["合いそうな案件カテゴリ", ...] // 3-5 件
}

ルール:
- 戦略は具体的・実行可能。「投稿頻度を上げる」のような汎用 NG。「コスメ系リール 週 2 本、最適時間に投稿」のように具体的。
- 実データに数字で触れる (フォロワー 12,300、女性 64%、保存率 3.2% 等)。
- 案件カテゴリは「コスメ / スキンケア」「ファッション」「グルメ」など、IG 標準カテゴリ名。
- 全部日本語、簡潔に。
- **【重要】データが渡されなかった項目 (audienceAge が空、avgLikes が 0 等) は絶対に数字を捏造しない**。
  代わりに「Instagram Business 連携で取得可能」「インサイト画面のスクショで取得可能」と正直に書く。
- audienceInsight も同様: 取れていない値の所は推測せず、取れている値だけで構成する。
  例: 取得済みなのが「フォロワー 8,000」だけなら → "8,000 フォロワーのナノ インフルエンサー層。詳細なオーディエンス分析は Instagram Business 連携で取得できます" のように書く。`;

function fallbackStrategies(profile: IgProfile): StrategyResponse {
  // 実データの有無を判定 — 取れていないものは「推測」と明示し、捏造しない
  const hasAudienceData = profile.audienceAge.length > 0 && profile.audienceGender.female + profile.audienceGender.male > 0;
  const hasEngagementData = profile.saveRate > 0 && profile.avgLikes > 0;
  const hasBestTime = profile.bestPostTime && profile.bestPostTime !== '土 21:00'; // デフォルト値以外
  const tier = profile.followers > 50000 ? 'マクロ' : profile.followers > 10000 ? 'ミドル' : 'ナノ';

  // 戦略 1: 投稿頻度 (必ず出せる、実データ依存最少)
  const strat1 = {
    title: '次の 1 週間、投稿頻度 1.5 倍に',
    why: `フォロワー ${profile.followers.toLocaleString()} 規模なら、週 4-5 投稿が伸びる目安。投稿数のリズムを上げると露出が増える`,
    action: '次の 7 日間、リール 3 本 + ストーリー 5 本を意識的に投稿',
    kpi: `フォロワー +${Math.round(profile.followers * 0.01)} (目安: 1%/週)`,
    dueDays: 7,
  };

  // 戦略 2: 保存される投稿 (実データあれば数値根拠付き、無ければ汎用)
  const strat2 = hasEngagementData ? {
    title: '保存される投稿を増やす',
    why: `平均いいね ${profile.avgLikes}、保存率 ${profile.saveRate}%。保存率を伸ばすとアルゴリズムに評価される`,
    action: '次の投稿はチェックリスト / 比較表 / ステップ図のいずれかの形式にする',
    kpi: '保存率 +0.8pt',
    dueDays: 14,
  } : {
    title: 'あとで見返したくなる投稿に',
    why: 'エンゲージメント詳細を取れる Instagram Business 連携が未完了。汎用戦略を提案中',
    action: '次の投稿は「3 ステップで分かる」「比較表」「失敗例 → 改善例」のいずれかにする',
    kpi: '保存数 + コメント数の合計 +20%',
    dueDays: 14,
  };

  // 戦略 3: 案件マッチ (オーディエンスデータが無い時は捏造せず正直に書く)
  const strat3 = hasAudienceData ? (() => {
    const topAge = profile.audienceAge[0]!.range;
    const gender = profile.audienceGender.female > 50 ? '女性' : profile.audienceGender.male > 50 ? '男性' : '混合層';
    return {
      title: `${topAge} ${gender}向け案件を狙う`,
      why: `あなたのフォロワーは ${topAge} ${gender} (${profile.audienceGender.female}% 女性) が中心。この層のブランドが最も刺さる`,
      action: '案件マッチ画面で、該当カテゴリ案件を 3 件確認 → Iris の AI 交渉文で初回 DM 送信',
      kpi: '案件提案 1 件着地',
      dueDays: 30,
    };
  })() : {
    title: 'まず案件マッチの精度を上げる',
    why: 'オーディエンスの年齢・性別データが未取得。これがあれば「あなたの層に刺さる案件」を AI が厳選できる',
    action: 'Instagram プロフェッショナル ダッシュボード → インサイト 画面のスクショを Iris にもう 1 枚アップロード',
    kpi: '案件マッチ精度を実データ駆動に',
    dueDays: 7,
  };

  // データソースを正直に表記
  const sourceTags: string[] = [];
  if (!hasAudienceData) sourceTags.push('オーディエンス分析は未取得');
  if (!hasEngagementData) sourceTags.push('エンゲージメント詳細は未取得');
  if (!hasBestTime) sourceTags.push('最適投稿時間は推定値');

  const audienceInsight = hasAudienceData
    ? `${profile.audienceAge[0]!.range} の ${profile.audienceGender.female > 50 ? '女性' : '男性'} 中心、保存率 ${profile.saveRate}%。${tier} インフルエンサー層 (${profile.followers.toLocaleString()} フォロワー)`
    : `${tier} インフルエンサー層 (${profile.followers.toLocaleString()} フォロワー)。${sourceTags.length > 0 ? `※ ${sourceTags.join(' / ')}` : ''}`;

  return {
    strategies: [strat1, strat2, strat3],
    audienceInsight,
    contentTheme: hasEngagementData && profile.saveRate > 4
      ? '保存される "あとで見返したい" 系のリール (チェックリスト / ステップ図)'
      : 'フォロワーの悩み起点で「失敗→学び→今こうしてる」の 3 段リール',
    bestSlot: hasBestTime ? profile.bestPostTime : '実データ未取得 (Instagram Business 連携で取得可能)',
    matchedCategories: matchCategoriesByAudience(profile, hasAudienceData),
  };
}

function matchCategoriesByAudience(profile: IgProfile, hasAudienceData = true): string[] {
  // オーディエンス実データが無いときは「あなたのカテゴリから推定」を返す (年齢/性別を捏造しない)
  if (!hasAudienceData) {
    const cats = new Set<string>(['ライフスタイル', '日用品 / 雑貨', 'グルメ / フード']);
    // プロフィール カテゴリヒント (もしあれば)
    const hint = (profile.topPostCategories || []).join(' ').toLowerCase();
    if (/音楽|music|楽器|チェロ|cello/.test(hint)) {
      cats.clear();
      cats.add('音楽 / 楽器');
      cats.add('教育 / レッスン');
      cats.add('アート / カルチャー');
      cats.add('クラシック / コンサート');
    } else if (/美容|cosme|beauty|スキン/.test(hint)) {
      cats.clear();
      cats.add('コスメ / スキンケア');
      cats.add('美容 / 旅 / ライフスタイル');
    } else if (/教育|education|スクール|school/.test(hint)) {
      cats.clear();
      cats.add('教育 / レッスン');
      cats.add('習い事 / 教室');
      cats.add('書籍 / 教材');
    }
    if (profile.followers >= 30000) cats.add('ブランド アンバサダー');
    return Array.from(cats).slice(0, 5);
  }

  const cats = new Set<string>();
  const femalePct = profile.audienceGender.female || 0;
  const malePct = profile.audienceGender.male || 0;
  const topAge = profile.audienceAge[0]?.range || '';

  if (femalePct >= 55) {
    cats.add('コスメ / スキンケア');
    cats.add('ファッション / アパレル');
    if (topAge.includes('18') || topAge.includes('25-34')) cats.add('美容 / 旅 / ライフスタイル');
  }
  if (malePct >= 55) {
    cats.add('ガジェット / IT');
    cats.add('健康 / フィットネス');
    cats.add('ビジネス / 投資');
  }
  if (topAge.includes('18') || topAge.includes('25-34')) cats.add('グルメ / フード');
  if (topAge.includes('35') || topAge.includes('45')) {
    cats.add('住宅 / インテリア');
    cats.add('教育 / 子育て');
  }
  if (profile.followers >= 30000) cats.add('ブランド アンバサダー');
  if (cats.size < 3) {
    cats.add('ライフスタイル');
    cats.add('日用品 / 雑貨');
  }
  return Array.from(cats).slice(0, 5);
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  let body: { profile?: IgProfile; persona?: string; focus?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }
  const profile = body.profile;
  if (!profile || !profile.handle) {
    return new Response(JSON.stringify({
      error: 'no_profile',
      message: 'Instagram プロフィールを先に連携してください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  const userPrompt = `## あなたの Instagram 実データ

ユーザー名: @${profile.handle}
フォロワー数: ${profile.followers.toLocaleString()}
平均いいね: ${profile.avgLikes} / 平均コメント: ${profile.avgComments}
保存率: ${profile.saveRate}% / ストーリー閲覧率: ${profile.storyViewRate}%
最適投稿時間: ${profile.bestPostTime}
リール vs 写真: リール ${profile.reelRatio ?? '?'}% / 写真 ${profile.imageRatio ?? '?'}%
投稿総数: ${profile.mediaCount ?? '?'}

オーディエンス年齢:
${profile.audienceAge.map(a => `  ${a.range}: ${a.pct}%`).join('\n') || '  (取得できず)'}

オーディエンス性別:
  女性 ${profile.audienceGender.female}% / 男性 ${profile.audienceGender.male}% / その他 ${profile.audienceGender.other}%

国 Top3:
${profile.audienceTopCountries.slice(0, 3).map(c => `  ${c.country}: ${c.pct}%`).join('\n') || '  (取得できず)'}

主なフォーカス: ${body.focus || '案件獲得 + フォロワー成長'}

上記の実データだけを根拠に、次の打ち手 3 つと案件マッチを JSON で返してください。`;

  // /api/ai を経由 (Gemini→Claude フォールバック付き)
  const aiUrl = new URL('/api/ai', req.url);
  try {
    const r = await fetch(aiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': req.headers.get('x-master-key') || '',
        'x-claude-api-key': req.headers.get('x-claude-api-key') || '',
        'x-ai-weight': 'heavy', // 戦略思考 → Claude 優先
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1800,
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
        if (Array.isArray(parsed.strategies) && parsed.strategies.length > 0) {
          parsed.bestSlot = parsed.bestSlot || profile.bestPostTime;
          parsed.matchedCategories = parsed.matchedCategories || matchCategoriesByAudience(profile);
          return new Response(JSON.stringify(parsed), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300', ...ch },
          });
        }
      } catch { /* fallthrough to fallback */ }
    }
  } catch { /* network error → fallback */ }

  // AI 失敗時のフォールバック (実データから機械的に算出、ユーザー体験は維持)
  return new Response(JSON.stringify({
    ...fallbackStrategies(profile),
    _meta: { source: 'fallback', reason: 'ai_unavailable' },
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...ch } });
}
