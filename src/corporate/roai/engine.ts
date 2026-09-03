// ============================================================
// CORE ROAI SCORE — 決定論スコアリング・経済価値シミュレーション・投資余力の逆算。
//
// 原則（MASTER PROMPT §30・§33）:
//   ・LLM は使わない。同じ回答なら必ず同じ数字（Deterministic / Auditable / Explainable）。
//   ・すべての数字に「入力・ベンチマーク・仮定・式」のどれから出たかの根拠（basis）を付ける。
//   ・重みと仮定は WEIGHTS / ASSUMPTIONS にまとめ、ここを変えるだけで調整できる。
//   ・数字を魅力的にするための捏造はしない。幅（low / high）で出す。
//
// この engine は UI と API（api/roai/lead.ts）の両方から呼ぶ。React に依存しない。
// ============================================================
import { RETURNS, RETURN_BY_KEY, type ReturnKey } from './model';
import {
  activeQuestions, findOption, QUESTION_BY_ID, INDUSTRY_LABEL,
  type Answers, type Industry, type Question,
} from './schema';

export const ENGINE_VERSION = '2026.09.03-1';

// ── 重み（コードから容易に変更できる場所） ─────────────────
export const WEIGHTS = {
  /** 5 つの Return の相対重み（優先順位の並べ替えとスコアの平均に使う） */
  category: { grow: 1.0, save: 1.1, accelerate: 0.9, protect: 0.85, create: 0.8 } as Record<ReturnKey, number>,
  /** CORE ROAI SCORE の合成比。合計 1.0。 */
  score: { opportunity: 0.5, magnitude: 0.2, readiness: 0.3 },
  /** 経済価値の年商比が何 % で「大きさ」満点にするか */
  magnitudeFullAtRevenueRatio: 0.12,
  /** 「先に整備」判定: readiness がこの値未満で機会が大きければ prepare モード */
  prepareReadinessBelow: 40,
  prepareOpportunityAbove: 55,
} as const;

// ── 仮定（ベンチマーク・単価。根拠に必ず表示する） ────────────
export const ASSUMPTIONS = {
  /** 1 時間あたりの人件費（賞与・社会保険を含む総額ベースのおおよその中央値） */
  hourlyCost: 3_500,
  weeksPerYear: 48,
  /** その作業のうち AI・自動化へ移せる割合（保守的に置く） */
  automation: { dataEntry: 0.5, documents: 0.35, email: 0.25, salesNonSelling: 0.4, proposal: 0.5 },
  /** 営業 1 人が月に作る提案・見積の本数 */
  proposalsPerSalesPerMonth: 4,
  /** 定型外注のうち置き換えられる割合 */
  outsourcingReplaceable: 0.3,
  /** 売上改善の上限（年商比）。各要因の上限を足し合わせた最大 */
  uplift: { response: 0.02, dormant: 0.015, crm: 0.01, nonSelling: 0.015, proposal: 0.005, industry: 0.01 },
  /** 売上改善の下限は上限の何割か */
  upliftLowRatio: 0.4,
  /** AI による損失回避の削減率（期待損失のうち減らせる割合） */
  lossReduction: 0.4,
  /** 目標 ROAI（経済価値 ÷ 投資） */
  targetRoai: 5,
  /** 投資余力の比較表に出す ROAI 倍率 */
  roaiTable: [3, 5, 8],
  /** 回答が無いときの既定値 */
  defaults: { employees: 12, revenue: 75_000_000, salesShare: 0.25, backofficeShare: 0.25 },
} as const;

// ── 型 ──────────────────────────────────────────────────
export interface Basis { kind: 'input' | 'benchmark' | 'assumption' | 'formula'; label: string; value: string }
export interface Range { low: number; mid: number; high: number; basis: Basis[] }

export type Potential = 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW';

export interface Priority {
  rank: number;
  key: ReturnKey;
  title: string;        // 例: Business Process Automation
  titleJa: string;
  potential: Potential;
  score: number;        // 0-100
  why: string;
}

export interface RoadmapPhase { range: string; en: string; ja: string; items: string[] }

