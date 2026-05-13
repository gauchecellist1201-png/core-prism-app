// ============================================================
// Tts.ts — TTS ナレーション (Web Speech Synthesis, 完全無料)
//
// ブラウザ標準の speechSynthesis を使う。日本語音声 + 英語音声を
// MediaStream に流し込んで MediaRecorder で WAV/WebM 化する。
// ============================================================

export type VoiceStyle = 'female' | 'male' | 'energetic' | 'calm' | 'kid' | 'pro';

export interface VoicePreset {
  id: VoiceStyle;
  label: string;
  /** speechSynthesis 用パラメータ */
  rate: number;
  pitch: number;
  /** voice 名のマッチパターン (lang=ja-JP のものを優先) */
  prefer: RegExp;
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: 'female', label: '女性 ナチュラル', rate: 1.0, pitch: 1.1, prefer: /female|woman|kyoko|Otoya|Haruka|Sayaka/i },
  { id: 'male', label: '男性 ナチュラル', rate: 0.95, pitch: 0.95, prefer: /male|man|hattori|Otoya|Kenji|Ichiro/i },
  { id: 'energetic', label: '元気 ハイテンション', rate: 1.18, pitch: 1.3, prefer: /female|woman|kyoko/i },
  { id: 'calm', label: '落ち着き ナレーター', rate: 0.85, pitch: 0.85, prefer: /male|man|hattori|kenji/i },
  { id: 'kid', label: '子供っぽい', rate: 1.15, pitch: 1.55, prefer: /female|woman|kyoko/i },
  { id: 'pro', label: 'プロアナウンサー', rate: 0.98, pitch: 1.0, prefer: /Google|Otoya|Kyoko|Premium/i },
];

export function pickVoice(preset: VoicePreset, lang = 'ja-JP'): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const candidates = voices.filter(v => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  return candidates.find(v => preset.prefer.test(v.name)) ?? candidates[0] ?? voices[0];
}

/** SpeechSynthesisUtterance を組み立てる */
export function buildUtterance(text: string, preset: VoicePreset, lang = 'ja-JP'): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = preset.rate;
  u.pitch = preset.pitch;
  const v = pickVoice(preset, lang);
  if (v) u.voice = v;
  return u;
}

/** ブラウザ TTS で読み上げ (再生のみ。MP4 mux はビルトインで行う、後段の MediaRecorder が拾う) */
export function speak(text: string, preset: VoicePreset, lang = 'ja-JP'): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('TTS 非対応ブラウザ'));
  return new Promise((resolve, reject) => {
    const u = buildUtterance(text, preset, lang);
    u.onend = () => resolve();
    u.onerror = (e: SpeechSynthesisErrorEvent) => reject(new Error(e.error || 'tts error'));
    window.speechSynthesis.speak(u);
  });
}

/** voiceslist が空のときに resolves するまで待つ (Chrome バグ対策) */
export function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve([]); return; }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) { resolve(existing); return; }
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = fin;
    setTimeout(fin, timeoutMs);
  });
}

/**
 * TTS をオフラインで AudioBuffer 化する手段は標準 API では存在しない。
 * そこで「再生中にデフォルトの speech 出力を AudioContext で拾う」のではなく、
 * 字幕タイミングに合わせて MediaRecorder 録画中に speechSynthesis.speak() を打つことで
 * ブラウザ既定の音声出力経由で MediaRecorder の audio track に混ぜる戦略を取る。
 * IrisReelStudio.tsx で startExport() のループ内から呼ばれる。
 */
export function scheduleTtsDuringExport(
  captions: { start: number; text: string }[],
  preset: VoicePreset,
  lang: 'ja-JP' | 'en-US' | 'zh-CN' | 'ko-KR',
  startedAt: number,
): { cancel: () => void } {
  const timers: number[] = [];
  for (const cap of captions) {
    const ms = (cap.start * 1000) - (performance.now() - startedAt);
    const delay = Math.max(0, ms);
    const id = window.setTimeout(() => {
      try {
        const u = buildUtterance(cap.text.replace(/^\[.*?\]\s*/, ''), preset, lang);
        window.speechSynthesis.speak(u);
      } catch {/* */}
    }, delay);
    timers.push(id);
  }
  return {
    cancel: () => {
      for (const id of timers) clearTimeout(id);
      try { window.speechSynthesis.cancel(); } catch {/* */}
    },
  };
}
