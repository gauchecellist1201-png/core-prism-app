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
