// ============================================================
// useTextToSpeech — Web Speech API の SpeechSynthesis ラッパー
// 日本語優先で女性声を選び、滑らかに発話する
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

type TtsState = 'idle' | 'speaking' | 'unsupported';

export interface TtsOptions {
  lang?: string;
  rate?: number; // 0.1 - 10 (default 1)
  pitch?: number; // 0 - 2 (default 1)
  volume?: number; // 0 - 1
  /** 性別優先 (best effort) */
  preferGender?: 'female' | 'male';
}

export function useTextToSpeech(options: TtsOptions = {}) {
  const { lang = 'ja-JP', rate = 1.05, pitch = 1.05, volume = 1, preferGender = 'female' } = options;
  const [state, setState] = useState<TtsState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!isAvailable) {
      setState('unsupported');
      return;
    }
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isAvailable]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    if (!voices.length) return undefined;
    const langMatch = voices.filter(v => v.lang === lang);
    const looseLang = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
    const pool = langMatch.length ? langMatch : looseLang.length ? looseLang : voices;

    // macOS / iOS は Kyoko (女性) / Otoya (男性) が代表的
    const namePref = preferGender === 'female'
      ? /(Kyoko|Mizuki|O-ren|Sakura|Anna|Karen|Samantha|Female)/i
      : /(Otoya|Hattori|Daniel|Takeshi|Male)/i;
    const named = pool.find(v => namePref.test(v.name));
    if (named) return named;
    return pool[0];
  }, [voices, lang, preferGender]);

  const speak = useCallback(
    (text: string, opts?: { onEnd?: () => void; onStart?: () => void }) => {
      if (!isAvailable || !text.trim()) {
        opts?.onEnd?.();
        return;
      }
      // 進行中の発話があればキャンセル
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      const v = pickVoice();
      if (v) u.voice = v;
      u.onstart = () => {
        setState('speaking');
        opts?.onStart?.();
      };
      u.onend = () => {
        setState('idle');
        opts?.onEnd?.();
      };
      u.onerror = () => {
        setState('idle');
        opts?.onEnd?.();
      };
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [isAvailable, lang, rate, pitch, volume, pickVoice],
  );

  const cancel = useCallback(() => {
    if (!isAvailable) return;
    window.speechSynthesis.cancel();
    setState('idle');
  }, [isAvailable]);

  return { state, speak, cancel, isAvailable, voices, pickedVoice: pickVoice() };
}
