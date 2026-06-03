import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API の型を補強 (一部ブラウザで未定義のため)
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionLike, ev: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string } }[] }) => void) | null;
  onerror: ((this: SpeechRecognitionLike, ev: { error: string }) => void) | null;
  onend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

type RecState = 'idle' | 'listening' | 'processing' | 'unsupported' | 'error';

export interface VoiceInputOptions {
  /** 言語: 'ja-JP' | 'en-US' など */
  lang?: string;
  /** 連続認識（true=会話モード, false=単発） */
  continuous?: boolean;
  /** リアルタイム文字起こし（中間結果） */
  interimResults?: boolean;
  /** 自動停止タイムアウト（ms） — 0 で無効 */
  silenceTimeout?: number;
  /** 認識完了時に自動 onSubmit するか */
  autoSubmit?: boolean;
}

export interface VoiceInputResult {
  state: RecState;
  transcript: string;
  interim: string;
  isAvailable: boolean;
  /** 直近のエラーコード（'not-allowed' | 'network' | 'audio-capture' など）。復旧メッセージの出し分けに使う */
  errorCode: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(
  onResult?: (text: string, isFinal: boolean) => void,
  options: VoiceInputOptions = {}
): VoiceInputResult {
  const {
    lang = 'ja-JP',
    continuous = false,
    interimResults = true,
    silenceTimeout = 2500,
  } = options;

  const [state, setState] = useState<RecState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  const SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;
  const isAvailable = !!SR;

  useEffect(() => {
    if (!SR) {
      setState('unsupported');
      return;
    }
    const r = new SR();
    r.lang = lang;
    r.continuous = continuous;
    r.interimResults = interimResults;
    r.maxAlternatives = 1;

    r.onstart = () => {
      setState('listening');
      setInterim('');
      setErrorCode(null);
    };

    r.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) {
        setTranscript((prev) => prev + finalText);
        onResult?.(finalText, true);
        // Reset silence timer on each final
        if (silenceTimeout > 0) scheduleAutoStop();
      }
      if (interimText) {
        setInterim(interimText);
        onResult?.(interimText, false);
      }
    };

    r.onerror = (e) => {
      // 認識ノーマッチや音声検出失敗以外を error 扱い
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setErrorCode(e.error || 'unknown');
        setState('error');
      } else {
        setState('idle');
      }
    };

    r.onend = () => {
      setState((cur) => (cur === 'listening' ? 'idle' : cur));
      setInterim('');
      clearAutoStop();
    };

    recognitionRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {}
      clearAutoStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, continuous, interimResults]);

  const scheduleAutoStop = useCallback(() => {
    clearAutoStop();
    if (silenceTimeout <= 0) return;
    silenceTimerRef.current = window.setTimeout(() => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    }, silenceTimeout);
  }, [silenceTimeout]);

  const clearAutoStop = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setTranscript('');
      setInterim('');
      setErrorCode(null);
      // error 状態からの再試行も idle に戻してから開始
      setState((cur) => (cur === 'error' ? 'idle' : cur));
      recognitionRef.current.start();
    } catch {
      // 既に起動済みなどのエラーは無視
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    clearAutoStop();
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setErrorCode(null);
    setState((cur) => (cur === 'error' ? 'idle' : cur));
  }, []);

  return { state, transcript, interim, isAvailable, errorCode, start, stop, reset };
}

/** TTS: Web Speech Synthesis */
export function speak(text: string, lang = 'ja-JP') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  // 既存の発話を中断
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 1.0;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
