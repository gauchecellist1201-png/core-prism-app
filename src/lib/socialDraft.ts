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

// API キーは main.tsx の interceptor が localStorage から自動付与

function buildKnowledgeContext(items: KnowledgeItem[]): string {
  if (items.length === 0) return '';
  return items.slice(0, 5).map((k, i) => {
    const sum = k.analysis?.summary || k.content.slice(0, 400);
    return `[資料${i + 1}: ${k.title}]\n${sum}`;
  }).join('\n\n');
}

// ─── 先回り提案: AI がナレッジから「次の投稿テーマ」を 3 案先出し ───
export interface ContentTopicProposal {
  title: string;       // 提案する投稿タイトル (そのままテーマに使える)
  hook: string;        // どんな切り口の投稿になるか (1〜2文)
  tone: SocialTone;
  reason: string;      // AI がこのテーマを選んだ理由
}

export async function proposeContentTopics(opts: {
  settings: AppSettings;
  persona: Persona;
  knowledge?: KnowledgeItem[];
}): Promise<ContentTopicProposal[]> {
  const kbCtx = buildKnowledgeContext(opts.knowledge || []);

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) の発信を支える編集者です。
ユーザーは何も入力しません。あなたが先回りで「次にこの投稿はどうですか?」を 3 案提案します。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## 出力フォーマット (JSON のみ、コードブロック・説明文なし)
{
  "proposals": [
    {
      "title": "そのまま投稿テーマに使える 20〜35字の日本語",
      "hook": "どんな切り口・読後感の投稿になるか (1〜2文)",
      "tone": "professional | casual | promotional | storytelling | educational",
      "reason": "なぜ今この投稿を勧めるか (ナレッジや人格を根拠に 1文)"
    }
  ]
}

## ルール
- 3 案。切り口を散らす (体験談 / 学び共有 / 主張 など)。
- ナレッジがあればその中身を根拠にする。なければ人格の役割から発想する。
- やさしい日本語。専門用語は避ける。`;

  const userMsg = kbCtx
    ? `## 最近のナレッジ\n${kbCtx}\n\n上記をもとに、次に発信すると良い投稿を 3 案提案してください。`
    : `ナレッジはまだありません。${opts.persona.name} の役割から、発信すると良い投稿を 3 案提案してください。`;

  return enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1200,
        system: SYS,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `テーマ提案 API ${res.status}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    let parsed: any = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : text);
    } catch { /* ignore */ }
    const valid: SocialTone[] = ['professional', 'casual', 'promotional', 'storytelling', 'educational'];
    const list: any[] = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    return list.slice(0, 3).map((p) => ({
      title: String(p.title || '').trim(),
      hook: String(p.hook || '').trim(),
      tone: (valid.includes(p.tone) ? p.tone : 'storytelling') as SocialTone,
      reason: String(p.reason || '').trim(),
    })).filter((p) => p.title);
  });
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

// ============================================================
// マルチプラットフォーム同時生成 — 1 テーマから 6 SNS の最適化下書き
// ============================================================

export type SocialPlatform = 'x' | 'threads' | 'instagram' | 'linkedin' | 'note' | 'facebook';

export interface PlatformMeta {
  id: SocialPlatform;
  label: string;
  emoji: string;
  color: string;
  /** 文字数の目安 (UI 表示用) */
  charBudget: number;
  /** どんな書き口に最適化するか (生成プロンプト用) */
  hint: string;
  /** 投稿 URL (intent / 編集画面など) */
  postUrl?: (text: string) => string;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  x: {
    id: 'x', label: 'X (Twitter)', emoji: '𝕏', color: '#000000', charBudget: 280,
    hint: '140字以内が日本語。冒頭1行で止める。改行 OK。ハッシュタグ最大2個。',
    postUrl: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
  },
  threads: {
    id: 'threads', label: 'Threads', emoji: '🧵', color: '#101010', charBudget: 500,
    hint: '500字まで。X より少し長く、ゆるい会話調 OK。語尾を口語に。',
    postUrl: (t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(t)}`,
  },
  instagram: {
    id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C', charBudget: 2200,
    hint: 'キャプション。冒頭3行で続きを読ませる。絵文字多めOK。ハッシュタグは末尾にまとめて 8-15 個。',
  },
  linkedin: {
    id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2', charBudget: 1300,
    hint: 'プロフェッショナル文体。具体的な数字と実績。学び/洞察を共有。改行で読みやすく。ハッシュタグ末尾 3-5 個。',
    postUrl: (t) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}`,
  },
  note: {
    id: 'note', label: 'note (短文)', emoji: '📝', color: '#41C9B4', charBudget: 600,
    hint: 'note のつぶやき的短文。エッセイ調で言い切る。記事への導線として。',
  },
  facebook: {
    id: 'facebook', label: 'Facebook', emoji: '📘', color: '#1877F2', charBudget: 800,
    hint: '友人/顧客向け会話調。物語性と実体験を重視。ハッシュタグ控えめ。',
    postUrl: (t) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://core-prism-app.vercel.app')}&quote=${encodeURIComponent(t)}`,
  },
};

