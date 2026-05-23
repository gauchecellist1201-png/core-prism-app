// ============================================================
// IRIS — AI Video Studio (脚本生成・BGM提案・音声プレビュー)
// 「テーマだけで、縦動画が全部できてる」が体験ゴール
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface VideoScene {
  /** シーン表示秒数 */
  duration: number;
  /** テキストオーバーレイ (15字以内推奨) */
  text: string;
  /** 映像指示 (撮影者へのディレクション) */
  visual: string;
  /** BGM雰囲気ヒント (任意) */
  bgm?: string;
}

export interface VideoScript {
  /** 冒頭フック */
  hook: string;
  /** シーン配列 */
  scenes: VideoScene[];
  /** SNS投稿キャプション */
  caption: string;
  /** ハッシュタグ配列 */
  hashtags: string[];
  /** 合計秒数 (computed) */
  totalDuration: number;
}

/** テーマから縦動画脚本を Claude で生成 */
export async function generateScript(
  theme: string,
  persona: string,
  settings: AppSettings,
  targetSec = 30,
): Promise<VideoScript> {

  const sys = `あなたは縦型ショート動画 (Reels / TikTok / Shorts) の専門脚本家。
返答は JSON のみ:
{
  "hook": "冒頭1秒で視聴者を釘付けにするフレーズ",
  "scenes": [
    { "duration": 5, "text": "テキストオーバーレイ (15字以内)", "visual": "映像の具体的指示", "bgm": "BGMの雰囲気 (任意)" }
  ],
  "caption": "SNS投稿キャプション (絵文字あり、改行活用)",
  "hashtags": ["#タグ1", "#タグ2"]
}
ルール:
- シーン合計が約${targetSec}秒になるよう調整
- シーンは3〜8個
- text は短く (15字以内)
- visual は具体的な映像指示
- hashtags は10〜15個
- インフルエンサー本人の声で、押し売りではなく体験ベース`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 2000,
        system: sys,
        messages: [{
          role: 'user',
          content: `テーマ: ${theme}\nペルソナ: ${persona || 'インフルエンサー'}\n目標尺: ${targetSec}秒`,
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `動画脚本APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    const scenes: VideoScene[] = Array.isArray(parsed.scenes)
      ? parsed.scenes.map((s: Record<string, unknown>) => ({
          duration: Number(s.duration) || 5,
          text: String(s.text || ''),
          visual: String(s.visual || ''),
          bgm: s.bgm ? String(s.bgm) : undefined,
        }))
      : [];
    const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
    return {
      hook: parsed.hook || '',
      scenes,
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
      totalDuration,
    };
  } catch {
    return { hook: theme, scenes: [], caption: '', hashtags: [], totalDuration: 0 };
  }
}

/** シーン配列から Suno / Udio 向け BGM プロンプトを生成 */
export function generateBgmPrompt(scenes: VideoScene[]): string {
  const moods = scenes.map(s => s.bgm).filter(Boolean).join(', ');
  const base = moods || 'upbeat, modern, energetic';
  return `${base} — short loop 15-60s, no lyrics, suitable for vertical social video (Reels/TikTok)`;
}

/** SpeechSynthesisUtterance で各シーンを順番に読み上げ (プレビュー用) */
export function voiceOverScript(scenes: VideoScene[]): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  let delayMs = 0;
  scenes.forEach(scene => {
    if (!scene.text.trim()) {
      delayMs += scene.duration * 1000;
      return;
    }
    const utter = new SpeechSynthesisUtterance(scene.text);
    utter.lang = 'ja-JP';
    utter.rate = 1.1;
    const d = delayMs;
    setTimeout(() => window.speechSynthesis.speak(utter), d);
    delayMs += scene.duration * 1000;
  });
}
