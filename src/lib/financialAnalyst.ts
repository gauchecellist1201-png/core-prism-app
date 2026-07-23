// ============================================================
// 決算書分析 AI — 財務健全性診断 + 改善提案
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface FinancialMetric {
  name: string;        // 例: "売上高総利益率"
  value: string;       // 例: "59.3%"
  trend: 'up' | 'down' | 'flat';
  benchmark: string;   // 例: "業界平均 50%"
  evaluation: 'good' | 'caution' | 'warning' | 'neutral';
  comment: string;     // 1文の解説
}

export interface FinancialAnalysis {
  documentTitle: string;
  period: string;
  overallHealth: 'excellent' | 'good' | 'fair' | 'concerning' | 'critical';
  healthScore: number;  // 0-100
  summary: string;
  keyMetrics: FinancialMetric[];
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];     // 緊急対応必要
  cashFlowOutlook: string;  // キャッシュフロー見通し
  recommendations: { priority: 'critical' | 'high' | 'medium'; action: string; impact: string }[];
  benchmarks: { metric: string; ours: string; industry: string }[];
  generatedAt: string;
}

const SYS = `あなたは大手監査法人出身の財務アナリスト・CFO 経験者です。
決算書を分析し、経営判断に直結する診断レポートを作成します。

返答は**JSONのみ**:
{
  "documentTitle": "決算書のタイトル",
  "period": "対象期間 (例: 2026年1-3月)",
  "overallHealth": "excellent" | "good" | "fair" | "concerning" | "critical",
  "healthScore": 0-100 (財務健全性スコア),
  "summary": "全体診断 (3-5文)",
  "keyMetrics": [
    {
      "name": "メトリクス名 (例: 売上高総利益率)",
      "value": "数値 (例: 59.3%)",
      "trend": "up" | "down" | "flat",
      "benchmark": "業界平均などとの比較",
      "evaluation": "good" | "caution" | "warning" | "neutral",
      "comment": "1文の解説"
    }
  ] // 8-12個のメトリクス
  "strengths": ["強み1", ...] // 3-5項目
  "weaknesses": ["弱み1", ...] // 3-5項目
  "redFlags": ["緊急対応必要事項1", ...] // 0-3項目 (該当時のみ)
  "cashFlowOutlook": "キャッシュフロー見通し (3-5文)",
  "recommendations": [
    { "priority": "critical" | "high" | "medium", "action": "推奨施策", "impact": "期待効果" }
  ] // 4-6項目
  "benchmarks": [
    { "metric": "指標名", "ours": "自社値", "industry": "業界値/目標値" }
  ] // 5-8項目
}

評価軸:
- 売上成長率 / 利益率 (粗利・営業・純利益)
- ROE / ROA / ROI
- 流動比率 / 自己資本比率 / 負債比率
- キャッシュフロー (営業/投資/財務)
- バーンレート / ランウェイ (スタートアップの場合)
- ARR / MRR / Churn / LTV/CAC (SaaS の場合)

ルール:
- 数字を具体的に引用 (推測値の場合は明記)
- 業界平均との比較を含める
- 経営者が「次に何をすべきか」を明確に
- 全て日本語`;

export async function analyzeFinancials(
  settings: AppSettings,
  _persona: Persona,
  financialText: string,
): Promise<FinancialAnalysis> {

  const truncated = financialText.length > 30000
    ? financialText.slice(0, 30000) + '\n\n[...省略]'
    : financialText;

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 6144,
        system: SYS,
        messages: [{ role: 'user', content: `## 決算データ\n${truncated}\n\n上記を詳細分析してください。` }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `決算分析 API エラー: ${res.status}`);
    }
    return res.json();
  });
  const text = data.content?.[0]?.text ?? '';
  if (!text.trim()) {
    throw new Error('決算分析: AI から空の応答が返りました。もう一度試してください。');
  }
  let parsed: any = {};
  let parseOk = false;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
    parseOk = true;
  } catch { parseOk = false; }
  // 全フィールド欠落 = 解析失敗 → 「成功扱いで空表示」を防ぐ
  if (!parseOk || (!parsed.summary && !Array.isArray(parsed.keyMetrics) && !Array.isArray(parsed.recommendations))) {
    throw new Error('決算分析: AI の応答を解釈できませんでした。PDF を画像化して再アップロードしてみてください。');
  }

  return {
    documentTitle: parsed.documentTitle || '決算書',
    period: parsed.period || '',
    overallHealth: parsed.overallHealth || 'fair',
    healthScore: Number(parsed.healthScore) || 50,
    summary: parsed.summary || '',
    keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    cashFlowOutlook: parsed.cashFlowOutlook || '',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    benchmarks: Array.isArray(parsed.benchmarks) ? parsed.benchmarks : [],
    generatedAt: new Date().toISOString(),
  };
}

export function financialToMarkdown(f: FinancialAnalysis): string {
  const lines: string[] = [];
  lines.push(`# 財務分析: ${f.documentTitle}\n`);
  lines.push(`**期間**: ${f.period}`);
  lines.push(`**総合健全性**: ${f.overallHealth.toUpperCase()} (スコア ${f.healthScore}/100)\n`);
  lines.push(`## サマリ\n${f.summary}\n`);
  if (f.redFlags.length) {
    lines.push('## 🚨 緊急対応事項');
    f.redFlags.forEach(r => lines.push(`- ${r}`));
    lines.push('');
  }
  if (f.keyMetrics.length) {
    lines.push('## 主要メトリクス');
    f.keyMetrics.forEach(m => {
      const trend = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→';
      lines.push(`- **${m.name}**: ${m.value} ${trend} _(${m.evaluation.toUpperCase()})_`);
      lines.push(`  - ${m.comment} | ${m.benchmark}`);
    });
  }
  if (f.strengths.length) {
    lines.push('\n## 強み');
    f.strengths.forEach(s => lines.push(`- ${s}`));
  }
  if (f.weaknesses.length) {
    lines.push('\n## 弱み');
    f.weaknesses.forEach(w => lines.push(`- ${w}`));
  }
  if (f.cashFlowOutlook) lines.push(`\n## キャッシュフロー見通し\n${f.cashFlowOutlook}`);
  if (f.recommendations.length) {
    lines.push('\n## 推奨施策');
    f.recommendations.forEach(r => {
      lines.push(`- **[${r.priority.toUpperCase()}]** ${r.action}`);
      lines.push(`  - 期待効果: ${r.impact}`);
    });
  }
  if (f.benchmarks.length) {
    lines.push('\n## ベンチマーク比較');
    f.benchmarks.forEach(b => lines.push(`- ${b.metric}: 自社 **${b.ours}** / 業界 ${b.industry}`));
  }
  return lines.join('\n');
}
