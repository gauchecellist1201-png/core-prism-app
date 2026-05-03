// ============================================================
// 契約書レビュー AI — リスク・標準逸脱・交渉ポイント抽出
// ============================================================
import type { AppSettings, Persona } from '../types/identity';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export type ContractStance = 'buyer' | 'seller' | 'employer' | 'employee' | 'investor' | 'investee' | 'neutral';

export const STANCE_LABELS: Record<ContractStance, string> = {
  buyer: '買い手 / 発注者',
  seller: '売り手 / 受注者',
  employer: '雇用者',
  employee: '被雇用者',
  investor: '投資家',
  investee: '出資先',
  neutral: '中立評価',
};

export interface ContractClause {
  type: string;          // 例: "支払条件"
  excerpt: string;       // 該当条項の引用 (50-150文字)
  severity: 'critical' | 'high' | 'medium' | 'info';
  issue: string;         // 何が問題か
  suggestion: string;    // 改善提案
  redline?: string;      // 修正後の文言案
}

export interface ContractReview {
  documentTitle: string;
  stance: ContractStance;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;       // 全体サマリ
  parties: string[];     // 当事者
  keyTerms: { label: string; value: string }[];  // 主要条件
  clauses: ContractClause[];
  missingClauses: string[];   // 標準的に含むべきだが不足している条項
  negotiationPoints: { priority: number; point: string; rationale: string }[];
  redFlags: string[];
  generatedAt: string;
}

const SYS = (stance: ContractStance) => `あなたは経験豊富な企業法務 (ビジネスロイヤー) です。
契約書を ${STANCE_LABELS[stance]} の立場で詳細レビューします。

返答は**JSONのみ**(コードブロック・説明文なし):
{
  "documentTitle": "契約書のタイトル",
  "overallRisk": "low" | "medium" | "high" | "critical",
  "summary": "全体サマリ (3-5文、何の契約で、依頼者にとってどう評価できるか)",
  "parties": ["当事者A", "当事者B"],
  "keyTerms": [
    { "label": "契約期間", "value": "..." },
    { "label": "報酬・対価", "value": "..." },
    { "label": "支払条件", "value": "..." }
  ],
  "clauses": [
    {
      "type": "条項の種類 (例: 解除条項)",
      "excerpt": "該当箇所の引用 (50-150文字)",
      "severity": "critical" | "high" | "medium" | "info",
      "issue": "何が問題か (1-2文)",
      "suggestion": "改善提案 (1-2文)",
      "redline": "(任意) 修正後の文言案"
    }
  ] // 5-10項目
  "missingClauses": ["標準的に含むべきだが不足している条項1", ...]
  "negotiationPoints": [
    { "priority": 1, "point": "交渉すべきポイント", "rationale": "なぜ重要か" }
  ] // priority 1 が最重要、最大 5 項目
  "redFlags": ["明らかに不利な点・即時対応必要1", ...] // 0-3項目
}

評価基準 (severity):
- critical: 法的に重大なリスク、契約締結を見送るべき
- high: 大幅な交渉が必要、現状では受け入れ難い
- medium: 改善を求めるべきだが、致命的ではない
- info: 注意点として認識すべき

ルール:
- ${STANCE_LABELS[stance]} の立場で「不利になる」点を厳しく指摘
- 標準的な業界慣習・法的リスクと比較
- 全て日本語、簡潔・正確に`;

export async function reviewContract(
  settings: AppSettings,
  _persona: Persona,
  contractText: string,
  stance: ContractStance,
): Promise<ContractReview> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const truncated = contractText.length > 30000
    ? contractText.slice(0, 30000) + '\n\n[...以降省略]'
    : contractText;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.preferredModel,
      max_tokens: 6144,
      system: SYS(stance),
      messages: [{ role: 'user', content: `## 契約書\n${truncated}\n\n${STANCE_LABELS[stance]} の立場で詳細レビューしてください。` }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `契約レビュー API エラー: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { parsed = {}; }

  return {
    documentTitle: parsed.documentTitle || '契約書',
    stance,
    overallRisk: parsed.overallRisk || 'medium',
    summary: parsed.summary || '',
    parties: Array.isArray(parsed.parties) ? parsed.parties : [],
    keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
    clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
    missingClauses: Array.isArray(parsed.missingClauses) ? parsed.missingClauses : [],
    negotiationPoints: Array.isArray(parsed.negotiationPoints) ? parsed.negotiationPoints : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    generatedAt: new Date().toISOString(),
  };
}

export function contractToMarkdown(r: ContractReview): string {
  const lines: string[] = [];
  lines.push(`# 契約書レビュー: ${r.documentTitle}\n`);
  lines.push(`**評価対象**: ${STANCE_LABELS[r.stance]} 視点`);
  lines.push(`**総合リスク**: ${r.overallRisk.toUpperCase()}\n`);
  lines.push(`## サマリ\n${r.summary}\n`);
  if (r.parties.length) lines.push(`**当事者**: ${r.parties.join(' / ')}\n`);
  if (r.keyTerms.length) {
    lines.push('## 主要条件');
    r.keyTerms.forEach(t => lines.push(`- ${t.label}: ${t.value}`));
  }
  if (r.redFlags.length) {
    lines.push('\n## 🚨 レッドフラッグ');
    r.redFlags.forEach(f => lines.push(`- ${f}`));
  }
  if (r.clauses.length) {
    lines.push('\n## 条項レビュー');
    r.clauses.forEach(c => {
      lines.push(`\n### [${c.severity.toUpperCase()}] ${c.type}`);
      lines.push(`> ${c.excerpt}`);
      lines.push(`**問題**: ${c.issue}`);
      lines.push(`**提案**: ${c.suggestion}`);
      if (c.redline) lines.push(`**修正案**: ${c.redline}`);
    });
  }
  if (r.missingClauses.length) {
    lines.push('\n## 不足条項');
    r.missingClauses.forEach(m => lines.push(`- ${m}`));
  }
  if (r.negotiationPoints.length) {
    lines.push('\n## 交渉ポイント');
    r.negotiationPoints
      .sort((a, b) => a.priority - b.priority)
      .forEach(p => lines.push(`${p.priority}. ${p.point} — ${p.rationale}`));
  }
  return lines.join('\n');
}
