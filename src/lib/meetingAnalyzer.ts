// ============================================================
// 議事録 AI — 音声/動画/テキストの議事録から構造化議事録を生成
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';
import { aiFetch } from './aiFetch';

// API キーは main.tsx の interceptor が localStorage から自動付与

export interface MeetingChapter {
  title: string;             // 章タイトル (短く・話題の要約)
  timeRange?: string;        // 例: "00:00–07:30" / 推定でOK・なければ空
  points: string[];          // 章の要点 2-5 件
}

export interface SpeakerContribution {
  totalMin?: number;         // 発話時間 (推定・分)
  keyPoints: string[];       // この人が言った要点 2-4 件
}

export interface MeetingMinutes {
  title: string;             // 自動生成タイトル
  date: string;              // ISO
  durationMin?: number;      // 推定時間
  participants: string[];    // 参加者
  summary: string;           // 全体要約 (3-5行)
  chapters: MeetingChapter[];                          // 章立て (30分以上で活躍)
  agenda: { topic: string; discussion: string }[];     // 議題ごとの議論要約
  decisions: string[];       // 決定事項
  actions: { item: string; owner?: string; due?: string }[]; // アクション
  speakerSummary: Record<string, SpeakerContribution>; // 発言者ごとの寄与サマリ
  questions: { q: string; a: string }[]; // Q&A
  nextSteps: string[];       // 次回確認事項
  nextAgenda: string[];      // 次回アジェンダ提案 (3-5 件)
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
  "chapters": [
    { "title": "章タイトル (短く・話題の核)", "timeRange": "00:00–07:30 (推定、わからなければ空)", "points": ["要点1", "要点2"] }
  ],
  "agenda": [
    { "topic": "議題", "discussion": "どんな話があったか 2〜4行" }
  ],
  "decisions": ["決まったこと1", "決まったこと2"],
  "actions": [
    { "item": "やること", "owner": "誰が or 不明", "due": "いつまでに or 不明" }
  ],
  "speakerSummary": {
    "発言者名": { "totalMin": 推定発話時間 (number), "keyPoints": ["この人が言った要点1", "要点2"] }
  },
  "questions": [
    { "q": "質問", "a": "答え or 持ち帰り or 未回答" }
  ],
  "nextSteps": ["次回までに確認したいこと1"],
  "nextAgenda": ["次回の議題候補1 (今回の議論の延長線)", "候補2", "候補3"],
  "insights": ["この役割の人として大事な気づき1"],
  "risks": ["気をつけたいこと1"]
}

${toneInstruction(tone)}

