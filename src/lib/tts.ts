// ============================================================
// 自然な音声読み上げ — OpenAI TTS 優先 + ブラウザ標準にフォールバック
// ============================================================
import {
  speakWithOpenAI, stopOpenAISpeaking, isSpeakingOpenAI,
  isOpenAITTSConfigured, type OpenAIVoice,
} from './ttsOpenAI';

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let preferredVoiceJa: SpeechSynthesisVoice | null = null;
let isSpeakingFlag = false;

// 優先する音声 (上から順にマッチ)
const VOICE_RANK_JA: RegExp[] = [
  // macOS / iOS の高品質
  /Kyoko.*Premium/i,
  /Kyoko.*Enhanced/i,
  /Otoya.*Premium/i,
  /Otoya.*Enhanced/i,
  /Hattori.*Premium/i,
  /O-Ren.*Premium/i,
  // Microsoft Edge / Windows の Neural
  /Microsoft Nanami.*Natural/i,
  /Microsoft Keita.*Natural/i,
  /Microsoft Aoi.*Natural/i,
  /Microsoft Daichi.*Natural/i,
  /Microsoft Mayu.*Natural/i,
  // Google Chrome (Android / Chromebook)
  /Google 日本語/i,
  /Google.*Japanese/i,
  // 一般グレード
  /Kyoko/i,
  /Otoya/i,
  /Microsoft Haruka/i,
  /Microsoft Ayumi/i,
  /Microsoft Sayaka/i,
];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const jaVoices = voices.filter(v => v.lang.startsWith('ja'));
  if (jaVoices.length === 0) return null;

  for (const pattern of VOICE_RANK_JA) {
    const match = jaVoices.find(v => pattern.test(v.name));
    if (match) return match;
  }
  // localService = OS native voice (通常上質)
  const local = jaVoices.find(v => v.localService);
  if (local) return local;
  return jaVoices[0];
}

export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;

  const initial = window.speechSynthesis.getVoices();
  if (initial.length > 0) {
    cachedVoices = initial;
    preferredVoiceJa = pickBestVoice(initial);
    return initial;
  }

  // voices ロード待ち
  return await new Promise<SpeechSynthesisVoice[]>(resolve => {
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0) return;
      resolved = true;
      cachedVoices = v;
      preferredVoiceJa = pickBestVoice(v);
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(v);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      if (resolved) return;
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      preferredVoiceJa = pickBestVoice(v);
      resolved = true;
      resolve(v);
    }, 1500);
  });
}

export function listJapaneseVoices(): SpeechSynthesisVoice[] {
  return (cachedVoices ?? []).filter(v => v.lang.startsWith('ja'));
}

export function getCurrentVoice(): SpeechSynthesisVoice | null {
  return preferredVoiceJa;
}

export function setPreferredVoice(name: string | null) {
  if (!name) {
    if (cachedVoices) preferredVoiceJa = pickBestVoice(cachedVoices);
    return;
  }
  const found = (cachedVoices ?? []).find(v => v.name === name);
  if (found) preferredVoiceJa = found;
}

