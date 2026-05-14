// ============================================================
// note / X 投稿の AI 下書き生成 (人格・ナレッジ・トーン考慮)
// ============================================================
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';

export type SocialTone = 'professional' | 'casual' | 'promotional' | 'storytelling' | 'educational';
export type ContentType = 'note-article' | 'x-single' | 'x-thread';

export interface SocialDraft {
  platform: 'note' | 'x';
  contentType: ContentType;
  title?: string;          // note のみ
  body: string;            // note: Markdown / X-single: tweet text / X-thread: full text
  posts?: string[];        // X-thread の場合 投稿の配列
  tags: string[];          // ハッシュタグ または カテゴリタグ
  hookLine?: string;       // 1行のキャッチコピー (note のサブタイトル用)
  estimatedReadMin?: number;
  generatedAt: string;
}

const TONE_LABEL: Record<SocialTone, string> = {
  professional: 'プロフェッショナル / 報告調',
  casual: 'カジュアル / フランク',
  promotional: 'プロモーション / マーケティング',
  storytelling: 'ストーリーテリング / 体験談',
  educational: 'ティーチング / 学び共有',
};

const TONE_GUIDANCE: Record<SocialTone, string> = {
  professional: '敬体・論理的で簡潔。数値・期日・固有名詞を必ず含める。装飾は最小限。',
  casual: 'です/ます調でフランク。絵文字は1〜3個まで。読者と距離が近い文体。',
  promotional: '読者の利益を冒頭で明示。CTAを末尾に必ず。煽り過ぎない。',
  storytelling: '一人称で具体的なエピソード。情景描写と感情の起伏。',
  educational: '結論先出し → 理由 → 具体例。表形式や箇条書きで知識を整理。',
};

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

function buildKnowledgeContext(items: KnowledgeItem[]): string {
  if (items.length === 0) return '';
  return items.slice(0, 5).map((k, i) => {
    const sum = k.analysis?.summary || k.content.slice(0, 400);
    return `[資料${i + 1}: ${k.title}]\n${sum}`;
  }).join('\n\n');
}

export async function generateNoteArticle(opts: {
  settings: AppSettings;
  persona: Persona;
  topic: string;
  tone: SocialTone;
  knowledge?: KnowledgeItem[];
  targetWords?: number; // 800-3000
  customInstruction?: string;
}): Promise<SocialDraft> {
  const apiKey = getApiKey(opts.settings);
  const targetWords = opts.targetWords || 1500;

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) として、note.com に公開する記事を執筆します。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## トーン
${TONE_LABEL[opts.tone]} — ${TONE_GUIDANCE[opts.tone]}

## 出力フォーマット (JSON のみ、コードブロック・説明文なし)
{
  "title": "${targetWords < 1200 ? '20-30' : '25-40'}字の見出し (本文を読みたくなるフックのある日本語)",
  "hookLine": "サブタイトル / リード文 1行 (60文字以内)",
  "body": "Markdown 本文 (見出し ## / 太字 ** / リスト - / 引用 > / コード \\\` を活用)",
  "tags": ["ハッシュタグ的なカテゴリタグ", ...] (3-6個、note の検索に使われる),
  "estimatedReadMin": 推定読了分数 (number)
}

## 執筆ルール
- 本文は ${targetWords} 字程度。冗長禁止
- 冒頭に読者の利益を明示 (この記事を読むと何が分かるか)
- 具体例・数値・固有名詞で抽象論を避ける
- 末尾に 1-2行の問いかけ or アクションを入れて余韻を残す
- 見出しは ## レベルを使い、3-5個に分割
- 不確かなことは断定しない、推測なら「〜のはずだ」と明示`;

  const knowledgeBlock = buildKnowledgeContext(opts.knowledge || []);

  const userPrompt = `## 今回の記事テーマ
${opts.topic}

${knowledgeBlock ? `## 参照ナレッジ\n${knowledgeBlock}\n` : ''}
${opts.customInstruction ? `## 追加指示\n${opts.customInstruction}\n` : ''}