export interface RoaiResult {
  version: string;
  complete: boolean;
  answered: number;
  total: number;
  industry: Industry | null;
  profile: { employees: number; revenue: number; salesShare: number; backofficeShare: number; basis: Basis[] };
  categoryScores: Record<ReturnKey, number>;
  readiness: number;
  score: number;
  scoreBreakdown: { opportunity: number; magnitude: number; readiness: number };
  priorities: Priority[];
  value: {
    hoursSaved: Range;
    productivity: Range;
    costReduction: Range;
    revenue: Range;
    lossAvoidance: Range;
    total: Range;
  };
  capacity: { targetRoai: number; indicative: number; table: { roai: number; investment: number }[]; basis: Basis[] };
  budget: { declared: number | null; gapNote: string | null };
  recommendation: { mode: 'build' | 'prepare' | 'focus'; headline: string; body: string };
  roadmap: RoadmapPhase[];
  summary: string[];
  /** CORE 内部だけで使う。画面には出さない。 */
  lead: { score: number; tier: 'HOT' | 'WARM' | 'NURTURE'; factors: string[] };
}

// ── ユーティリティ ──────────────────────────────────────
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number, d = 0) => { const m = 10 ** d; return Math.round(n * m) / m; };
/** 見せる金額は 3 桁有効数字程度に丸める（1 円単位の精度があるように見せない） */
export function roundMoney(n: number): number {
  if (n < 100_000) return Math.round(n / 10_000) * 10_000;
  if (n < 10_000_000) return Math.round(n / 100_000) * 100_000;
  if (n < 100_000_000) return Math.round(n / 1_000_000) * 1_000_000;
  return Math.round(n / 10_000_000) * 10_000_000;
}
export function formatYen(n: number): string {
  const v = roundMoney(n);
  if (v >= 100_000_000) return `¥${round(v / 100_000_000, v >= 1_000_000_000 ? 0 : 1).toLocaleString('ja-JP')}億`;
  if (v >= 10_000) return `¥${Math.round(v / 10_000).toLocaleString('ja-JP')}万`;
  return `¥${v.toLocaleString('ja-JP')}`;
}
export function formatRangeYen(r: { low: number; high: number }): string {
  if (r.high <= 0) return '—';
  if (roundMoney(r.low) === roundMoney(r.high)) return formatYen(r.high);
  return `${formatYen(r.low)}〜${formatYen(r.high)}`;
}
export function formatHours(n: number): string {
  return `${Math.round(n / 10) * 10 >= 1000 ? (Math.round(n / 100) * 100).toLocaleString('ja-JP') : (Math.round(n / 10) * 10).toLocaleString('ja-JP')}時間`;
}

function pick(answers: Answers, id: string) {
  const q = QUESTION_BY_ID[id];
  if (!q) return undefined;
  return findOption(q, answers[id]);
}
function num(answers: Answers, id: string, fallback: number): { v: number; b: Basis } {
  const o = pick(answers, id);
  if (o && typeof o.num === 'number') {
    return { v: o.num, b: { kind: 'input', label: QUESTION_BY_ID[id].text, value: o.label } };
  }
  return { v: fallback, b: { kind: 'assumption', label: QUESTION_BY_ID[id]?.text ?? id, value: `未回答のため既定値 ${fallback}` } };
}
function scoreOf(answers: Answers, id: string): number | null {
  const o = pick(answers, id);
  return o && typeof o.score === 'number' ? o.score : null;
}

// ── カテゴリスコア ──────────────────────────────────────
function categoryScore(qs: Question[], answers: Answers, key: ReturnKey): number {
  let sum = 0, w = 0;
  for (const q of qs) {
    if (q.category !== key) continue;
    const s = scoreOf(answers, q.id);
    if (s === null) continue;
    const wt = q.weight ?? 1;
    sum += s * wt; w += wt;
  }
  return w === 0 ? 0 : round(clamp01(sum / w) * 100);
}

function readinessScore(qs: Question[], answers: Answers): number {
  let sum = 0, w = 0;
  for (const q of qs) {
    const o = findOption(q, answers[q.id]);
    if (!o || typeof o.ready !== 'number') continue;
    const wt = q.weight ?? 1;
    sum += o.ready * wt; w += wt;
  }
  return w === 0 ? 0 : round(clamp01(sum / w) * 100);
}

