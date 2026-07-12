import { aiFetch } from './aiFetch';
// ============================================================
// CORE Prism ▸ Artifact Proposal (テーマ/メモ → そのまま使える一枚成果物の構成)
//
// 思想（Resonance リッチメニュー / Iris カバーと同じ）:
//   AI エージェントが「見出し・要約・アクション・根拠」を構造化提案 →
//   クライアントが Prism ブランドの“美しい一枚成果物（ポスター）”に高精細合成 →
//   PNG / Markdown で書き出し。
//   失敗しても必ず入力に沿った無難な提案を返す（silent fail 禁止）。
// ============================================================

export type ArtifactKind = 'action' | 'meeting' | 'report';

export interface ArtifactProposal {
  /** 上の小ラベル（例: ACTION PLAN / 会議サマリー） */
  kicker: string;
  /** 大見出し */
  title: string;
  /** 1〜2 文の要約 */
  summary: string;
  /** やること / 次の一手（3〜5・各 40 字以内） */
  actions: string[];
  /** 根拠・要点（2〜3・各 48 字以内） */
  rationale: string[];
  /** AI が実際に生成したか */
  ai: boolean;
}

const KIND_META: Record<ArtifactKind, { kicker: string; label: string; guide: string }> = {
  action: { kicker: 'ACTION PLAN', label: 'アクションプラン', guide: '目標やテーマから、今すぐ動ける具体的な手順に落とす。' },
  meeting: { kicker: 'MEETING SUMMARY', label: '会議サマリー', guide: 'メモや議事から、決定事項・次の一手・要点を整理する。' },
  report: { kicker: 'WEEKLY REPORT', label: 'レポート', guide: 'テーマから、成果・状況・次アクションを一枚にまとめる。' },
};

export function kindMeta(k: ArtifactKind) {
  return KIND_META[k];
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last < 0) throw new Error('no json');
  return JSON.parse(body.slice(first, last + 1));
}

function clamp(s: unknown, max: number): string {
  const arr = [...String(s ?? '').replace(/\s+/g, ' ').trim()];
  return arr.length > max ? arr.slice(0, max).join('') : arr.join('');
}

function listClamp(v: unknown, max: number, each: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => clamp(x, each)).filter((x) => x.length > 0).slice(0, max);
}

function fallback(topic: string, kind: ArtifactKind): ArtifactProposal {
  const m = KIND_META[kind];
  const t = topic.trim();
  return {
    kicker: m.kicker,
    title: clamp(t, 28) || m.label,
    summary: `${m.label}：${t || 'テーマ'} を、今日から動ける形に整理しました。`,
    actions: ['今日やる一手を1つ決める', '担当と期日を決める', '関係者に共有する'],
    rationale: ['まず小さく始めて勢いをつける', '期日があると前に進む'],
    ai: false,
  };
}

function buildSystem(kind: ArtifactKind): string {
  const m = KIND_META[kind];
  return `あなたは一流の経営参謀です。${m.guide}
やさしい日本語で、専門用語や横文字は避け、誰でもすぐ動ける具体性で書きます。

出力ルール:
- kicker: 上の小ラベル（英大文字 or 短い和語）。16文字以内。
- title: 大見出し。28文字以内。一目で内容が分かる。
- summary: 1〜2文の要約。70文字以内。
- actions: やること/次の一手を3〜5個。各40文字以内。動詞で始め、できれば担当や期日の感覚を含める。
- rationale: 根拠・要点を2〜3個。各48文字以内。

出力は必ず JSON のみ、それ以外の文字を一切含めない:
{"kicker":"...","title":"...","summary":"...","actions":["...","..."],"rationale":["...","..."]}`;
}

export async function generateArtifact(topic: string, kind: ArtifactKind): Promise<ArtifactProposal> {
  if (!topic || !topic.trim()) {
    throw new Error('テーマや会議メモを入力してください（例: 来週の新商品ローンチ準備）');
  }

  let res: Response;
  try {
    res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1100,
        system: buildSystem(kind),
        messages: [{ role: 'user', content: `テーマ/メモ:\n${topic.trim()}\n\n上記から${KIND_META[kind].label}を JSON で返してください。` }],
      }),
    });
  } catch {
    return fallback(topic, kind);
  }

  if (!res.ok) return fallback(topic, kind);

  let text = '';
  try {
    const data = await res.json();
    text = data?.content?.[0]?.text ?? '';
  } catch {
    return fallback(topic, kind);
  }
  if (!text) return fallback(topic, kind);

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch {
    return fallback(topic, kind);
  }

  const actions = listClamp(parsed.actions, 5, 40);
  const rationale = listClamp(parsed.rationale, 3, 48);
  const fb = fallback(topic, kind);

  return {
    kicker: clamp(parsed.kicker, 16) || fb.kicker,
    title: clamp(parsed.title, 28) || fb.title,
    summary: clamp(parsed.summary, 70) || fb.summary,
    actions: actions.length ? actions : fb.actions,
    rationale: rationale.length ? rationale : fb.rationale,
    ai: true,
  };
}

/** 成果物を Markdown 文字列に整形（コピー / .md ダウンロード用）。 */
export function artifactToMarkdown(a: ArtifactProposal): string {
  const lines: string[] = [];
  lines.push(`# ${a.title}`);
  lines.push('');
  lines.push(a.summary);
  if (a.actions.length) {
    lines.push('');
    lines.push('## やること');
    a.actions.forEach((x, i) => lines.push(`${i + 1}. ${x}`));
  }
  if (a.rationale.length) {
    lines.push('');
    lines.push('## 根拠・要点');
    a.rationale.forEach((x) => lines.push(`- ${x}`));
  }
  lines.push('');
  lines.push('---');
  lines.push('Generated with CORE Prism');
  return lines.join('\n');
}
