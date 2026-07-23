// ============================================================
// CORE Iris — 美容アドバイザー AI
// スキンケア / メイク / ヘア / コスメ / 体調 / モチベ — エビデンスベース & やさしい口調
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';
import { aiFetch } from '../lib/aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export type BeautyTopic =
  | 'skincare'
  | 'makeup'
  | 'hair'
  | 'nail'
  | 'cosmetics'
  | 'body-mind'
  | 'pms'
  | 'free';

export const BEAUTY_TOPIC_META: Record<BeautyTopic, { label: string; emoji: string; hint: string }> = {
  'skincare':  { label: 'スキンケア',     emoji: '', hint: '肌悩み・成分・ルーティン' },
  'makeup':    { label: 'メイク',         emoji: '', hint: 'シーン別・色選び・トレンド' },
  'hair':      { label: 'ヘア',           emoji: '', hint: 'スタイル・ケア・カラー' },
  'nail':      { label: 'ネイル',         emoji: '', hint: 'デザイン・色・ケア' },
  'cosmetics': { label: 'コスメ選び',     emoji: '', hint: 'プチプラ vs デパコス・成分比較' },
  'body-mind': { label: 'ボディ&メンタル', emoji: '', hint: 'ボディケア・睡眠・栄養' },
  'pms':       { label: 'PMS / 生理',     emoji: '', hint: '体調変化・対処・心の波' },
  'free':      { label: 'なんでも',       emoji: '', hint: '雑談OK・気持ちのケア' },
};

export interface BeautyMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function buildSystem(topic: BeautyTopic, aiTone?: 'gentle' | 'professional' | 'casual'): string {
  const meta = BEAUTY_TOPIC_META[topic];
  return `あなたは「やさしくて、ちゃんと根拠も持ってる、年上の美容にくわしい姉」のような存在です。
専門領域: ${meta.label} (${meta.hint})

## 振る舞いのルール
- まず相手の気持ちに共感する。「わかる、それ気になるよね」みたいな入り
- 押し付けず、選択肢を 2〜3 個提示する
- 商品名やブランドを出すときは、価格帯と特徴も添える (¥ 〜 ¥¥¥ で)
- 成分の話は、難しくなりすぎないように。具体例: 「ナイアシンアミド (くすみ・毛穴に強い)」
- "絶対こうすべき" ではなく、"私だったらこう試す" という距離感
- 1 回の返答は 200〜400 字くらい。長くなる時は箇条書き or 見出しで読みやすく
- 受診を勧めるべき症状 (突然の発疹・激しい痛み・原因不明の出血・心の限界) は、必ず「皮膚科 / 婦人科 / メンタルクリニック」を勧める
- ステマ的な誘導はしない。ニュートラルに

${toneInstruction(aiTone || 'gentle')}

返答は普通の日本語で OK (JSON 不要)。`;
}

export async function chatBeautyAdvisor(opts: {
  settings: AppSettings;
  topic: BeautyTopic;
  history: BeautyMessage[];
  userMessage: string;
}): Promise<string> {

  const messages = opts.history
    .slice(-12) // 直近12発言
    .map(m => ({ role: m.role, content: m.content }))
    .concat([{ role: 'user' as const, content: opts.userMessage }]);

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: buildSystem(opts.topic, opts.settings.aiTone),
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `美容相談APIエラー: ${res.status}`);
    }
    return res.json();
  });

  return data.content?.[0]?.text ?? '(返答なし)';
}