export const ALL_PLATFORMS: SocialPlatform[] = ['x', 'threads', 'instagram', 'linkedin', 'note', 'facebook'];

export interface MultiPlatformDraft {
  topic: string;
  tone: SocialTone;
  hashtags: string[];
  posts: Record<SocialPlatform, string>;
  generatedAt: string;
}

export async function generateMultiPlatformPost(opts: {
  settings: AppSettings;
  persona: Persona;
  topic: string;
  tone: SocialTone;
  knowledge?: KnowledgeItem[];
  platforms?: SocialPlatform[];
  customInstruction?: string;
}): Promise<MultiPlatformDraft> {
  const platforms = opts.platforms && opts.platforms.length > 0 ? opts.platforms : ALL_PLATFORMS;
  const kbCtx = buildKnowledgeContext(opts.knowledge || []);

  const platformSpec = platforms.map(p => {
    const m = PLATFORM_META[p];
    return `- ${m.id} (${m.label}, 上限 ${m.charBudget}字): ${m.hint}`;
  }).join('\n');

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) の SNS 戦略担当です。
1 つのテーマから、${platforms.length} 個の SNS プラットフォーム向けに最適化された投稿文を「同時に」作ります。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## トーン
${TONE_LABEL[opts.tone]} — ${TONE_GUIDANCE[opts.tone]}

## 各プラットフォームの仕様
${platformSpec}

## 出力フォーマット (JSON のみ、コードブロック・説明文なし)
{
  "hashtags": ["...", ...] (テーマに合う実用的なハッシュタグ 5-10 個、# 抜きの語のみ),
  "posts": {
${platforms.map(p => `    "${p}": "そのプラットフォーム用の本文 (上限文字数厳守、改行 OK)"`).join(',\n')}
  }
}

## 必須ルール
- 全プラットフォームで「同じ主張・同じ核」を共有しつつ、文体と長さは各プラットフォーム最適化
- どの投稿も冒頭1行で読者を止めるフックを入れる
- 数字・固有名詞・実体験で抽象論を避ける
- 過度な絵文字禁止 (X/LinkedIn は 0-2 個、Instagram/Facebook は 3-5 個まで)
- ハッシュタグはトレンドではなくニッチで実効性の高い語を選ぶ`;

  const userPrompt = `## 今回のテーマ
${opts.topic}

${kbCtx ? `## 参照ナレッジ\n${kbCtx}\n` : ''}
${opts.customInstruction ? `## 追加指示\n${opts.customInstruction}\n` : ''}

上記を踏まえて、${platforms.length} プラットフォーム分の投稿文 + ハッシュタグを JSON で返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 4096,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `マルチ投稿生成エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { hashtags: [], posts: {} };
  }

  const posts: Record<SocialPlatform, string> = {} as any;
  for (const p of ALL_PLATFORMS) {
    const raw = String(parsed.posts?.[p] ?? '').trim();
    const budget = PLATFORM_META[p].charBudget;
    posts[p] = raw.length > budget ? raw.slice(0, budget) : raw;
  }

  return {
    topic: opts.topic,
    tone: opts.tone,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 12).map(String) : [],
    posts,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// ハッシュタグ単独提案 (テーマからトレンド系 + ニッチ系を混ぜて)
// ============================================================

export async function suggestHashtags(opts: {
  settings: AppSettings;
  persona: Persona;
  topic: string;
  count?: number;
}): Promise<string[]> {
  const count = opts.count || 10;
  const SYS = `あなたは SNS マーケの専門家。テーマに合う実効性の高い日本語ハッシュタグを提案します。
出力は JSON のみ: { "tags": ["タグ1", "タグ2", ...] }
- # は付けない、語のみ
- ${count} 個。
- 半分はニッチ (検索者は少ないが意図が合致)、半分は中堅 (月数千〜数万投稿規模)。
- 流行り言葉/煽り語/英語の汎用語 (#love #photooftheday 等) は禁止`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 600,
        system: SYS,
        messages: [{ role: 'user', content: `テーマ: ${opts.topic}\n投稿者: ${opts.persona.name} (${opts.persona.subtitle})` }],
      }),
    });
    if (!res.ok) throw new Error(`ハッシュタグ提案エラー: ${res.status}`);
    return res.json();
  });
  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return Array.isArray(parsed.tags) ? parsed.tags.slice(0, count).map(String) : [];
  } catch {
    return [];
  }
}