## 大事なルール
- 推測でなく、文字起こしに書かれていることだけを書く。
- 人名・役職・日付・数字は元の表現のまま。
- "chapters" は会議の流れを 3〜8 章に区切る。短い会議でも最低 2 章。話題が変わる位置で分ける。
- "agenda" は最大 8 件まで。話題ごとに1つ。
- "actions" は「やる」と明確に言われたものだけ。誰がやるか明確なら owner に名前を入れる (「不明」より名前を優先)。
- "speakerSummary" は文字起こしから発言者名を抽出。「話者1」「話者2」表記もそのままキーに使う。発言が1〜2行しか無い人は keyPoints を1件で良い。
- "nextAgenda" は 3〜5 件。「今回決まらなかったこと」「次回掘り下げるべき論点」を中心に。
- "insights" は、この役割 (役職・専門分野) の人にとって重要な気づきを書く。`;
}

export async function analyzeMeeting(
  settings: AppSettings,
  persona: Persona,
  transcript: string,
  meta?: { title?: string; participants?: string[]; date?: string; signal?: AbortSignal }
): Promise<MeetingMinutes> {
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

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 4096,
        system: buildSys(settings.aiTone),
        messages: [{ role: 'user', content: userText }],
      }),
      signal: meta?.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `議事録 API エラー: ${res.status}`);
    }
    return res.json();
  });
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

  // speakerSummary は object なのでサニタイズ
  const rawSpeakers = (parsed as any).speakerSummary;
  const speakerSummary: Record<string, SpeakerContribution> = {};
  if (rawSpeakers && typeof rawSpeakers === 'object' && !Array.isArray(rawSpeakers)) {
    for (const [name, v] of Object.entries(rawSpeakers)) {
      if (!name || typeof v !== 'object' || v == null) continue;
      const vv = v as any;
      speakerSummary[name] = {
        totalMin: typeof vv.totalMin === 'number' ? vv.totalMin : undefined,
        keyPoints: Array.isArray(vv.keyPoints) ? vv.keyPoints.filter((x: any) => typeof x === 'string') : [],
      };
    }
  }

  return {
    title: parsed.title || meta?.title || '議事録',
    date: parsed.date || meta?.date || new Date().toISOString(),
    durationMin: parsed.durationMin || 0,
    participants: Array.isArray(parsed.participants) ? parsed.participants : (meta?.participants ?? []),
    summary: parsed.summary || '',
    chapters: Array.isArray(parsed.chapters)
      ? parsed.chapters
          .filter((c: any) => c && typeof c === 'object' && typeof c.title === 'string')
          .map((c: any) => ({
            title: c.title,
            timeRange: typeof c.timeRange === 'string' ? c.timeRange : undefined,
            points: Array.isArray(c.points) ? c.points.filter((p: any) => typeof p === 'string') : [],
          }))
      : [],
    agenda: Array.isArray(parsed.agenda) ? parsed.agenda : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    speakerSummary,
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    nextAgenda: Array.isArray(parsed.nextAgenda) ? parsed.nextAgenda.filter((x: any) => typeof x === 'string') : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * アクション文字列から「担当者」と「タスク本体」を抽出。
 * 例: { item: "資料をまとめる", owner: "田中" } → "田中が資料をまとめる"
 * owner が無い / "不明" の場合は null を返す (= AI 会社に渡さない)
 */
export function extractAssignedActions(m: MeetingMinutes): Array<{ owner: string; item: string }> {
  return m.actions
    .filter(a => a.owner && a.owner !== '不明' && a.item)
    .map(a => ({ owner: a.owner!, item: a.item }));
}

// 議事録を Markdown 形式にエクスポート (Notion 貼付互換)
export function minutesToMarkdown(m: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}`);
  lines.push(`\n**日時**: ${m.date}${m.durationMin ? ` (${m.durationMin}分)` : ''}`);
  if (m.participants.length) lines.push(`**参加者**: ${m.participants.join('、')}`);
  lines.push('\n## 要約\n' + m.summary);

  if (m.chapters.length) {
    lines.push('\n## 章立て');
    m.chapters.forEach((c, i) => {
      const head = c.timeRange ? `${i + 1}. ${c.title} (${c.timeRange})` : `${i + 1}. ${c.title}`;
      lines.push(`\n### ${head}`);
      c.points.forEach(p => lines.push(`- ${p}`));
    });
  }

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
      lines.push(`- [ ] ${a.item}${meta ? ` (${meta})` : ''}`);
    });
  }
  const speakerNames = Object.keys(m.speakerSummary);
  if (speakerNames.length) {
    lines.push('\n## 発言者ごとの要点');
    speakerNames.forEach(name => {
      const s = m.speakerSummary[name];
      const meta = s.totalMin ? ` (約${s.totalMin}分)` : '';
      lines.push(`\n### ${name}${meta}`);
      s.keyPoints.forEach(p => lines.push(`- ${p}`));
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
  if (m.nextAgenda.length) {
    lines.push('\n## 次回アジェンダ提案');
    m.nextAgenda.forEach(n => lines.push(`- ${n}`));
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

// Slack 用に整形 (Slack の mrkdwn は # ヘッダ非対応・* で太字)
export function minutesToSlack(m: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`*📅 ${m.title}*`);
  const head = [m.date, m.durationMin ? `${m.durationMin}分` : '', m.participants.length ? `参加: ${m.participants.join('、')}` : '']
    .filter(Boolean).join(' / ');
  if (head) lines.push(`_${head}_`);
  lines.push('');
  lines.push(`*要約*\n${m.summary}`);

  if (m.decisions.length) {
    lines.push('\n*✅ 決定事項*');
    m.decisions.forEach(d => lines.push(`• ${d}`));
  }
  if (m.actions.length) {
    lines.push('\n*🎯 アクション*');
    m.actions.forEach(a => {
      const meta = [a.owner, a.due].filter(x => x && x !== '不明').join(' / ');
      lines.push(`• ${a.item}${meta ? ` _(${meta})_` : ''}`);
    });
  }
  if (m.nextAgenda.length) {
    lines.push('\n*🗓 次回アジェンダ*');
    m.nextAgenda.forEach(n => lines.push(`• ${n}`));
  }
  if (m.risks.length) {
    lines.push('\n*⚠ リスク*');
    m.risks.forEach(r => lines.push(`• ${r}`));
  }
  return lines.join('\n');
}

// Notion 用は Markdown とほぼ同じだが、Notion は GFM チェックリストに対応するので
// アクションを `- [ ]` で出している minutesToMarkdown をそのまま流用できる。
// ここでは「Notion ページタイトル」を最上行に置く別バリエーションを返す。
export function minutesToNotion(m: MeetingMinutes): string {
  return minutesToMarkdown(m);
}
