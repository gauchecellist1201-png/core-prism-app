// ============================================================
// 議事録 AI — 音声/動画/テキストの議事録から構造化議事録を生成
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import { toneInstruction } from './aiTone';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export interface MeetingMinutes {
  title: string;             // 自動生成タイトル
  date: string;              // ISO
  durationMin?: number;      // 推定時間
  participants: string[];    // 参加者
  summary: string;           // 全体要約 (3-5行)
  agenda: { topic: string; discussion: string }[]; // 議題ごとの議論要約
  decisions: string[];       // 決定事項
  actions: { item: string; owner?: string; due?: string }[]; // アクション
  questions: { q: string; a: string }[]; // Q&A
  nextSteps: string[];       // 次回確認事項
  insights: string[];        // 戦略的インサイト (人格コンテキスト)
  risks: string[];           // 検出されたリスク
  generatedAt: string;
}

function buildSys(tone?: 'gentle' | 'professional' | 'casual'): string {
  return `あなたは「会議に出てなかった人でも一目で分かる」議事録を書く秘書です。
会議の文字起こしから、読みやすく整理された議事録を作ります。

返答は **JSONのみ** (コードブロック・説明文なし)。スキーマ:
{
  "title": "会議タイトル (10〜30文字、内容を反映)",
  "date": "YYYY-MM-DD HH:MM (テキストから推定、なければ今日)",
  "durationMin": 推定時間 (number、不明なら 0),
  "participants": ["参加者A", "参加者B"],
  "summary": "全体の話を3〜5行で。何を話して、何が決まったか",
  "agenda": [
    { "topic": "議題", "discussion": "どんな話があったか 2〜4行" }
  ],
  "decisions": ["決まったこと1", "決まったこと2"],
  "actions": [
    { "item": "やること", "owner": "誰が or 不明", "due": "いつまでに or 不明" }
  ],
  "questions": [
    { "q": "質問", "a": "答え or 持ち帰り or 未回答" }
  ],
  "nextSteps": ["次回までに確認したいこと1"],
  "insights": ["この役割の人として大事な気づき1"],
  "risks": ["気をつけたいこと1"]
}

${toneInstruction(tone)}

## 大事なルール
- 推測でなく、文字起こしに書かれていることだけを書く。
- 人名・役職・日付・数字は元の表現のまま。
- "agenda" は最大 8 件まで。話題ごとに1つ。
- "actions" は「やる」と明確に言われたものだけ。期限も明記されたものだけ。
- "insights" は、この役割 (役職・専門分野) の人にとって重要な気づきを書く。`;
}

export async function analyzeMeeting(
  settings: AppSettings,
  persona: Persona,
  transcript: string,
  meta?: { title?: string; participants?: string[]; date?: string }
): Promise<MeetingMinutes> {
  const apiKey = getApiKey(settings);
  if (!transcript.trim()) throw new Error('議事録の入力が空です');

  const truncated = transcript.length > 50000 ? transcript.slice(0, 50000) + '\n\n[...以降省略]' : transcript;

  const userText = `## 人格コンテキスト
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 既知のメタ情報
${meta?.title ? `- 仮タイトル: ${meta.title}` : ''}
${meta?.date ? `- 日時: ${meta.date}` : ''}
${meta?.participants?.length ? `- 参加者: ${meta.participants.join(', ')}` : ''}

## 文字起こし / メモ
${truncated}

上記の会議内容を構造化議事録に変換してください。`;

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
      system: buildSys(settings.aiTone),
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `議事録 API エラー: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  let parsed: Partial<MeetingMinutes> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = {
      title: meta?.title || '議事録',
      summary: text.slice(0, 400),
    };
  }

  return {
    title: parsed.title || meta?.title || '議事録',
    date: parsed.date || meta?.date || new Date().toISOString(),
    durationMin: parsed.durationMin || 0,
    participants: Array.isArray(parsed.participants) ? parsed.participants : (meta?.participants ?? []),
    summary: parsed.summary || '',
    agenda: Array.isArray(parsed.agenda) ? parsed.agenda : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    generatedAt: new Date().toISOString(),
  };
}

// 議事録を Markdown 形式にエクスポート
export function minutesToMarkdown(m: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}`);
  lines.push(`\n**日時**: ${m.date}${m.durationMin ? ` (${m.durationMin}分)` : ''}`);
  if (m.participants.length) lines.push(`**参加者**: ${m.participants.join('、')}`);
  lines.push('\n## 要約\n' + m.summary);

  if (m.agenda.length) {
    lines.push('\n## 議題');
    m.agenda.forEach((a, i) => {
      lines.push(`\n### ${i + 1}. ${a.topic}`);
      lines.push(a.discussion);
    });
  }
  if (m.decisions.length) {
    lines.push('\n## 決定事項');
    m.decisions.forEach(d => lines.push(`- ${d}`));
  }
  if (m.actions.length) {
    lines.push('\n## アクション');
    m.actions.forEach(a => {
      const meta = [a.owner, a.due].filter(Boolean).join(' / ');
      lines.push(`- ${a.item}${meta ? ` (${meta})` : ''}`);
    });
  }
  if (m.questions.length) {
    lines.push('\n## Q&A');
    m.questions.forEach(q => {
      lines.push(`- **Q**: ${q.q}`);
      lines.push(`  - **A**: ${q.a}`);
    });
  }
  if (m.nextSteps.length) {
    lines.push('\n## 次回確認事項');
    m.nextSteps.forEach(n => lines.push(`- ${n}`));
  }
  if (m.insights.length) {
    lines.push('\n## 戦略的インサイト');
    m.insights.forEach(i => lines.push(`- ${i}`));
  }
  if (m.risks.length) {
    lines.push('\n## リスク・懸念');
    m.risks.forEach(r => lines.push(`- ${r}`));
  }

  return lines.join('\n');
}
