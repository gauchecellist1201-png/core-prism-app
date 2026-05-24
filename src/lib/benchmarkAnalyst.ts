// ============================================================
// 業界ベンチマーク分析 — Claude + 静的ベンチマークデータ + 自前業界 + 履歴 + 競合 + Markdown
// ============================================================
import { INDUSTRY_BENCHMARKS, INDUSTRIES, type IndustryId, type BenchmarkEntry } from './benchmarkData';
import { enqueueClaudeCall } from './apiQueue';
import type { AppSettings } from '../types/identity';

export interface UserMetrics {
  [key: string]: number;
}

// ── 自前業界カタログ ─────────────────────────────────────
export interface CustomIndustryDef {
  id: string;
  label: string;
  emoji: string;
  entries: BenchmarkEntry[];
  createdAt: string;
}

const CUSTOM_INDUSTRY_KEY = 'core_benchmark_custom_industries_v1';

export function loadCustomIndustries(): CustomIndustryDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_INDUSTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomIndustryDef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveCustomIndustries(list: CustomIndustryDef[]) {
  try { localStorage.setItem(CUSTOM_INDUSTRY_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

export function addCustomIndustry(def: Omit<CustomIndustryDef, 'id' | 'createdAt'>): CustomIndustryDef {
  const id = 'custom_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  const created: CustomIndustryDef = {
    ...def,
    id,
    createdAt: new Date().toISOString(),
    entries: def.entries.map(e => ({ ...e, industry: id })),
  };
  const list = loadCustomIndustries();
  list.unshift(created);
  saveCustomIndustries(list);
  return created;
}

export function deleteCustomIndustry(id: string) {
  const list = loadCustomIndustries().filter(c => c.id !== id);
  saveCustomIndustries(list);
}

/** 既定 + カスタム すべての業界一覧 */
export function getAllIndustries(): Array<{ id: string; label: string; emoji: string; isCustom: boolean }> {
  const builtins = INDUSTRIES.map(i => ({ id: i.id as string, label: i.label, emoji: i.emoji, isCustom: false }));
  const customs = loadCustomIndustries().map(c => ({ id: c.id, label: c.label, emoji: c.emoji, isCustom: true }));
  return [...builtins, ...customs];
}

/** 業界ID から KPI 一覧を取得 (既定 + カスタム両対応) */
export function getBenchmarksForIndustry(industryId: string): BenchmarkEntry[] {
  const builtin = INDUSTRY_BENCHMARKS.filter(b => b.industry === industryId);
  if (builtin.length > 0) return builtin;
  const custom = loadCustomIndustries().find(c => c.id === industryId);
  return custom?.entries ?? [];
}

/** 業界ID からラベル / 絵文字 を取得 */
export function getIndustryInfo(industryId: string): { label: string; emoji: string } | null {
  const b = INDUSTRIES.find(i => i.id === industryId);
  if (b) return { label: b.label, emoji: b.emoji };
  const c = loadCustomIndustries().find(c => c.id === industryId);
  if (c) return { label: c.label, emoji: c.emoji };
  return null;
}

export interface KpiRanking {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  userValue: number;
  p25: number;
  p50: number;
  p75: number;
  estimatedPercentile: number;
  rank: 'top' | 'mid' | 'low';
  source: string;
  description: string;
}

export interface BenchmarkResult {
  industryId: IndustryId | string;
  industryLabel: string;
  rankings: KpiRanking[];
  overallPercentile: number;
  strengths: string[];
  weaknesses: string[];
  recommendedActions: string[];
  summary: string;
  generatedAt: string;
}

function estimatePercentile(entry: BenchmarkEntry, value: number): number {
  const { p25, p50, p75, lowerIsBetter } = entry;
  const range = p75 - p25 || 1;
  let rawPct: number;

  if (!lowerIsBetter) {
    if (value >= p75)      rawPct = 75 + Math.min(20, ((value - p75) / range) * 25);
    else if (value >= p50) rawPct = 50 + ((value - p50) / (p75 - p50 || 1)) * 25;
    else if (value >= p25) rawPct = 25 + ((value - p25) / (p50 - p25 || 1)) * 25;
    else                   rawPct = Math.max(5, 25 * (value / (p25 || 1)));
  } else {
    if (value <= p25)      rawPct = 75 + Math.min(20, ((p25 - value) / range) * 25);
    else if (value <= p50) rawPct = 50 + ((p50 - value) / (p50 - p25 || 1)) * 25;
    else if (value <= p75) rawPct = 25 + ((p75 - value) / (p75 - p50 || 1)) * 25;
    else                   rawPct = Math.max(5, 25 * (p75 / (value || 1)));
  }
  return Math.min(95, Math.max(5, Math.round(rawPct)));
}

function getRank(entry: BenchmarkEntry, value: number): 'top' | 'mid' | 'low' {
  if (!entry.lowerIsBetter) {
    if (value >= entry.p75) return 'top';
    if (value >= entry.p25) return 'mid';
    return 'low';
  } else {
    if (value <= entry.p25) return 'top';
    if (value <= entry.p75) return 'mid';
    return 'low';
  }
}

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

const SYSTEM_PROMPT = `あなたは日本の中小企業専門の経営コンサルタントです。
業界ベンチマークと自社KPIを比較し、経営改善アドバイスをJSON形式で提供します。

返答フォーマット (JSONのみ):
{
  "summary": "全体評価3文。数字を具体的に引用",
  "strengths": ["強み1 (数値引用)", "強み2", "強み3"],
  "weaknesses": ["弱み1 (数値引用)", "弱み2", "弱み3"],
  "recommendedActions": ["アクション1", "アクション2", "アクション3", "アクション4"]
}

ルール:
- KPIを具体的な数値で引用する
- 業界特性を踏まえた実践的な施策
- 優先度高い順に記載
- 全て日本語`;

// ルールベースのフォールバック (APIキーなし / エラー時)
function buildRuleBased(
  rankings: KpiRanking[],
  industryLabel: string,
  overallPercentile: number,
): Pick<BenchmarkResult, 'summary' | 'strengths' | 'weaknesses' | 'recommendedActions'> {
  const topItems = rankings.filter(r => r.rank === 'top');
  const lowItems = rankings.filter(r => r.rank === 'low');

  const strengths = topItems.slice(0, 3).map(r =>
    `${r.label}が${r.userValue}${r.unit}で業界上位25%水準`
  );
  const weaknesses = lowItems.slice(0, 3).map(r =>
    `${r.label}が${r.userValue}${r.unit}で業界中央値(${r.p50}${r.unit})を下回る`
  );
  const recommendedActions = lowItems.slice(0, 4).map(r =>
    `${r.label}を業界中央値(${r.p50}${r.unit})水準に引き上げる施策を検討`
  );

  const topPct = 100 - overallPercentile;
  const summary = `${industryLabel}業界において総合的に上位${topPct}%の位置にあります。` +
    (topItems.length > 0
      ? `特に${topItems[0].label}が優秀です。`
      : '全体的な改善余地があります。') +
    (lowItems.length > 0
      ? `${lowItems[0].label}の改善が最優先課題です。`
      : '現状水準の維持・強化が重要です。');

  return { summary, strengths, weaknesses, recommendedActions };
}

export async function analyzeAgainstIndustry(
  industryId: IndustryId | string,
  userMetrics: UserMetrics,
  settings: AppSettings,
): Promise<BenchmarkResult> {
  const industryBenchmarks = getBenchmarksForIndustry(industryId);
  const industryInfo = getIndustryInfo(industryId);
  if (!industryInfo) throw new Error('不明な業界IDです');

  // 入力値があるKPIのみランキング化
  const rankings: KpiRanking[] = [];
  for (const entry of industryBenchmarks) {
    const value = userMetrics[entry.key];
    if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
    const v = Number(value);
    rankings.push({
      key: entry.key,
      label: entry.label,
      unit: entry.unit,
      lowerIsBetter: entry.lowerIsBetter,
      userValue: v,
      p25: entry.p25,
      p50: entry.p50,
      p75: entry.p75,
      estimatedPercentile: estimatePercentile(entry, v),
      rank: getRank(entry, v),
      source: entry.source,
      description: entry.description,
    });
  }

  const overallPercentile = rankings.length > 0
    ? Math.round(rankings.reduce((s, r) => s + r.estimatedPercentile, 0) / rankings.length)
    : 50;

  if (rankings.length === 0) {
    return {
      industryId,
      industryLabel: industryInfo.label,
      rankings,
      overallPercentile: 50,
      strengths: [],
      weaknesses: [],
      recommendedActions: [],
      summary: 'KPIが入力されていません。数値を入力して再分析してください。',
      generatedAt: new Date().toISOString(),
    };
  }

  // /api/ai は env キーで fallback できるので、AI 失敗時の rule-based は
  // 下の try/catch 側のみで担保 (apiKey ガードは不要)
  const metricsText = rankings.map(r => {
    const rankLabel = r.rank === 'top' ? '上位25%' : r.rank === 'mid' ? '中位50%' : '下位25%';
    return `- ${r.label}: ${r.userValue}${r.unit} [${rankLabel}] (業界中央値: ${r.p50}${r.unit})`;
  }).join('\n');

  const prompt = `## 業界: ${industryInfo.label}\n## 自社KPI vs 業界ベンチマーク\n\n${metricsText}\n\n上記を分析し、経営改善アドバイスをJSONで返してください。`;

  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.preferredModel,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `API error: ${res.status}`);
      }
      return res.json();
    });

    const text = (data as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
    let parsed: Record<string, unknown> = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : text);
    } catch { parsed = {}; }

    return {
      industryId,
      industryLabel: industryInfo.label,
      rankings,
      overallPercentile,
      strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]).slice(0, 3) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]).slice(0, 3) : [],
      recommendedActions: Array.isArray(parsed.recommendedActions) ? (parsed.recommendedActions as string[]).slice(0, 4) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    const fb = buildRuleBased(rankings, industryInfo.label, overallPercentile);
    return { industryId, industryLabel: industryInfo.label, rankings, overallPercentile, ...fb, generatedAt: new Date().toISOString() };
  }
}

