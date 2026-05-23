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
