// ============================================================
// 商談 AI — 「先回り型」マッチング
// ------------------------------------------------------------
// ユーザーは何も入力しない。AI が静的 DB から「合いそうな 5 社」を
// 自分で選び、なぜ合うか/最初のメール文面まで一気に生成する。
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';
import { COMPANIES_JP, sampleCompanies, todaySeed, type CompanyEntry } from '../data/companies-jp';

export interface AiPick {
  /** 静的 DB の company.id */
  companyId: string;
  /** 表示用 */
  companyName: string;
  industry: string;
  size: 'large' | 'mid' | 'startup';
  region: string;
  /** AI が判定したマッチ度 0-100 */
  matchScore: number;
  /** なぜこの企業を選んだか (1〜2 文) */
  reason: string;
  /** 提案文ドラフト (件名 + 本文) */
  emailSubject: string;
  emailBody: string;
}

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

/**
 * 候補プールを生成。
 * - 自社商材から業界を推測して優先
 * - 残りはランダムサンプリング (日替わり)
 */
function buildCandidatePool(ownProduct: string, max: number = 60): CompanyEntry[] {
  const text = (ownProduct || '').toLowerCase();
  const industryHints: { keys: string[]; industries: string[] }[] = [
    { keys: ['飲食', '飲食店', 'レストラン', '居酒屋', '食堂', 'カフェ', 'バー'], industries: ['飲食', '食品', '飲料', '食品・酒類', 'コンビニ', '小売'] },
    { keys: ['it', 'saas', 'クラウド', 'ai', '生成ai', 'llm', 'システム', 'web', 'アプリ'], industries: ['IT・電機', 'SIer', 'SaaS', 'ネット', 'AI', 'Fintech', 'HR Tech', '広告', 'EC'] },
    { keys: ['人事', '採用', 'hr', 'タレント', '労務'], industries: ['HR Tech', '人材', 'SaaS', 'EdTech'] },
    { keys: ['会計', '経理', '財務', '請求', '経費'], industries: ['Fintech', 'SaaS', 'IT・会計'] },
    { keys: ['不動産', '住宅', 'マンション', '賃貸', '建築', '建設'], industries: ['不動産', '住宅・建設', 'ゼネコン', '建設 SaaS', '住宅', '建設'] },
    { keys: ['医療', '病院', 'クリニック', 'ヘルスケア', '介護', '薬局'], industries: ['医療機器', '製薬', '介護', '医療プラットフォーム', '医療データ', 'HealthTech', 'ドラッグストア'] },
    { keys: ['物流', '配送', '運送', '倉庫', 'サプライチェーン'], industries: ['物流', '物流 SaaS', '海運', '航空'] },
    { keys: ['ec', '通販', 'ネットショップ', 'マーケットプレイス'], industries: ['EC', 'ネット', '越境EC'] },
    { keys: ['広告', 'マーケ', 'マーケティング', 'sns', 'インスタ', 'tiktok'], industries: ['広告', 'マーケティング', '広告・ゲーム', 'AI コンテンツ', 'AI クリエイティブ'] },
    { keys: ['教育', '学習', '塾', '研修'], industries: ['教育', 'EdTech'] },
    { keys: ['美容', 'コスメ', '化粧品', 'スキンケア'], industries: ['化粧品', '日用品・化粧品', '医薬・化粧品'] },
    { keys: ['アパレル', 'ファッション', '服', 'ec ファッション'], industries: ['アパレル'] },
    { keys: ['製造', '工場', 'fa', '生産管理'], industries: ['FA', '製造業', 'BtoB EC', '製造業 SaaS', '工作機械', '電子部品'] },
    { keys: ['金融', '銀行', '証券', '保険'], industries: ['銀行', '証券', '生命保険', '損害保険', '地銀', '金融'] },
    { keys: ['観光', 'ホテル', '旅行', 'インバウンド'], industries: ['ホテル', '旅行', 'レジャー予約'] },
  ];

  const priorityIndustries = new Set<string>();
  for (const h of industryHints) {
    if (h.keys.some(k => text.includes(k))) {
      h.industries.forEach(i => priorityIndustries.add(i));
    }
  }

  const seed = todaySeed();
  const priority = COMPANIES_JP.filter(c => priorityIndustries.has(c.industry));
  const rest = COMPANIES_JP.filter(c => !priorityIndustries.has(c.industry));
  // 優先群を最大 30、残りを最大 30 ランダム抽出 (重複なし、合計 max)
  const shuffledPriority = sampleCompanies(priority.length, seed).filter(c => priority.includes(c)).slice(0, 30);
  const shuffledRest = sampleCompanies(rest.length, seed + 1).filter(c => rest.includes(c)).slice(0, max - shuffledPriority.length);
  return [...shuffledPriority, ...shuffledRest].slice(0, max);
}