// 結果をlocalStorageにキャッシュ
const CACHE_KEY_PREFIX = 'core_benchmark_v1_';

export function saveBenchmarkResult(personaId: string, result: BenchmarkResult) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + personaId, JSON.stringify(result));
  } catch { /* quota */ }
  appendHistorySnapshot(personaId, result);
}

export function loadBenchmarkResult(personaId: string): BenchmarkResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + personaId);
    return raw ? JSON.parse(raw) as BenchmarkResult : null;
  } catch { return null; }
}

// ── 月次スナップショット ─────────────────────────────────
// 同じ年月+業界に複数回分析した場合は最新で上書き。グラフ用に時系列を保持。
export interface BenchmarkSnapshot {
  yearMonth: string;           // 'YYYY-MM'
  industryId: string;
  industryLabel: string;
  overallPercentile: number;
  rankings: Array<{ key: string; label: string; unit: string; userValue: number; p50: number; estimatedPercentile: number }>;
  generatedAt: string;
}

const HISTORY_KEY_PREFIX = 'core_benchmark_history_v1_';
const HISTORY_MAX = 24;        // 24 ヶ月

export function loadHistory(personaId: string): BenchmarkSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY_PREFIX + personaId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BenchmarkSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHistory(personaId: string, list: BenchmarkSnapshot[]) {
  try { localStorage.setItem(HISTORY_KEY_PREFIX + personaId, JSON.stringify(list.slice(-HISTORY_MAX))); } catch { /* quota */ }
}

