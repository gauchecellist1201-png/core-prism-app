// ============================================================
// OpenAI TTS — ChatGPT クラスの自然な音声 (gpt-4o-mini-tts / tts-1-hd)
// ============================================================
// 必要な環境変数: VITE_OPENAI_API_KEY (画像生成と共有)

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'sage' | 'coral';

export const OPENAI_VOICE_OPTIONS: { value: OpenAIVoice; label: string; tone: string }[] = [
  { value: 'nova',    label: 'Nova',    tone: '明るく親しみやすい (女性風)' },
  { value: 'shimmer', label: 'Shimmer', tone: '柔らかく落ち着いた (女性風)' },
  { value: 'alloy',   label: 'Alloy',   tone: '中性的でクリア' },
  { value: 'echo',    label: 'Echo',    tone: '深く響く (男性風)' },
  { value: 'onyx',    label: 'Onyx',    tone: '低く力強い (男性風)' },
  { value: 'fable',   label: 'Fable',   tone: '物語調・温かみのある' },
  { value: 'sage',    label: 'Sage',    tone: '静かで知性的' },
  { value: 'coral',   label: 'Coral',   tone: '明朗で前向き' },
];

export const DEFAULT_OPENAI_VOICE: OpenAIVoice = 'nova';

export function isOpenAITTSConfigured(): boolean {
  return !!(import.meta.env.VITE_OPENAI_API_KEY as string | undefined);
}

interface OpenAITTSOptions {
  voice?: OpenAIVoice;
  /** tts-1: 標準品質・速い / tts-1-hd: 高品質・少し遅い / gpt-4o-mini-tts: 最新・自然 */
  model?: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  /** 0.25 ～ 4.0、デフォルト 1.0 */
  speed?: number;
  /** 「やさしく語りかけて」「機関銃のように速く」のような自由指示 (gpt-4o-mini-tts のみ) */
  instructions?: string;
  signal?: AbortSignal;
}

/** OpenAI TTS で音声を生成し Blob URL を返す */
export async function synthesizeWithOpenAI(text: string, opts: OpenAITTSOptions = {}): Promise<string> {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || '';
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY が未設定です');

  const body: Record<string, unknown> = {
    model: opts.model || 'gpt-4o-mini-tts',
    voice: opts.voice || DEFAULT_OPENAI_VOICE,
    input: text.slice(0, 4000),  // OpenAI 4096 文字上限
    speed: opts.speed ?? 1.0,
    response_format: 'mp3',
  };
  if (opts.instructions && body.model === 'gpt-4o-mini-tts') {
    body.instructions = opts.instructions;
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI TTS エラー: ${res.status} ${t.slice(0, 200)}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

export interface SpeakOpenAIOptions extends OpenAITTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
}

export async function speakWithOpenAI(text: string, opts: SpeakOpenAIOptions = {}): Promise<void> {
  if (!text.trim()) return;
  // 進行中の再生をキャンセル
  stopOpenAISpeaking();

  try {
    // gpt-4o-mini-tts に「自然な秘書としての語り」を指示
    const instructions = opts.instructions ||
      'Speak in a warm, calm Japanese voice as a personal secretary speaking to their employer. ' +
      'Use natural prosody, gentle pace, slight pauses for emphasis. ' +
      'Sound encouraging but composed — like ChatGPT-4o standard voice.';

    const url = await synthesizeWithOpenAI(text, { ...opts, instructions });
    currentObjectUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onplay = () => opts.onStart?.();
    audio.onended = () => {
      opts.onEnd?.();
      cleanup();
    };
    audio.onerror = () => {
      opts.onError?.('再生に失敗しました');
      cleanup();
    };
    await audio.play();
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : String(e));
    cleanup();
    throw e;
  }
}

function cleanup() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentAudio = null;
}

export function stopOpenAISpeaking() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function isSpeakingOpenAI(): boolean {
  return !!currentAudio && !currentAudio.paused;
}
