// ============================================================
// 戦略コンサル AI — McKinsey 級フレームワークで戦略を構造化
// ============================================================
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export type StrategyFramework = 'swot' | '3c' | '5forces' | 'value_chain' | 'bcg' | 'star' | 'pestel' | 'jobs_to_be_done';

export const FRAMEWORKS: Record<StrategyFramework, { label: string; emoji: string; desc: string }> = {
  swot: { label: 'SWOT 分析', emoji: '⚔', desc: '強み・弱み・機会・脅威' },
  '3c': { label: '3C 分析', emoji: '🎯', desc: '顧客・競合・自社' },
  '5forces': { label: '5 Forces', emoji: '🔥', desc: 'Porter の業界分析' },
  value_chain: { label: 'バリューチェーン', emoji: '🔗', desc: '価値創造プロセス分析' },
  bcg: { label: 'BCG マトリクス', emoji: '📊', desc: '事業ポートフォリオ評価' },
  star: { label: 'STAR モデル', emoji: '⭐', desc: '組織能力評価' },
  pestel: { label: 'PESTEL', emoji: '🌐', desc: 'マクロ環境分析' },
  jobs_to_be_done: { label: 'JTBD', emoji: '💼', desc: 'Jobs to be Done' },
};

export interface StrategicAnalysis {
  framework: StrategyFramework;
  question: string;
  context: string;
  sections: { heading: string; content: string; bullets: string[] }[];
  keyInsights: string[];
  recommendations: { priority: 'critical' | 'high' | 'medium'; action: string; rationale: string; timeline: string }[];
  risks: string[];
  metrics: string[];   // 進捗計測用 KPI
  generatedAt: string;
}

const FRAMEWORK_PROMPTS: Record<StrategyFramework, string> = {
  swot: `SWOT 分析を実行: Strengths / Weaknesses / Opportunities / Threats の 4 セクションで分析。各セクション 4-6 個の具体的箇条書き。`,
  '3c': `3C 分析を実行: Customer (顧客)、Competitor (競合)、Company (自社) の 3 セクション。各セクションは現状・洞察・示唆を含む。`,
  '5forces': `Porter's 5 Forces 分析: 既存企業間の競争 / 新規参入の脅威 / 代替品の脅威 / 買い手の交渉力 / 供給者の交渉力。各 force のレベル (高/中/低) と理由。`,
  value_chain: `バリューチェーン分析: 主活動 (購買→製造→出荷→販売→サービス) と支援活動 (調達/R&D/人事/インフラ)。各活動の競争優位性評価。`,
  bcg: `BCG マトリクス分析: Star / Cash Cow / Question Mark / Dog の 4 象限に事業/製品をマッピング。各象限の戦略示唆。`,
  star: `STAR (組織能力) モデル: Strategy / Tactics / Atmosphere / Resources の 4 軸で組織を評価。`,
  pestel: `PESTEL 分析: Political / Economic / Social / Technological / Environmental / Legal の 6 要因でマクロ環境を分析。`,
  jobs_to_be_done: `Jobs to be Done フレームワーク: 顧客が解決したい仕事 / 機能的・感情的・社会的ジョブ / 現状の代替手段とその不満 / 我々のソリューションがどう優れるか。`,
};

const SYS = (fw: StrategyFramework) => `あなたは McKinsey / BCG レベルの経営戦略コンサルタントです。
${FRAMEWORK_PROMPTS[fw]}

返答は**JSONのみ**(コードブロック・説明文なし)。スキーマ:
{
  "sections": [
    { "heading": "セクション名", "content": "概要 (2-3文)", "bullets": ["具体ポイント1", "具体ポイント2", ...] }
  ],
  "keyInsights": ["最重要な洞察1", ...] // 3-5項目
  "recommendations": [
    { "priority": "critical" | "high" | "medium", "action": "推奨アクション", "rationale": "根拠 (1-2文)", "timeline": "実施時期 (例: 1ヶ月以内)" }
  ] // 3-5項目
  "risks": ["この戦略を実行する際のリスク1", ...] // 2-4項目
  "metrics": ["効果計測の KPI1", ...] // 3-5項目
}

ルール:
- 推測ではなく入力情報に基づく
- 具体的で実行可能な提案
- 日本語、簡潔にプロフェッショナルに`;

export async function runStrategicAnalysis(
  settings: AppSettings,
  persona: Persona,
  framework: StrategyFramework,
  question: string,
  context: string,
  knowledge: KnowledgeItem[],
): Promise<StrategicAnalysis> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const relevantKb = knowledge
    .filter(k => k.personaId === persona.id)
    .slice(0, 6)
    .map(k => `- ${k.title}: ${k.analysis?.summary || k.content.slice(0, 250)}`)
    .join('\n') || '(関連ナレッジなし)';

  const userPrompt = `## 人格コンテキスト
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 分析テーマ
${question}

## 背景・前提
${context || '(指定なし - 一般的なビジネス文脈で分析)'}

## 関連ナレッジ
${relevantKb}

上記を踏まえて、${FRAMEWORKS[framework].label} を実行してください。`;

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
      max_tokens: 4096,
      system: SYS(framework),
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `戦略 API エラー: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { parsed = {}; }

  return {
    framework,
    question,
    context,
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    generatedAt: new Date().toISOString(),
  };
}

export function strategyToMarkdown(s: StrategicAnalysis): string {
  const lines: string[] = [];
  lines.push(`# ${FRAMEWORKS[s.framework].label}\n`);
  lines.push(`**テーマ**: ${s.question}\n`);
  if (s.context) lines.push(`**背景**: ${s.context}\n`);
  lines.push('## 分析');
  s.sections.forEach((sec) => {
    lines.push(`\n### ${sec.heading}`);
    if (sec.content) lines.push(sec.content);
    sec.bullets.forEach(b => lines.push(`- ${b}`));
  });
  if (s.keyInsights.length) {
    lines.push('\n## 重要な洞察');
    s.keyInsights.forEach(i => lines.push(`- ${i}`));
  }
  if (s.recommendations.length) {
    lines.push('\n## 推奨アクション');
    s.recommendations.forEach(r => {
      lines.push(`- **[${r.priority.toUpperCase()}]** ${r.action} _(${r.timeline})_`);
      lines.push(`  - 根拠: ${r.rationale}`);
    });
  }
  if (s.risks.length) {
    lines.push('\n## リスク');
    s.risks.forEach(r => lines.push(`- ${r}`));
  }
  if (s.metrics.length) {
    lines.push('\n## 計測 KPI');
    s.metrics.forEach(m => lines.push(`- ${m}`));
  }
  return lines.join('\n');
}
