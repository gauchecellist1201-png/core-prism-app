// ============================================================
// 業界ベンチマーク分析 — Claude + 静的ベンチマークデータ
// ============================================================
import { INDUSTRY_BENCHMARKS, INDUSTRIES, type IndustryId, type BenchmarkEntry } from './benchmarkData';
import { enqueueClaudeCall } from './apiQueue';
import type { AppSettings } from '../types/identity';

export interface UserMetrics {
  [key: string]: number;
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
  industryId: IndustryId;
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
    // lower is better → invert
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

function getApiKey(settings: AppSettings): string {
  return (import.meta.env.VITE_CLAUDE_API_KEY as string) || settings.claudeApiKey || '';
}

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
  industryId: IndustryId,
  userMetrics: UserMetrics,
  settings: AppSettings,
): Promise<BenchmarkResult> {
  const industryBenchmarks = INDUSTRY_BENCHMARKS.filter(b => b.industry === industryId);
  const industryInfo = INDUSTRIES.find(i => i.id === industryId);
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

  const apiKey = getApiKey(settings);

  if (!apiKey) {
    const fb = buildRuleBased(rankings, industryInfo.label, overallPercentile);
    return { industryId, industryLabel: industryInfo.label, rankings, overallPercentile, ...fb, generatedAt: new Date().toISOString() };
  }

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
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
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
}

export function loadBenchmarkResult(personaId: string): BenchmarkResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + personaId);
    return raw ? JSON.parse(raw) as BenchmarkResult : null;
  } catch { return null; }
}