function appendHistorySnapshot(personaId: string, result: BenchmarkResult) {
  const d = new Date(result.generatedAt);
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const snap: BenchmarkSnapshot = {
    yearMonth: ym,
    industryId: String(result.industryId),
    industryLabel: result.industryLabel,
    overallPercentile: result.overallPercentile,
    rankings: result.rankings.map(r => ({
      key: r.key, label: r.label, unit: r.unit,
      userValue: r.userValue, p50: r.p50, estimatedPercentile: r.estimatedPercentile,
    })),
    generatedAt: result.generatedAt,
  };
  const list = loadHistory(personaId);
  const idx = list.findIndex(s => s.yearMonth === ym && s.industryId === String(result.industryId));
  if (idx >= 0) list[idx] = snap; else list.push(snap);
  list.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  saveHistory(personaId, list);
}

export function clearHistory(personaId: string) {
  try { localStorage.removeItem(HISTORY_KEY_PREFIX + personaId); } catch { /* */ }
}

// ── 競合直接比較 ────────────────────────────────────────
export interface CompetitorEntry {
  id: string;
  name: string;
  metrics: UserMetrics;
}

const COMPETITOR_KEY_PREFIX = 'core_benchmark_competitors_v1_';

export function loadCompetitors(personaId: string, industryId: string): CompetitorEntry[] {
  try {
    const raw = localStorage.getItem(COMPETITOR_KEY_PREFIX + personaId + '_' + industryId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompetitorEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch { return []; }
}

export function saveCompetitors(personaId: string, industryId: string, list: CompetitorEntry[]) {
  try {
    localStorage.setItem(
      COMPETITOR_KEY_PREFIX + personaId + '_' + industryId,
      JSON.stringify(list.slice(0, 3)),
    );
  } catch { /* quota */ }
}

// ── Markdown レポート出力 ────────────────────────────────
export function generateMarkdownReport(
  result: BenchmarkResult,
  personaName: string,
  competitors: CompetitorEntry[] = [],
): string {
  const date = new Date(result.generatedAt).toLocaleDateString('ja-JP');
  const topPct = 100 - result.overallPercentile;
  const lines: string[] = [];
  lines.push(`# 業界ベンチマーク分析レポート`);
  lines.push('');
  lines.push(`- **事業者**: ${personaName}`);
  lines.push(`- **業界**: ${result.industryLabel}`);
  lines.push(`- **生成日**: ${date}`);
  lines.push(`- **総合評価**: 上位 ${topPct}% (${result.overallPercentile} パーセンタイル)`);
  lines.push('');
  lines.push(`## 総合評価`);
  lines.push('');
  lines.push(result.summary || '(なし)');
  lines.push('');

  lines.push(`## KPI 詳細比較`);
  lines.push('');
  const headerCols = ['KPI', '自社'];
  competitors.forEach(c => headerCols.push(c.name));
  headerCols.push('業界中央値', '評価', 'パーセンタイル');
  lines.push('| ' + headerCols.join(' | ') + ' |');
  lines.push('| ' + headerCols.map(() => '---').join(' | ') + ' |');
  for (const r of result.rankings) {
    const rankLabel = r.rank === 'top' ? '上位' : r.rank === 'mid' ? '中位' : '要改善';
    const cells = [r.label, `${r.userValue}${r.unit}`];
    competitors.forEach(c => {
      const v = c.metrics[r.key];
      cells.push(v !== undefined ? `${v}${r.unit}` : '—');
    });
    cells.push(`${r.p50}${r.unit}`, rankLabel, `${r.estimatedPercentile}%ile`);
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  lines.push('');

  if (result.strengths.length > 0) {
    lines.push(`## 強み`);
    lines.push('');
    result.strengths.forEach(s => lines.push(`- ${s}`));
    lines.push('');
  }
  if (result.weaknesses.length > 0) {
    lines.push(`## 改善ポイント`);
    lines.push('');
    result.weaknesses.forEach(w => lines.push(`- ${w}`));
    lines.push('');
  }
  if (result.recommendedActions.length > 0) {
    lines.push(`## 推奨アクション`);
    lines.push('');
    result.recommendedActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`データ出典: ${[...new Set(result.rankings.map(r => r.source))].join(' / ')}`);
  lines.push(`Generated by CORE Prism OS`);
  return lines.join('\n');
}

// ============================================================
// ── AI 補助モード — 業界推定 + Q&A 逆算 ───────────────────
// ============================================================

export interface IndustryInference {
  industryId: string;          // 既存カタログの id か、推定ラベルを fallback
  label: string;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface InferIndustryInput {
  personaName?: string;
  personaDescription?: string;
  knowledgeTitles?: string[];
  knowledgeSummary?: string;
  stripeCurrencies?: string[];
  cashflowLabel?: string;
}

const INDUSTRY_INFER_SYSTEM = `あなたは日本の中小企業の業種推定アシスタントです。
入力から「業種」を一つに絞り込み、JSON だけで返してください。

利用可能な業種カタログ (industryId, ラベル):
${INDUSTRIES.map(i => `- ${i.id}: ${i.label}`).join('\n')}

判定ルール:
- 上記のいずれかに合致するなら industryId はそのカタログ ID を使う
- どれにも合わない場合のみ industryId に "custom" を入れ、label に推定業種名 (日本語) を書く
- confidence は high / medium / low から選ぶ
- rationale は 1 文 (どの手がかりで判断したか)

返答フォーマット (JSON のみ、コメント禁止):
{
  "industryId": "food",
  "label": "飲食・外食",
  "confidence": "high",
  "rationale": "ナレッジに 'メニュー', '客単価' があり飲食業の特徴と一致"
}`;

/** 業界を AI 推定。失敗時は cashflow.label や knowledge から rule-based fallback。 */
export async function inferIndustry(
  input: InferIndustryInput,
  settings: AppSettings,
): Promise<IndustryInference> {
  const lines: string[] = [];
  if (input.personaName) lines.push(`事業者名: ${input.personaName}`);
  if (input.personaDescription) lines.push(`事業者プロフィール: ${input.personaDescription.slice(0, 400)}`);
  if (input.knowledgeTitles && input.knowledgeTitles.length > 0) {
    lines.push(`ナレッジタイトル: ${input.knowledgeTitles.slice(0, 12).join(' / ')}`);
  }
  if (input.knowledgeSummary) lines.push(`ナレッジ要約: ${input.knowledgeSummary.slice(0, 600)}`);
  if (input.stripeCurrencies && input.stripeCurrencies.length > 0) {
    lines.push(`Stripe 通貨: ${input.stripeCurrencies.join(', ')}`);
  }
  if (input.cashflowLabel) lines.push(`キャッシュフロー説明: ${input.cashflowLabel}`);
  if (lines.length === 0) lines.push('(情報なし — 一般的な小規模事業者を想定して推定)');

  const prompt = `## 事業者ヒント\n\n${lines.join('\n')}\n\n上記から最も近い業種を 1 つ選び、JSON で返答してください。`;

  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
        body: JSON.stringify({
          model: settings.preferredModel || 'claude-haiku-4-5',
          max_tokens: 600,
          system: INDUSTRY_INFER_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `API error: ${res.status}`);
      }
      return res.json();
    });
    const text = (data as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text) as Partial<IndustryInference>;
    const id = String(parsed.industryId || 'custom');
    const validIds = new Set(INDUSTRIES.map(i => i.id as string));
    const finalId = validIds.has(id) ? id : (parsed.industryId === 'custom' ? 'custom' : id);
    return {
      industryId: finalId,
      label: parsed.label || getIndustryInfo(finalId)?.label || '不明',
      confidence: (parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low')
        ? parsed.confidence : 'low',
      rationale: parsed.rationale || '',
    };
  } catch {
    // ── ローカル fallback ─────────────────────
    const haystack = [
      input.personaDescription, input.cashflowLabel,
      ...(input.knowledgeTitles || []), input.knowledgeSummary || '',
    ].join(' ').toLowerCase();
    const guesses: Array<{ id: string; keywords: string[] }> = [
      { id: 'food',          keywords: ['飲食', 'レストラン', 'カフェ', '居酒屋', 'メニュー', '客単価'] },
      { id: 'saas',          keywords: ['saas', 'subscription', 'mrr', 'arr', 'システム開発', 'web 開発', 'app'] },
      { id: 'ec',            keywords: ['ec', '通販', 'オンラインショップ', 'shopify', '購入'] },
      { id: 'retail',        keywords: ['小売', '店舗', '販売', 'pos'] },
      { id: 'manufacturing', keywords: ['製造', '工場', '生産', '加工'] },
      { id: 'consulting',    keywords: ['コンサル', '顧問', 'アドバイザリー'] },
      { id: 'advertising',   keywords: ['広告', 'マーケ', 'sns', 'インフルエンサー'] },
      { id: 'realestate',    keywords: ['不動産', '物件', '賃貸', '管理組合', '入居'] },
    ];
    let best: { id: string; score: number } = { id: 'consulting', score: 0 };
    for (const g of guesses) {
      const score = g.keywords.reduce((s, k) => s + (haystack.includes(k) ? 1 : 0), 0);
      if (score > best.score) best = { id: g.id, score };
    }
    const info = getIndustryInfo(best.id) || { label: '不明', emoji: '❓' };
    return {
      industryId: best.id,
      label: info.label,
      confidence: best.score >= 2 ? 'medium' : 'low',
      rationale: best.score > 0
        ? `手がかり語の一致から ${info.label} と推定 (オフライン fallback)`
        : '情報が少なかったため一般的なサービス業を仮置き',
    };
  }
}

// ── Q&A 回答からの metrics 逆算 ─────────────────────────
export interface QaAnswers {
  /** 月の売上 (円、概算) */
  monthlyRevenue?: number;
  /** 月の固定費 (人件費+家賃+その他、円) */
  monthlyFixedCost?: number;
  /** 月の変動費・仕入れ (円) — 任意 */
  monthlyVariableCost?: number;
  /** 月の顧客数 (人 or 件) — 任意 */
  monthlyCustomers?: number;
  /** 価格レンジ ('low' | 'mid' | 'high') */
  priceRange?: 'low' | 'mid' | 'high';
  /** YoY 売上成長率 (%) — 不明なら未定義 */
  yoyGrowth?: number;
  /** 自由記述ヒント */
  freeNote?: string;
}

const QA_ESTIMATE_SYSTEM = `あなたは日本の中小企業の財務アシスタントです。
オーナーの大ざっぱな回答から、業界 KPI (粗利率 / 営業利益率 等) を「概算」で推定します。

ルール:
- 出力は JSON のみ。コメント禁止
- キー名は与えられた KPI 一覧の key と完全一致させる
- 単純計算で出せるもの (粗利率・営業利益率・人件費比率・食材費比率など) は計算する
- 計算できない / 情報不足の KPI は出力しない (推測で適当な値を入れない)
- 値は数値型 (パーセンテージは 0-100 の数値、円は含めない)

返答フォーマット例:
{
  "grossMargin": 62,
  "operatingMargin": 8,
  "laborCostRatio": 28
}`;

/** Q&A 回答から KPI を AI で逆算。AI 失敗時はオフラインで計算可能なものだけ返す。 */
export async function estimateMetricsFromQA(
  industryId: string,
  qa: QaAnswers,
  settings: AppSettings,
  extraContext?: { knowledgeFinancialHint?: string },
): Promise<{ metrics: UserMetrics; notes: string[] }> {
  const entries = getBenchmarksForIndustry(industryId);
  if (entries.length === 0) return { metrics: {}, notes: ['業界 KPI が未定義のため推定できませんでした'] };

  const revenue = qa.monthlyRevenue || 0;
  const fixed = qa.monthlyFixedCost || 0;
  const variable = qa.monthlyVariableCost || 0;

  // ── オフライン算出 (情報がある場合のみ) ──
  const offline: UserMetrics = {};
  const notes: string[] = [];
  if (revenue > 0) {
    if (variable > 0) {
      const gm = Math.round(((revenue - variable) / revenue) * 100);
      if (entries.some(e => e.key === 'grossMargin')) offline.grossMargin = gm;
      if (entries.some(e => e.key === 'foodCostRatio')) offline.foodCostRatio = Math.round((variable / revenue) * 100);
    }
    if (fixed > 0) {
      const opMargin = Math.round(((revenue - variable - fixed) / revenue) * 100);
      if (entries.some(e => e.key === 'operatingMargin')) offline.operatingMargin = opMargin;
      if (entries.some(e => e.key === 'laborCostRatio')) {
        // 固定費の概ね 60% を人件費と推定 (fallback only)
        offline.laborCostRatio = Math.round(((fixed * 0.6) / revenue) * 100);
      }
    }
    if (qa.monthlyCustomers && qa.monthlyCustomers > 0) {
      const arpu = Math.round(revenue / qa.monthlyCustomers);
      if (entries.some(e => e.key === 'arpu')) offline.arpu = arpu;
    }
    if (qa.yoyGrowth !== undefined) {
      if (entries.some(e => e.key === 'revenueGrowth')) offline.revenueGrowth = Math.round(qa.yoyGrowth);
    }
  }

  // AI に渡す KPI 一覧
  const kpiList = entries.map(e =>
    `- ${e.key} (${e.label}, 単位: ${e.unit}, 業界中央値: ${e.p50}${e.unit}${e.lowerIsBetter ? ', 低いほど良' : ''})`
  ).join('\n');

  const qaLines: string[] = [];
  if (qa.monthlyRevenue !== undefined) qaLines.push(`月の売上: 約 ${qa.monthlyRevenue.toLocaleString()} 円`);
  if (qa.monthlyFixedCost !== undefined) qaLines.push(`月の固定費 (人件費+家賃等): 約 ${qa.monthlyFixedCost.toLocaleString()} 円`);
  if (qa.monthlyVariableCost !== undefined) qaLines.push(`月の変動費 (仕入れ・原材料): 約 ${qa.monthlyVariableCost.toLocaleString()} 円`);
  if (qa.monthlyCustomers !== undefined) qaLines.push(`月の客数: 約 ${qa.monthlyCustomers.toLocaleString()} 人/件`);
  if (qa.priceRange) {
    const pr = { low: '同業より安め', mid: '同業並み', high: '同業より高め' }[qa.priceRange];
    qaLines.push(`価格帯: ${pr}`);
  }
  if (qa.yoyGrowth !== undefined) qaLines.push(`前年比 売上成長率: ${qa.yoyGrowth}%`);
  if (qa.freeNote) qaLines.push(`オーナーメモ: ${qa.freeNote.slice(0, 300)}`);
  if (extraContext?.knowledgeFinancialHint) qaLines.push(`ナレッジから抽出した財務ヒント: ${extraContext.knowledgeFinancialHint.slice(0, 400)}`);

  if (qaLines.length === 0) {
    return { metrics: offline, notes: ['回答が少なかったため、計算できる KPI のみ算出しました'] };
  }

  const info = getIndustryInfo(industryId);
  const prompt = `## 業界: ${info?.label ?? industryId}\n\n## オーナーの回答\n${qaLines.join('\n')}\n\n## 推定対象 KPI\n${kpiList}\n\n上記から計算可能な KPI のみを JSON で返してください。`;

  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
        body: JSON.stringify({
          model: settings.preferredModel || 'claude-haiku-4-5',
          max_tokens: 800,
          system: QA_ESTIMATE_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `API error: ${res.status}`);
      }
      return res.json();
    });
    const text = (data as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text) as Record<string, unknown>;

    const validKeys = new Set(entries.map(e => e.key));
    const aiMetrics: UserMetrics = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!validKeys.has(k)) continue;
      const n = Number(v);
      if (Number.isFinite(n)) aiMetrics[k] = n;
    }

    // オフライン値を優先 (実値だから)、AI 値で穴埋め
    const merged: UserMetrics = { ...aiMetrics, ...offline };
    if (Object.keys(aiMetrics).length > 0) notes.push(`AI が ${Object.keys(aiMetrics).length} 項目を推定`);
    if (Object.keys(offline).length > 0) notes.push(`実回答から ${Object.keys(offline).length} 項目を計算`);
    return { metrics: merged, notes };
  } catch {
    notes.push('AI 推定に失敗したため、計算できる KPI のみ算出しました');
    return { metrics: offline, notes };
  }
}
