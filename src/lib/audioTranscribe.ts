// ============================================================
// 会議の録音ファイル → 文字起こし
//
// Zoom / Google Meet / Teams の録音 (mp3 / m4a / mp4 / wav 等) を
// ブラウザ内で 16kHz モノラルに変換し、75 秒ごとに分割して
// /api/ai (Gemini 音声入力) に送り、日本語の文字起こしを得る。
//
// API キーはサーバ側に保管されたまま。ファイルはユーザーの
// ブラウザ内で処理され、分割した音声だけが順番に送られる。
// ============================================================
import { enqueueClaudeCall } from './apiQueue';

const CHUNK_SEC = 110;       // 1 チャンクの長さ (長めにして往復回数を削減＝高速化。110s×16kHz×2byte ≒ 3.5MB)
const TARGET_RATE = 16000;   // 文字起こしに十分な品質

// 録音ファイルとして受け付ける拡張子
export const AUDIO_EXT = ['mp3', 'm4a', 'mp4', 'wav', 'aac', 'ogg', 'webm', 'mov', 'flac'];

export function isAudioFile(name: string): boolean {
  const ext = name.toLowerCase().match(/\.([^.]+)$/)?.[1] || '';
  return AUDIO_EXT.includes(ext);
}

// ── 16bit PCM モノラル WAV にエンコード ──
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, 1, true);              // モノラル
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);              // block align
  view.setUint16(34, 16, true);             // 16bit
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buffer;
}

// ── ArrayBuffer → base64 (大きい配列でもスタック溢れしない) ──
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

// ── 録音ファイルをデコードして 16kHz モノラルの波形にする ──
async function decodeAndResample(file: File): Promise<Float32Array> {
  const arr = await file.arrayBuffer();
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) throw new Error('このブラウザは音声の読み込みに対応していません。');
  const ac = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ac.decodeAudioData(arr.slice(0));
  } catch {
    throw new Error('この録音ファイルを読み込めませんでした。mp3 / m4a / mp4 / wav をお試しください。');
  } finally {
    ac.close().catch(() => {});
  }

  // 全チャンネルをモノラルに混ぜる
  const len = decoded.length;
  if (len === 0) throw new Error('録音が空のようです。別のファイルをお試しください。');
  const mono = new Float32Array(len);
  const chs = decoded.numberOfChannels || 1;
  for (let ch = 0; ch < chs; ch++) {
    const d = decoded.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / chs;
  }
  if (decoded.sampleRate === TARGET_RATE) return mono;

  // OfflineAudioContext で 16kHz にリサンプル
  const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OAC) return mono; // 変換不可でもそのまま送る
  const frames = Math.max(1, Math.ceil((len * TARGET_RATE) / decoded.sampleRate));
  const offline = new OAC(1, frames, TARGET_RATE);
  const srcBuf = offline.createBuffer(1, len, decoded.sampleRate);
  srcBuf.copyToChannel(mono, 0);
  const node = offline.createBufferSource();
  node.buffer = srcBuf;
  node.connect(offline.destination);
  node.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

// ── 1 チャンクを文字起こし ──
async function transcribeChunk(wavB64: string, model: string): Promise<string> {
  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system:
          'あなたは日本語の文字起こしの専門家です。会議の音声を、聞こえたとおりに文字起こししてください。' +
          '発言内容だけを出力し、要約・説明・推測はしません。話者が変わったと感じたら改行します。' +
          '聞き取れない箇所は (不明) と書きます。音声が無音なら空のまま返します。',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'audio/wav', data: wavB64 } },
              { type: 'text', text: 'この会議音声を文字起こししてください。' },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({} as any));
      throw new Error(e?.error?.message || `文字起こしに失敗しました (${res.status})。少し待ってもう一度お試しください。`);
    }
    return res.json();
  });
  return (data?.content?.[0]?.text || '').trim();
}

export interface TranscribeOptions {
  model?: string;
  onProgress?: (done: number, total: number) => void;
}

// ── 録音ファイル全体を文字起こし ──
export async function transcribeAudioFile(file: File, opts: TranscribeOptions = {}): Promise<string> {
  const model = opts.model || 'claude-haiku-4-5';
  const samples = await decodeAndResample(file);
  const chunkLen = CHUNK_SEC * TARGET_RATE;
  const total = Math.max(1, Math.ceil(samples.length / chunkLen));
  // 並列ワーカープールで文字起こし (旧: 直列ループで N×待ち=遅い → 離脱要因)。
  // 順序は results[i] で保持。同時実行は apiQueue (MAX_CONCURRENT) が最終的に律速。
  const results: string[] = new Array(total).fill('');
  let next = 0;
  let done = 0;
  const CONCURRENCY = Math.min(6, total);
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= total) break;
      const slice = samples.subarray(i * chunkLen, Math.min((i + 1) * chunkLen, samples.length));
      const wav = encodeWav(slice, TARGET_RATE);
      try {
        results[i] = await transcribeChunk(toBase64(wav), model);
      } catch {
        results[i] = '';
      }
      done++;
      opts.onProgress?.(done, total);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const joined = results.filter(Boolean).join('\n').trim();
  if (!joined) {
    throw new Error('音声から文字を取り出せませんでした。録音が無音か、声が小さすぎる可能性があります。');
  }
  return joined;
}