// ── テキスト前処理 ────────────────────────────────────────
function preprocess(text: string): string {
  return text
    // マークダウン除去
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<![\w*])\*(?!\*)([^*\n]+?)(?<!\*)\*(?![\w*])/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // URL は「リンク」と読む
    .replace(/https?:\/\/\S+/g, 'リンク')
    .replace(/www\.\S+/g, 'リンク')
    // メールアドレス
    .replace(/\S+@\S+\.\S+/g, 'メールアドレス')
    // 連続改行を句点に
    .replace(/\n{2,}/g, '。')
    .replace(/\n/g, '、')
    // 連続句読点を圧縮
    .replace(/[。、]{2,}/g, '。')
    .replace(/\s{2,}/g, ' ')
    // 数字+単位の自然読み (例: "30分" は変換不要、"AI"を"エーアイ")
    .replace(/\bAI\b/g, 'エーアイ')
    .replace(/\bAPI\b/g, 'エーピーアイ')
    .replace(/\bUI\b/g, 'ユーアイ')
    .replace(/\bCEO\b/g, 'シーイーオー')
    .replace(/\bCOO\b/g, 'シーオーオー')
    .replace(/\bCTO\b/g, 'シーティーオー')
    .replace(/\bHRV\b/g, 'エイチアールブイ')
    .replace(/\bPDF\b/g, 'ピーディーエフ')
    .replace(/\bKOL\b/g, 'ケーオーエル')
    // 残ったマークダウン記号
    .replace(/[#`*_]/g, '')
    .trim();
}

function splitSentences(text: string): string[] {
  // 句点 / 感嘆符 / 疑問符の後で分割。長すぎる文はさらに読点で分割。
  const pieces = text.split(/(?<=[。！？\!\?])\s*/).flatMap(s => {
    if (s.length <= 70) return [s];
    return s.split(/(?<=[、,])\s*/);
  });
  return pieces.map(s => s.trim()).filter(Boolean);
}

// ── 読み上げ本体 ──────────────────────────────────────────
export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  /** OpenAI TTS の音声 (nova / shimmer / alloy 等)。設定済みなら優先される */
  openaiVoice?: OpenAIVoice;
  /** OpenAI TTS への自由指示 (例: 「ゆっくり優しく」) */
  openaiInstructions?: string;
  /** 強制的にブラウザ標準を使う */
  forceBrowserTTS?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
  /** 各文ごとに通知 */
  onProgress?: (sentence: string, idx: number, total: number) => void;
}

export async function speakNatural(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!text.trim()) return;

  // OpenAI TTS が利用可能なら優先 (ChatGPT 同等の自然さ)
  if (!options.forceBrowserTTS && isOpenAITTSConfigured()) {
    try {
      // OpenAI には前処理控えめ (URL/メアド変換のみ)
      const cleaned = text
        .replace(/https?:\/\/\S+/g, 'リンク')
        .replace(/\S+@\S+\.\S+/g, 'メールアドレス')
        .replace(/[#`*_]/g, '')
        .trim();
      await speakWithOpenAI(cleaned, {
        voice: options.openaiVoice,
        speed: options.rate ?? 1.0,
        instructions: options.openaiInstructions,
        onStart: options.onStart,
        onEnd: options.onEnd,
        onError: options.onError,
      });
      return;
    } catch (e) {
      // OpenAI 失敗時はブラウザ TTS にフォールバック (通信エラー・割り込み等)
      console.warn('[TTS] OpenAI failed, falling back to browser TTS:', e);
    }
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // 既存読み上げをキャンセル
  window.speechSynthesis.cancel();
  isSpeakingFlag = true;

  // Voices ロード
  await loadVoices();

  const cleaned = preprocess(text);
  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) {
    isSpeakingFlag = false;
    options.onEnd?.();
    return;
  }

  const lang = options.lang || 'ja-JP';
  const rate = options.rate ?? 0.95;
  const pitch = options.pitch ?? 1.0;
  const volume = options.volume ?? 1.0;
  const voice = options.voiceName
    ? (cachedVoices ?? []).find(v => v.name === options.voiceName) ?? preferredVoiceJa
    : preferredVoiceJa;

  options.onStart?.();

  for (let i = 0; i < sentences.length; i++) {
    if (!isSpeakingFlag) break;
    const s = sentences[i];
    options.onProgress?.(s, i, sentences.length);
    await new Promise<void>(resolve => {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      if (voice) u.voice = voice;
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      u.onend = finish;
      u.onerror = (e) => {
        if (!settled) {
          settled = true;
          options.onError?.((e as any).error || 'tts-error');
          resolve();
        }
      };
      window.speechSynthesis.speak(u);
      // フェイルセーフ: 最大 30 秒で次へ
      setTimeout(finish, 30_000);
    });
    // 文間に短い間 (60ms) を入れて自然な抑揚に
    if (i < sentences.length - 1 && isSpeakingFlag) {
      await new Promise(r => setTimeout(r, 60));
    }
  }

  isSpeakingFlag = false;
  options.onEnd?.();
}

export function stopSpeakingNatural() {
  isSpeakingFlag = false;
  // OpenAI 側の再生も止める
  stopOpenAISpeaking();
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeakingNatural(): boolean {
  return isSpeakingFlag || isSpeakingOpenAI();
}

export function isOpenAIVoiceAvailable(): boolean {
  return isOpenAITTSConfigured();
}
