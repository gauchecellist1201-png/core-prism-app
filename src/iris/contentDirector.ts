// ============================================================
// IRIS — Content Director (構成・テロップ・キャプション・ハッシュタグの丸投げ AI)
// 「テーマだけ入れたら、撮影台本まで全部できてる」が体験ゴール
// ============================================================
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface ContentBlueprint {
  /** タイトル / コンセプト */
  title: string;
  /** フック (冒頭3秒で言うべきこと) */
  hook: string;
  /** 構成 — 秒数 / シーン / 何を見せるか / セリフ */
  scenes: { time: string; scene: string; visual: string; line?: string }[];
  /** テロップ案 */
  captions: { time: string; text: string }[];
  /** 投稿本文 (キャプション) */
  postCaption: string;
  /** ハッシュタグ (3 セット: メイン / カテゴリ / ロングテール) */
  hashtags: { main: string[]; category: string[]; longtail: string[] };
  /** 撮影前のチェックリスト (準備) */
  prep: string[];
  /** CTA (コール・トゥ・アクション) */
  cta: string;
  /** 想定リーチ (フォロワー比) */
  reachEstimate?: string;
  generatedAt: string;
}

export async function generateBlueprint(opts: {
  settings: AppSettings;
  topic: string;                // 例: 「春の新作リップを試す」
  platform: Platform;
  contentType: ContentType;
  brand?: string;               // タイアップ先 (任意)
  targetAudience?: string;      // 例: 25-34歳女性
  ngWords?: string[];           // 言わない方がいい言葉
  durationSec?: number;         // 動画なら秒数
  selfTone?: string;            // 自分のキャラ
}): Promise<ContentBlueprint> {

  const sys = `あなたは「ファッション誌のクリエイティブディレクター」。インフルエンサーの代わりに、撮影台本・テロップ・投稿文を一気に作ります。

返答は JSON のみ:
{
  "title": "コンセプト (10-30字)",
  "hook": "冒頭3秒のセリフ or 引きフレーズ",
  "scenes": [
    { "time": "0-3秒", "scene": "シーン名", "visual": "何を映すか", "line": "セリフ (必要なら)" }
  ],
  "captions": [
    { "time": "0-3秒", "text": "テロップ文言" }
  ],
  "postCaption": "投稿本文 (絵文字 / 改行を活用)",
  "hashtags": {
    "main": ["#PR", "#ブランド名"],
    "category": ["#コスメ好き"],
    "longtail": ["#30代メイク"]
  },
  "prep": ["撮影前の準備"],
  "cta": "保存してね、的な誘導",
  "reachEstimate": "推定 (任意)"
}

## ルール
- プラットフォームの文化に合わせる:
  - Instagram Reel: 15-30秒、テンポ早い、テロップ多め
  - TikTok: 15-60秒、トレンド意識、フックが命
  - YouTube Short: 60秒以内、説明的
  - Instagram Post (静止画): 撮影シーン1つ + キャプション本文に重き
- ハッシュタグは 3 セット (メイン 3-5 / カテゴリ 5-8 / ロングテール 5-8)
- 「PR」「広告」「タイアップ」表記をブランド指定に従って入れる
- インフルエンサー本人の声で。押し売りではなく実体験ベース
- ${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## テーマ
${opts.topic}

## プラットフォーム
${PLATFORM_META[opts.platform].label} / ${CONTENT_TYPE_META[opts.contentType]}
${opts.durationSec ? `想定尺: ${opts.durationSec}秒` : ''}

## ブランド
${opts.brand || '(なし)'}

## ターゲット
${opts.targetAudience || '同年代の女性'}

## 自分のトーン
${opts.selfTone || '自然体'}

## 言わない方がいい言葉
${opts.ngWords?.join(', ') || '(なし)'}

これで台本・テロップ・キャプション・ハッシュタグを全部作って。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `構成生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      title: parsed.title || '',
      hook: parsed.hook || '',
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
      captions: Array.isArray(parsed.captions) ? parsed.captions : [],
      postCaption: parsed.postCaption || '',
      hashtags: parsed.hashtags || { main: [], category: [], longtail: [] },
      prep: Array.isArray(parsed.prep) ? parsed.prep : [],
      cta: parsed.cta || '',
      reachEstimate: parsed.reachEstimate,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      title: opts.topic,
      hook: '', scenes: [], captions: [], postCaption: text,
      hashtags: { main: [], category: [], longtail: [] },
      prep: [], cta: '',
      generatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================
// 撮影スケジュール 7 日 grid + 週次クリエイティブ提案
// ============================================================
export type ShootLane = 'shoot' | 'edit' | 'post';

export interface ShootSlot {
  id: string;
  date: string;           // YYYY-MM-DD
  lane: ShootLane;        // 撮影 / 編集 / 投稿
  title: string;
  detail?: string;
  platform?: string;      // instagram / tiktok / youtube
  contentType?: string;   // reel / post / story
  status?: 'planned' | 'in_progress' | 'done';
}

export interface WeeklyCreativePlan {
  reels: { title: string; hook: string; scene: string; }[];     // 3 本
  stories: { day: string; idea: string; }[];                     // 7 本
  posts: { title: string; visual: string; caption: string; }[];  // 4 本
  generatedAt: string;
}

export async function generateWeeklyCreative(opts: {
  settings: AppSettings;
  audience?: string;
  niche?: string;       // 例: ファッション / ライフスタイル / ビューティ
  focus?: string;       // 今週のテーマ
}): Promise<WeeklyCreativePlan> {
  const sys = `あなたはインフルエンサーのクリエイティブ司令塔。来週 1 週間の「リール 3 本 + ストーリー 7 本 + 投稿 4 本」を一気に企画します。

返答は JSON のみ:
{
  "reels": [{ "title": "...", "hook": "冒頭3秒のセリフ", "scene": "撮影シーンの概要" }, ... 3本],
  "stories": [{ "day": "月", "idea": "1日のストーリーアイデア (1文)" }, ... 7日分],
  "posts": [{ "title": "...", "visual": "メインビジュアル", "caption": "本文 (60字)" }, ... 4本]
}

## ルール
- ${toneInstruction(opts.settings.aiTone)}
- 切り口を散らす (体験談 / 比較 / 学び / 日常 / 主張)
- 数字・固有名詞・具体性で抽象論を避ける
- やさしい日本語、専門用語を避ける`;

  const userText = `## ジャンル
${opts.niche || 'ライフスタイル / ファッション'}

## ターゲット
${opts.audience || '同年代の女性'}

## 今週のフォーカス
${opts.focus || '(指定なし — クリエイターの強みを活かす方向で)'}

来週のリール 3 本 / ストーリー 7 本 / 投稿 4 本を JSON で。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `週次クリエイティブAPIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      reels: Array.isArray(parsed.reels) ? parsed.reels.slice(0, 3) : [],
      stories: Array.isArray(parsed.stories) ? parsed.stories.slice(0, 7) : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts.slice(0, 4) : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return { reels: [], stories: [], posts: [], generatedAt: new Date().toISOString() };
  }
}