// ── 優先順位のラベル ────────────────────────────────────
const PRIORITY_TITLE: Record<ReturnKey, { en: string; ja: string }> = {
  save: { en: 'Business Process Automation', ja: '定型業務の自動化' },
  grow: { en: 'Sales AI', ja: '営業・顧客対応の AI 化' },
  accelerate: { en: 'Knowledge & Decision AI', ja: '経営数字と社内知識の即答化' },
  protect: { en: 'AI Security & Risk Control', ja: 'ミス・漏洩・属人化の防止' },
  create: { en: 'AI Native New Business', ja: '自社データからの新サービス' },
};
export function potentialOf(score: number): Potential {
  if (score >= 75) return 'HIGH';
  if (score >= 60) return 'MEDIUM-HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

// ── メイン ──────────────────────────────────────────────
export function computeRoai(answers: Answers): RoaiResult {
  const qs = activeQuestions(answers);
  const answered = qs.filter(q => !!findOption(q, answers[q.id])).length;
  const totalQuestions = qs.length;
  const complete = answered === totalQuestions;
  const industry = (answers.industry as Industry) || null;

  // profile
  const emp = num(answers, 'employees', ASSUMPTIONS.defaults.employees);
  const rev = num(answers, 'revenue', ASSUMPTIONS.defaults.revenue);
  const salesShare = num(answers, 'sales_share', ASSUMPTIONS.defaults.salesShare);
  const boShare = num(answers, 'backoffice_share', ASSUMPTIONS.defaults.backofficeShare);
  const employees = emp.v;
  const salesPeople = Math.max(1, Math.round(employees * salesShare.v));
  const boPeople = Math.max(1, Math.round(employees * boShare.v));
  /** 文書・メールの削減対象は机で仕事をする人（営業＋事務）。現場・製造の人数は含めない。 */
  const deskPeople = Math.min(employees, salesPeople + boPeople);
  const A = ASSUMPTIONS;

  // category scores
  const categoryScores = Object.fromEntries(RETURNS.map(r => [r.key, categoryScore(qs, answers, r.key)])) as Record<ReturnKey, number>;
  const readiness = readinessScore(qs, answers);

  // ── SAVE: hours saved ──
  const de = num(answers, 'data_entry', 0);
  const doc = num(answers, 'documents', 0);
  const em = num(answers, 'email', 0);
  const nonSell = num(answers, 'sales_nonselling', 0);
  const prop = num(answers, 'proposal_hours', 0);
  const hDataEntry = de.v * boPeople * A.weeksPerYear * A.automation.dataEntry;
  const hDocs = doc.v * deskPeople * A.weeksPerYear * A.automation.documents;
  const hEmail = em.v * deskPeople * A.weeksPerYear * A.automation.email;
  const hNonSell = nonSell.v * 40 * salesPeople * A.weeksPerYear * A.automation.salesNonSelling;
  const hProposal = prop.v * A.proposalsPerSalesPerMonth * 12 * salesPeople * A.automation.proposal;
  const hoursMid = hDataEntry + hDocs + hEmail + hNonSell + hProposal;
  const hoursSaved: Range = {
    low: round(hoursMid * 0.6), mid: round(hoursMid), high: round(hoursMid * 1.15),
    basis: [
      de.b, doc.b, em.b, nonSell.b, prop.b, emp.b, salesShare.b, boShare.b,
      { kind: 'assumption', label: '自動化できる割合', value: `入力 ${A.automation.dataEntry * 100}% / 文書 ${A.automation.documents * 100}% / メール ${A.automation.email * 100}% / 営業の非商談 ${A.automation.salesNonSelling * 100}% / 提案 ${A.automation.proposal * 100}%` },
      { kind: 'assumption', label: '年間の稼働週', value: `${A.weeksPerYear} 週` },
      { kind: 'formula', label: '文書・メールの対象人数', value: `営業 ${salesPeople} 人 ＋ 事務 ${boPeople} 人 ＝ ${deskPeople} 人（全 ${employees} 人のうち）` },
      { kind: 'assumption', label: '営業 1 人の提案本数', value: `月 ${A.proposalsPerSalesPerMonth} 本` },
      { kind: 'formula', label: '式', value: '（週あたり時間 × 対象人数 × 稼働週 × 自動化割合）の合計。幅は ×0.6〜×1.15' },
    ],
  };
  const productivity: Range = {
    low: hoursSaved.low * A.hourlyCost, mid: hoursSaved.mid * A.hourlyCost, high: hoursSaved.high * A.hourlyCost,
    basis: [
      { kind: 'formula', label: '式', value: '削減時間 × 1 時間あたり人件費' },
      { kind: 'assumption', label: '1 時間あたり人件費', value: `¥${A.hourlyCost.toLocaleString('ja-JP')}（賞与・社会保険込みの概算中央値）` },
    ],
  };

  // ── SAVE: cost reduction (外注) ──
  const out = num(answers, 'outsourcing', 0);
  const costMid = out.v * A.outsourcingReplaceable;
  const costReduction: Range = {
    low: costMid * 0.5, mid: costMid, high: costMid * 1.5,
    basis: [out.b, { kind: 'assumption', label: '置き換えられる割合', value: `${A.outsourcingReplaceable * 100}%` }, { kind: 'formula', label: '式', value: '年間外注費 × 置き換え割合。幅は ×0.5〜×1.5' }],
  };

  // ── GROW: revenue opportunity ──
  const upliftParts: { label: string; v: number }[] = [
    { label: '初回返答の速さ', v: (scoreOf(answers, 'response_time') ?? 0) * A.uplift.response },
    { label: '休眠顧客の再提案', v: (scoreOf(answers, 'dormant') ?? 0) * A.uplift.dormant },
    { label: '顧客データの活用', v: (scoreOf(answers, 'crm') ?? 0) * A.uplift.crm },
    { label: '営業の商談時間の回復', v: (scoreOf(answers, 'sales_nonselling') ?? 0) * A.uplift.nonSelling },
    { label: '提案の速さ', v: (scoreOf(answers, 'proposal_hours') ?? 0) * A.uplift.proposal },
    { label: '業界固有の反響対応', v: (scoreOf(answers, 'ind_re_response') ?? 0) * A.uplift.industry },
  ];
  const upliftHigh = upliftParts.reduce((s, p) => s + p.v, 0);
  const revenue: Range = {
    low: rev.v * upliftHigh * A.upliftLowRatio, mid: rev.v * upliftHigh * ((1 + A.upliftLowRatio) / 2), high: rev.v * upliftHigh,
    basis: [
      rev.b,
      { kind: 'benchmark', label: '売上改善率の上限（要因別）', value: upliftParts.filter(p => p.v > 0).map(p => `${p.label} ${round(p.v * 100, 2)}%`).join(' / ') || 'なし' },
      { kind: 'formula', label: '式', value: `年商 × 改善率（合計 ${round(upliftHigh * 100, 2)}%）。下限は上限の ${A.upliftLowRatio * 100}%` },
    ],
  };

  // ── PROTECT: loss avoidance ──
  const impact = num(answers, 'loss_impact', 0);
  const prob = num(answers, 'security_posture', 0);
  const expectedLoss = impact.v * prob.v;
  const lossMid = expectedLoss * A.lossReduction;
  const lossAvoidance: Range = {
    low: lossMid * 0.5, mid: lossMid, high: lossMid * 1.25,
    basis: [
      impact.b, prob.b,
      { kind: 'benchmark', label: '年間の発生確率（対策段階別）', value: '点検・監査あり 3% / 基本対策のみ 8% / 担当者まかせ 15%' },
      { kind: 'assumption', label: 'AI で減らせる割合', value: `${A.lossReduction * 100}%` },
      { kind: 'formula', label: '式', value: '想定損失 × 発生確率 × 削減割合（期待損失ベース）' },
    ],
  };

  const total: Range = {
    low: productivity.low + costReduction.low + revenue.low + lossAvoidance.low,
    mid: productivity.mid + costReduction.mid + revenue.mid + lossAvoidance.mid,
    high: productivity.high + costReduction.high + revenue.high + lossAvoidance.high,
    basis: [{ kind: 'formula', label: '式', value: '生産性価値 ＋ コスト削減 ＋ 売上機会 ＋ 損失回避' }],
  };

  // ── CORE ROAI SCORE ──
  const wSum = RETURNS.reduce((s, r) => s + WEIGHTS.category[r.key], 0);
  const opportunity = round(RETURNS.reduce((s, r) => s + categoryScores[r.key] * WEIGHTS.category[r.key], 0) / wSum);
  const magnitude = round(clamp01((total.mid / Math.max(1, rev.v)) / WEIGHTS.magnitudeFullAtRevenueRatio) * 100);
  const score = round(opportunity * WEIGHTS.score.opportunity + magnitude * WEIGHTS.score.magnitude + readiness * WEIGHTS.score.readiness);

  // ── priorities ──
  const priorities: Priority[] = RETURNS
    .map(r => ({ key: r.key, s: categoryScores[r.key], w: categoryScores[r.key] * WEIGHTS.category[r.key] }))
    .sort((a, b) => b.w - a.w)
    .map((p, i) => ({
      rank: i + 1, key: p.key, title: PRIORITY_TITLE[p.key].en, titleJa: PRIORITY_TITLE[p.key].ja,
      potential: potentialOf(p.s), score: p.s,
      why: RETURN_BY_KEY[p.key].lead,
    }));

  // ── recommendation ──
  const top = priorities[0];
  let recommendation: RoaiResult['recommendation'];
  if (readiness < WEIGHTS.prepareReadinessBelow && opportunity >= WEIGHTS.prepareOpportunityAbove) {
    recommendation = {
      mode: 'prepare',
      headline: 'AI 開発より先に、データ整備と業務標準化を。',
      body: `改善余地は大きい一方、データの所在や手順の標準化が整っていません。この状態で AI を作ると使われません。最初の 30 日でデータの置き場と手順を整え、その上で「${top.titleJa}」から着手するのが最短です。`,
    };
  } else if (top.potential === 'HIGH' || top.potential === 'MEDIUM-HIGH') {
    recommendation = {
      mode: 'build',
      headline: `最初の投資先は「${top.titleJa}」。`,
      body: `${RETURN_BY_KEY[top.key].lead} ここが最も Return が大きく、実装できる状態も整っています。90 日で PoC → 導入 → 計測まで進められます。`,
    };
  } else {
    recommendation = {
      mode: 'focus',
      headline: '大きな投資より、小さく作って測る。',
      body: '突出した機会は見当たりませんが、時間の回復と速度の改善は積み上がります。1 つの業務を選び、Before / After を測るところから始めるのが安全です。',
    };
  }

  // ── roadmap ──
  const second = priorities[1];
  const roadmap: RoadmapPhase[] = [
    {
      range: 'DAY 0–30', en: 'UNDERSTAND', ja: '理解する・決める',
      items: recommendation.mode === 'prepare'
        ? ['業務と数字の棚卸し（どこで時間と機会が失われているか）', 'データの置き場を 1 か所に決める（Excel・紙の脱却）', `「${top.titleJa}」の手順書化とベースライン計測`, '目標 KPI と目標 ROAI の合意']
        : ['業務と数字の棚卸し・ベースライン計測', `「${top.titleJa}」の対象業務を 1 つに絞る`, 'データ・システム接続の確認', '目標 KPI と目標 ROAI の合意'],
    },
    {
      range: 'DAY 31–60', en: 'BUILD', ja: '作る',
      items: [`「${top.titleJa}」の PoC（最小構成）`, '人と AI の役割分担の設計', 'セキュリティ・権限・ログの設計', second ? `次の候補「${second.titleJa}」の要件整理` : '運用ルールの整備'],
    },
    {
      range: 'DAY 61–90', en: 'DEPLOY & MEASURE', ja: '導入して測る',
      items: ['現場への導入と教育', '同じ KPI で After を計測', '実測 ROAI の算定（経済価値 ÷ 投資）', '拡大するか・止めるかの判断'],
    },
  ];

  // ── investment capacity ──
  const indicative = total.mid / A.targetRoai;
  const capacity = {
    targetRoai: A.targetRoai,
    indicative,
    table: A.roaiTable.map(r => ({ roai: r, investment: total.mid / r })),
    basis: [
      { kind: 'formula' as const, label: '式', value: '年間の潜在経済価値（中央値）÷ 目標 ROAI' },
      { kind: 'assumption' as const, label: '目標 ROAI', value: `${A.targetRoai}.0x（投資 1 に対して経済価値 ${A.targetRoai}）` },
    ],
  };
  const budgetOpt = pick(answers, 'budget');
  const declared = budgetOpt && typeof budgetOpt.num === 'number' ? budgetOpt.num : null;
  let gapNote: string | null = null;
  if (declared !== null && total.mid > 0) {
    if (declared < indicative * 0.5) gapNote = `想定されている投資額は、Return から逆算した投資余力（${formatYen(indicative)}）より小さめです。まず小さく始めて実測し、投資を段階的に広げる進め方が合います。`;
    else if (declared > indicative * 2) gapNote = `想定されている投資額は、目標 ROAI ${A.targetRoai}.0x で見た投資余力（${formatYen(indicative)}）を上回ります。投資の前に、経済価値の見立てを実数で確かめることをおすすめします。`;
    else gapNote = `想定されている投資額は、Return から逆算した投資余力（${formatYen(indicative)}）と釣り合っています。`;
  }

  // ── executive summary ──
  const indLabel = industry ? INDUSTRY_LABEL[industry] : '業種未回答';
  const summary = [
    `${indLabel}・${pick(answers, 'employees')?.label ?? '規模未回答'}の御社の CORE ROAI SCORE は ${score} / 100。AI Readiness は ${readiness} / 100。`,
    `最も大きな機会は「${top.titleJa}」（${top.score}）。次いで「${second?.titleJa ?? '—'}」（${second?.score ?? '—'}）。`,
    total.mid > 0
      ? `年間の潜在的な経済価値は概算で ${formatRangeYen(total)}。うち時間の回復は年 ${formatHours(hoursSaved.mid)}（${formatYen(productivity.mid)} 相当）。`
      : '経済価値を算定するための回答がまだ揃っていません。',
    recommendation.headline,
    total.mid > 0 ? `目標 ROAI ${A.targetRoai}.0x で逆算すると、投資余力の目安は ${formatYen(indicative)}。` : '',
  ].filter(Boolean);

  // ── lead score (internal) ──
  const factors: string[] = [];
  let ls = 0;
  if (total.mid >= 30_000_000) { ls += 30; factors.push('経済価値 3,000万円以上'); }
  else if (total.mid >= 10_000_000) { ls += 20; factors.push('経済価値 1,000万円以上'); }
  else if (total.mid >= 3_000_000) { ls += 10; factors.push('経済価値 300万円以上'); }
  if (employees >= 21) { ls += 15; factors.push('従業員 21 人以上'); }
  const bv = answers.budget;
  if (bv === 'bg3' || bv === 'bg4') { ls += 25; factors.push('予算 500万円以上'); }
  else if (bv === 'bg2') { ls += 15; factors.push('予算 100万円以上'); }
  const cm = answers.commitment;
  if (cm === 'cm1') { ls += 20; factors.push('今期予算を決めて進めたい'); }
  else if (cm === 'cm2') { ls += 10; factors.push('効果が見えれば投資'); }
  if (readiness >= 50) { ls += 10; factors.push('Readiness 50 以上'); }
  const tier: RoaiResult['lead']['tier'] = ls >= 60 ? 'HOT' : ls >= 35 ? 'WARM' : 'NURTURE';

  return {
    version: ENGINE_VERSION,
    complete, answered, total: totalQuestions, industry,
    profile: { employees, revenue: rev.v, salesShare: salesShare.v, backofficeShare: boShare.v, basis: [emp.b, rev.b, salesShare.b, boShare.b] },
    categoryScores, readiness, score,
    scoreBreakdown: { opportunity, magnitude, readiness },
    priorities,
    value: { hoursSaved, productivity, costReduction, revenue, lossAvoidance, total },
    capacity,
    budget: { declared, gapNote },
    recommendation, roadmap, summary,
    lead: { score: ls, tier, factors },
  };
}

/** 回答オブジェクトを安全に正規化（API で受けるとき用）。未知の id・未知の値は捨てる。 */
export function sanitizeAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const q = QUESTION_BY_ID[k];
    if (!q || typeof v !== 'string') continue;
    if (q.options.some(o => o.value === v)) out[k] = v;
  }
  return out;
}