上記を踏まえて、note 記事の下書きを JSON で返してください。`;

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
        model: opts.settings.preferredModel,
        max_tokens: 4096,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `note 記事生成エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { title: '記事', hookLine: '', body: text, tags: [], estimatedReadMin: 5 };
  }

  return {
    platform: 'note',
    contentType: 'note-article',
    title: parsed.title || 'タイトル未設定',
    hookLine: parsed.hookLine || '',
    body: parsed.body || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    estimatedReadMin: Number(parsed.estimatedReadMin) || 5,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateXPost(opts: {
  settings: AppSettings;
  persona: Persona;
  topic: string;
  tone: SocialTone;
  knowledge?: KnowledgeItem[];
  threadCount?: number; // 1=single, 2-10=thread
  customInstruction?: string;
}): Promise<SocialDraft> {
  const apiKey = getApiKey(opts.settings);
  const threadCount = Math.max(1, Math.min(10, opts.threadCount || 1));
  const isThread = threadCount > 1;

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) として X (旧 Twitter) に投稿します。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## トーン
${TONE_LABEL[opts.tone]} — ${TONE_GUIDANCE[opts.tone]}

## 出力フォーマット (JSON のみ)
${isThread ? `{
  "posts": ["1ツイート目 (140字以内)", "2/${threadCount}", ..., "${threadCount}/${threadCount}"],
  "tags": ["ハッシュタグ#つき", ...] 0-3個
}` : `{
  "body": "1ツイートの本文 (140字以内、改行可)",
  "tags": ["ハッシュタグ#つき", ...] 0-3個
}`}

## 投稿ルール
- 1ツイート 140字以内 (日本語の場合)。${isThread ? `スレッドは合計${threadCount}本` : ''}
- 冒頭の1行で読者を止める (フック必須)
- 数字・固有名詞・期日でリアリティを出す
- 過度な絵文字禁止 (1-2個まで)
- 抽象論禁止。実体験・実数値・実プロダクトのいずれかが入っていること
${isThread ? `- スレッド先頭で全体の主張を提示、各ツイートは独立しても意味が通るように
- 末尾はアクション or 問いかけで締めくくる` : ''}
- ハッシュタグは多用しない (0〜3個、本当に効果のあるもののみ)`;

  const knowledgeBlock = buildKnowledgeContext(opts.knowledge || []);

  const userPrompt = `## 投稿テーマ
${opts.topic}

${knowledgeBlock ? `## 参照ナレッジ\n${knowledgeBlock}\n` : ''}
${opts.customInstruction ? `## 追加指示\n${opts.customInstruction}\n` : ''}

${isThread ? `${threadCount}本のスレッド` : '1ツイート'}を JSON で返してください。`;

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
        model: opts.settings.preferredModel,
        max_tokens: 2048,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `X 投稿生成エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = isThread ? { posts: [text.slice(0, 140)] } : { body: text.slice(0, 140) };
  }

  if (isThread) {
    const posts = (Array.isArray(parsed.posts) ? parsed.posts : []).map((p: any) => String(p || '').slice(0, 280));
    return {
      platform: 'x',
      contentType: 'x-thread',
      body: posts.join('\n\n'),
      posts,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      generatedAt: new Date().toISOString(),
    };
  }
  return {
    platform: 'x',
    contentType: 'x-single',
    body: String(parsed.body || '').slice(0, 280),
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    generatedAt: new Date().toISOString(),
  };
}

export const TONE_OPTIONS: { value: SocialTone; label: string; emoji: string }[] = [
  { value: 'professional', label: 'プロ', emoji: '💼' },
  { value: 'casual',       label: 'カジュアル', emoji: '☕' },
  { value: 'promotional',  label: 'プロモ', emoji: '📣' },
  { value: 'storytelling', label: 'ストーリー', emoji: '📖' },
  { value: 'educational',  label: '学び共有', emoji: '🎓' },
];