// ============================================================
// ロケ地候補 AI — テーマから 5 つ提案
// ============================================================
export interface LocationProposal {
  name: string;        // 「代官山の路地裏カフェ」など
  vibe: string;        // 雰囲気
  bestTime: string;    // 撮影のベストタイム
  permission: string;  // 許可が必要か / 注意点
}

export type LocationTheme = 'カフェ' | '公園' | '自宅' | '都内' | '旅先';

export async function proposeLocations(opts: {
  settings: AppSettings;
  theme: LocationTheme;
  audience?: string;
  contentTopic?: string;
}): Promise<LocationProposal[]> {
  const sys = `あなたはロケーションコーディネーター。SNS 撮影に映えるロケ地を 5 つ提案します。

返答は JSON のみ:
{
  "locations": [
    { "name": "ロケ地名 (具体的に)", "vibe": "雰囲気 (1文)", "bestTime": "撮影ベストタイム", "permission": "撮影の注意点" }
  ]
}

## ルール
- ${toneInstruction(opts.settings.aiTone)}
- 「カフェ」なら個性的で映える店、「公園」なら季節感のある場所、「自宅」ならコーナー別 (リビング/玄関/ベッドルーム/ベランダ/キッチン) など、具体的に
- ベストタイムは「朝のゴールデンアワー」「夕方のマジックアワー」など実用的に
- 撮影許可・混雑度など現実的な注意点を含める`;

  const userText = `## テーマ
${opts.theme}

## ターゲット
${opts.audience || '同年代の女性'}

## 撮影コンテンツ
${opts.contentTopic || '(指定なし)'}

5 つのロケ地候補を JSON で。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) throw new Error(`ロケ地提案エラー: ${res.status}`);
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return Array.isArray(parsed.locations) ? parsed.locations.slice(0, 5) : [];
  } catch {
    return [];
  }
}

// ============================================================
// 衣装 + 小道具メモ AI
// ============================================================
export interface WardrobeChecklist {
  outfits: string[];     // 衣装案
  props: string[];       // 小道具
  hair: string;          // ヘアスタイル
  makeup: string;        // メイク
  reminders: string[];   // 当日のリマインダー
}

export async function generateWardrobe(opts: {
  settings: AppSettings;
  topic: string;
  location?: string;
  contentType?: string;
  audience?: string;
}): Promise<WardrobeChecklist> {
  const sys = `あなたはスタイリスト + ヘアメイク。撮影に必要な衣装・小道具・ヘアメイクを 1 つのチェックリストに。

返答は JSON のみ:
{
  "outfits": ["衣装案1 (具体的に)", "衣装案2", ...],
  "props": ["小道具1", "小道具2", ...],
  "hair": "ヘアスタイル指示 (1-2文)",
  "makeup": "メイク指示 (1-2文)",
  "reminders": ["当日の持ち物・段取り 3-5項目"]
}

## ルール
- ${toneInstruction(opts.settings.aiTone)}
- 衣装は色・素材・シルエットまで具体的に
- ロケ地と季節感に合わせる`;

  const userText = `## 撮影テーマ
${opts.topic}

## ロケ地
${opts.location || '(未定)'}

## コンテンツタイプ
${opts.contentType || 'リール'}

## ターゲット
${opts.audience || '同年代の女性'}

衣装・小道具・ヘアメイク チェックリストを JSON で。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) throw new Error(`衣装チェックリストエラー: ${res.status}`);
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      outfits: Array.isArray(parsed.outfits) ? parsed.outfits : [],
      props: Array.isArray(parsed.props) ? parsed.props : [],
      hair: String(parsed.hair || ''),
      makeup: String(parsed.makeup || ''),
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
    };
  } catch {
    return { outfits: [], props: [], hair: '', makeup: '', reminders: [] };
  }
}
