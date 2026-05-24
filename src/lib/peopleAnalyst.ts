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

/** 1on1 アジェンダ — 5 ブロック構造 */
export interface OneOnOneAgenda {
  /** 冒頭の雑談 (アイスブレイク 1 文) */
  smallTalk: string[];
  /** 進捗確認 */
  progressCheck: string[];
  /** 課題 / 困りごと */
  challenges: string[];
  /** 次の一歩 (合意する具体アクション) */
  nextSteps: string[];
  /** フィードバック (相手に伝える観察 / 称賛) */
  feedback: string[];
  /** 久しぶり連絡用のオープニング (任意) — 30 日以上連絡なし時に出す */
  reopenScript?: string;
}

/** 連絡頻度が空いている時の「最近どうですか?」スクリプト */
export interface ReopenScript {
  subject: string;
  body: string;
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
    // Anthropic 直叩き → /api/ai 経由 (env Gemini fallback / master ルーティング / CORS 安全)
    // API キーは main.tsx interceptor が自動付与
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5',
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

// ============================================================
// 1on1 アジェンダ生成
//   過去のやり取り + 関係を context に、Claude が 5 ブロック JSON を返す
//   個人特定情報 (連絡先など) は AI に送らない (名前と役職のみ)
// ============================================================
export async function buildOneOnOneAgenda(
  settings: AppSettings,
  person: PersonRecord,
  interactions: PersonInteraction[],
  ctx?: {
    daysSinceContact?: number;
    personaName?: string;
    recentAgentTaskTitles?: string[];
  },
): Promise<OneOnOneAgenda> {
  const recent = interactions.slice(0, 8); // 最新 8 件で十分
  const sys = `あなたは 1on1 設計のプロフェッショナルです。
これからユーザー (上司 / パートナー / メンター) が「${person.name}」さんと 1on1 を行います。
過去のやり取りと文脈をもとに、心理的安全を保ちながら本音に届く 1on1 アジェンダを 5 ブロック JSON で返してください。

出力 JSON 形式 (これ以外の文字を返さない):
{
  "smallTalk":      ["冒頭の雑談ネタを 1-2 個 (相手の興味 / 季節 / 直近の出来事)"],
  "progressCheck":  ["前回からの進捗を確認する問い 2-3 個"],
  "challenges":     ["相手が抱えている課題 / 困りごとを引き出す問い 2-3 個"],
  "nextSteps":      ["合意して次までにやる具体アクション候補 2-3 個"],
  "feedback":       ["こちらから伝える観察 / 称賛 / 期待 2-3 個"],
  "reopenScript":   "(任意) 30日以上連絡が空いた場合の冒頭スクリプト (任意 / 無ければ省略)"
}

すべて日本語、1 行 60 字以内。押し付け禁止、相手中心、共感的に。`;

  const ctxLines: string[] = [];
  if (ctx?.personaName) ctxLines.push(`あなた側の役割 / プロジェクト: ${ctx.personaName}`);
  if (ctx?.daysSinceContact != null) ctxLines.push(`前回連絡から: ${ctx.daysSinceContact} 日`);
  if (ctx?.recentAgentTaskTitles && ctx.recentAgentTaskTitles.length > 0) {
    ctxLines.push(`最近の自分側のタスク: ${ctx.recentAgentTaskTitles.slice(0, 5).join(' / ')}`);
  }

  const userPrompt = `## 対象人物
名前: ${person.name}
${person.role ? `役職: ${person.role}` : ''}
${person.company ? `会社: ${person.company}` : ''}
${person.tags && person.tags.length > 0 ? `タグ: ${person.tags.join(', ')}` : ''}
${person.notes ? `自由メモ: ${person.notes}` : ''}

## 文脈
${ctxLines.join('\n') || '(特記なし)'}

## 直近のやり取り (新しい順, 最大 8 件)
${recent.map(i =>
    `- [${i.date}] ${i.type}: ${i.summary}${i.sentiment ? ` (${i.sentiment})` : ''}${i.nextTopics && i.nextTopics.length > 0 ? ` / 次回:${i.nextTopics.join('、')}` : ''}`
  ).join('\n') || '(やり取り記録なし)'}

上の人物像と履歴を踏まえ、5 ブロックの 1on1 アジェンダ JSON を返してください。`;

  return enqueueClaudeCall(async () => {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5',
        max_tokens: 1200,
        system: sys,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI エラー ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 出力 JSON が見つかりません');
    const parsed = JSON.parse(match[0]);
    return {
      smallTalk:     Array.isArray(parsed.smallTalk)     ? parsed.smallTalk     : [],
      progressCheck: Array.isArray(parsed.progressCheck) ? parsed.progressCheck : [],
      challenges:    Array.isArray(parsed.challenges)    ? parsed.challenges    : [],
      nextSteps:     Array.isArray(parsed.nextSteps)     ? parsed.nextSteps     : [],
      feedback:      Array.isArray(parsed.feedback)      ? parsed.feedback      : [],
      reopenScript:  typeof parsed.reopenScript === 'string' ? parsed.reopenScript : undefined,
    } as OneOnOneAgenda;
  });
}

// ============================================================
// 「最近どうですか?」スクリプト — 30 日以上連絡なしで使う
// ============================================================
export async function buildReopenScript(
  settings: AppSettings,
  person: PersonRecord,
  interactions: PersonInteraction[],
  daysSinceContact: number,
): Promise<ReopenScript> {
  const lastTopic = interactions[0]?.summary || '';
  const sys = `あなたは久しぶりに連絡を取りたい相手へ「圧をかけず、軽やかに、温かく」声をかける文章のプロです。
出力は JSON のみ:
{ "subject": "件名 (20字以内 / 重くしすぎない)", "body": "本文 80-160字 / 質問は 1 つだけ / 押し売り禁止" }`;
  const userPrompt = `## 相手
${person.name}${person.role ? ` (${person.role})` : ''}${person.company ? ` / ${person.company}` : ''}
最後の話題: ${lastTopic || '(記録なし)'}
最終接触: ${daysSinceContact} 日前

「最近どうですか?」を軽やかに送る文を 1 通作ってください。`;

  return enqueueClaudeCall(async () => {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5',
        max_tokens: 500,
        system: sys,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!resp.ok) throw new Error(`AI エラー ${resp.status}`);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 出力 JSON が見つかりません');
    const parsed = JSON.parse(match[0]);
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject : '最近どうですか?',
      body:    typeof parsed.body    === 'string' ? parsed.body    : '',
    };
  });
}