/**
 * Haiku に候補を投げて 5 社をピック + 提案文生成。
 * 提案文は持っているテンプレ感を避け、相手企業の状況に踏み込んだ書き方を指示。
 */
export async function pickTodaysCompanies(opts: {
  settings: AppSettings;
  persona: Persona;
  ownProduct: string;
  excludeIds?: string[];
}): Promise<AiPick[]> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude API キーが未設定です。設定タブから登録してください。');
  if (!opts.ownProduct?.trim()) {
    throw new Error('まず「自社の商材」を登録してください。AI はその情報をもとに合う企業を選びます。');
  }

  const exclude = new Set(opts.excludeIds || []);
  const pool = buildCandidatePool(opts.ownProduct).filter(c => !exclude.has(c.id));

  const sys = `あなたは「先回り型 営業エージェント」です。
日本企業の静的データベース (候補プール) を受け取り、その中から
「自社商材と最も相性が良い 5 社」を自分で選び、それぞれに対し
- 選んだ理由 (1〜2 文)
- 開封されやすい件名 (30 文字以内)
- 本文 (4〜7 行)
を作成します。

返答は **JSONのみ** (コードブロック・前後の説明文なし):
{
  "picks": [
    {
      "companyId": "DB の id をそのまま",
      "matchScore": 0-100 の数値,
      "reason": "なぜこの企業を選んだか 1〜2 文",
      "emailSubject": "件名",
      "emailBody": "本文 (4〜7 行)"
    }
  ]
}

${toneInstruction(opts.settings.aiTone)}

## 絶対ルール
- companyId は候補プールに存在する id をそのまま使う (新しく作らない)。
- 5 社きっかり。多くても少なくてもダメ。
- メール本文は「相手企業の最近の動き (newsHint)」に必ず触れる。
- いきなり売り込まない。共感 → 仮説 → 提案 → 次の一歩、の流れ。
- テンプレ感のある言葉 (「貴社のご発展」「ご清祥」等) を避ける。
- 提案は 1 つだけ。3 つ並べない。
- 次のアクションは具体的に (例: "20 分のオンライン面談")。`;

  const userMsg = `## 自社の商材
${opts.ownProduct}

## 営業担当 (送り主)
${opts.persona.name} (${opts.persona.subtitle || ''})
${opts.persona.description || ''}

## 候補プール (${pool.length} 社)
${pool.map(c => `- id: ${c.id} / 社名: ${c.name} / 業界: ${c.industry} / 規模: ${c.size} / 所在: ${c.region} / 動き: ${c.newsHint}`).join('\n')}

上記から最も相性が良い 5 社を選び、JSON で返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 4000,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `先回りマッチ AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    throw new Error('AI が返した JSON を解釈できませんでした。もう一度試してください。');
  }

  const rawPicks: any[] = Array.isArray(parsed.picks) ? parsed.picks : [];
  const lookup = new Map(COMPANIES_JP.map(c => [c.id, c]));

  const picks: AiPick[] = rawPicks
    .map((p: any): AiPick | null => {
      const c = lookup.get(String(p.companyId || ''));
      if (!c) return null;
      return {
        companyId: c.id,
        companyName: c.name,
        industry: c.industry,
        size: c.size,
        region: c.region,
        matchScore: Math.max(0, Math.min(100, Number(p.matchScore) || 60)),
        reason: String(p.reason || '').trim(),
        emailSubject: String(p.emailSubject || '').trim(),
        emailBody: String(p.emailBody || '').trim(),
      };
    })
    .filter((p): p is AiPick => Boolean(p && p.emailBody))
    .slice(0, 5);

  if (picks.length === 0) {
    throw new Error('AI が候補を選べませんでした。自社商材の説明を増やしてもう一度試してください。');
  }
  return picks;
}