// ============================================================
// 週次コンテンツ計画 — 7 日分の投稿テーマを 1 タップで
// ============================================================

export interface WeeklyPlanDay {
  date: string;        // YYYY-MM-DD
  weekday: string;     // 月,火,...
  title: string;       // 投稿タイトル
  hook: string;        // 切り口 (1-2文)
  tone: SocialTone;
  platforms: SocialPlatform[];  // 推奨プラットフォーム
  bestTime: string;    // "09:00" 等
}

export async function generateWeeklyPlan(opts: {
  settings: AppSettings;
  persona: Persona;
  knowledge?: KnowledgeItem[];
  startDate?: Date;
  /** どんなテーマ方向で計画するか (任意) */
  focus?: string;
}): Promise<WeeklyPlanDay[]> {
  const start = opts.startDate || new Date();
  const dates: Array<{ date: string; weekday: string }> = [];
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dates.push({ date: iso, weekday: WD[d.getDay()] });
  }

  const kbCtx = buildKnowledgeContext(opts.knowledge || []);

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) の SNS 編集長です。
来週 3 日間の投稿カレンダーを設計します。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## 出力フォーマット (JSON のみ)
{
  "days": [
    {
      "date": "${dates[0].date}",
      "title": "投稿のテーマ (20-35字)",
      "hook": "どんな切り口の投稿か (1-2文)",
      "tone": "professional | casual | promotional | storytelling | educational",
      "platforms": ["x", "instagram", "note", ...] (3つまで、その日のテーマに合うもの),
      "bestTime": "HH:MM (狙うべき投稿時間帯)"
    },
    ... 7 日分
  ]
}

## ルール
- 7 日分必須。曜日のリズムを設計に活かす (月: 週始まりエネルギー / 金: 週末モード / 日: 内省/まとめ など)。
- トーンを散らす (同じトーンを 2 日連続させない)。
- プラットフォームも散らす (毎日全部、ではなく日替わりで集中)。
- bestTime は持続可能で現実的な時間 (朝 7-9 時 / 昼 12-13 時 / 夜 19-22 時)。
- やさしい日本語、専門用語を避ける。
${opts.focus ? `\n## 今週のフォーカス\n${opts.focus}` : ''}`;

  const userPrompt = `## 対象日付
${dates.map(d => `- ${d.date} (${d.weekday})`).join('\n')}

${kbCtx ? `## 参照ナレッジ\n${kbCtx}\n` : ''}

上記の 7 日分の投稿計画を JSON で返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3000,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`週次計画エラー: ${res.status}`);
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* */ }

  const validTones: SocialTone[] = ['professional', 'casual', 'promotional', 'storytelling', 'educational'];
  const validPlatforms = new Set<string>(ALL_PLATFORMS);
  const rawDays: any[] = Array.isArray(parsed.days) ? parsed.days : [];

  return dates.map((d, i) => {
    const raw = rawDays[i] || {};
    const tone = validTones.includes(raw.tone) ? raw.tone : 'storytelling';
    const platforms = Array.isArray(raw.platforms)
      ? raw.platforms.filter((p: any) => validPlatforms.has(p)).slice(0, 3)
      : ['x', 'instagram'];
    return {
      date: d.date,
      weekday: d.weekday,
      title: String(raw.title || `${d.weekday}の投稿`).slice(0, 80),
      hook: String(raw.hook || '').slice(0, 200),
      tone,
      platforms: platforms.length > 0 ? platforms : ['x'],
      bestTime: String(raw.bestTime || '09:00').slice(0, 5),
    };
  });
}
