import type { AppSettings } from '../types/identity';
import type { PersonRecord, PersonInteraction } from '../types/people';
import { enqueueClaudeCall } from './apiQueue';

export interface PersonAnalysis {
  trustTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  riskFlags: string[];
  strengths: string[];
  concerns: string[];
  suggestedTopics: string[];
  summary: string;
}

export async function analyzePerson(
  settings: AppSettings,
  person: PersonRecord,
  interactions: PersonInteraction[],
  recentDays = 90,
): Promise<PersonAnalysis> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - recentDays);
  const recent = interactions.filter(i => new Date(i.date) >= cutoff);
  const all = interactions.slice(0, 30); // cap to avoid token overflow

  const systemPrompt = `あなたは人間関係とビジネスコミュニケーションの分析エキスパートです。
与えられた人物との交流履歴を分析し、JSON形式で関係性のインサイトを返してください。

レスポンスは必ず以下のJSONのみを返してください:
{
  "trustTrend": "improving" | "stable" | "declining" | "unknown",
  "riskFlags": ["リスク1", ...],
  "strengths": ["強み・好ましい点1", ...],
  "concerns": ["懸念点1", ...],
  "suggestedTopics": ["次の1on1で話すべきトピック1", "トピック2", "トピック3"],
  "summary": "100字以内の関係性サマリ"
}`;

  const userPrompt = `## 対象人物
名前: ${person.name}
${person.role ? `役職: ${person.role}` : ''}
${person.company ? `会社: ${person.company}` : ''}
${person.notes ? `メモ: ${person.notes}` : ''}

## 直近 ${recentDays} 日間の交流 (${recent.length}件)
${recent.map(i =>
  `- [${i.date}] ${i.type}: ${i.summary}${i.sentiment ? ` (センチメント: ${i.sentiment})` : ''}`
).join('\n') || '交流記録なし'}

## 全交流履歴サマリ (最新${all.length}件)
${all.map(i => `- [${i.date}] ${i.type}: ${i.summary}`).join('\n') || '記録なし'}

上記を踏まえ、JSONを返してください。`;

  return enqueueClaudeCall(async () => {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Claude API error ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON が見つかりません');
    return JSON.parse(match[0]) as PersonAnalysis;
  });
}
