import { useCallback, useRef, useState } from 'react';
import { transcribeAudioFile } from '../lib/audioTranscribe';

// ============================================================
// useAudioDictation — iOS でも確実に動く音声入力(2026-07-08)
//
// Web Speech API (webkitSpeechRecognition) は iOS Safari で「存在はするが動かない」
// 罠があり、ボタンを押しても無反応=投げられない(オーナー報告)。
// そこで MediaRecorder で実際に録音し、既存の transcribeAudioFile
// (AudioContext→16kHz WAV→/api/ai) で文字起こしする。iOS/Android/PC すべてで動く。
//
// 使い方: start()=録音開始 / stop()=録音停止して文字起こし→onText(確定テキスト)。
// リアルタイム中間表示は無い代わりに、確実に文字が返る。
// ============================================================

export type DictState = 'idle' | 'recording' | 'transcribing' | 'error';

export function useAudioDictation(
  onText: (text: string) => void,
  opts: { model?: string } = {},
) {
  const [state, setState] = useState<DictState>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const isAvailable =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === 'function';

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* */ } });
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    if (!isAvailable) { setErrorCode('unsupported'); setState('error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // iOS Safari は audio/mp4、Chrome 等は audio/webm を優先
      const MR = window.MediaRecorder;
      let mime = '';
      for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg']) {
        if (MR.isTypeSupported && MR.isTypeSupported(m)) { mime = m; break; }
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        cleanupStream();
        const type = rec.mimeType || mime || 'audio/mp4';
        const blob = new Blob(chunksRef.current, { type });
        // 短すぎ/無音は静かに終了(エラーにしない)
        if (blob.size < 1200) { setState('idle'); return; }
        setState('transcribing');
        try {
          const ext = type.includes('mp4') || type.includes('aac') ? 'm4a'
            : type.includes('ogg') ? 'ogg' : 'webm';
          const file = new File([blob], `voice.${ext}`, { type });
          const text = await transcribeAudioFile(file, { model: opts.model });
          if (text && text.trim()) onText(text.trim());
          setState('idle');
        } catch {
          setErrorCode('transcribe'); setState('error');
        }
      };
      recRef.current = rec;
      rec.start();
      setState('recording');
      setErrorCode(null);
    } catch (e) {
      cleanupStream();
      const name = (e as { name?: string })?.name;
      setErrorCode(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'audio-capture');
      setState('error');
    }
  }, [isAvailable, onText, opts.model]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { cleanupStream(); setState('idle'); }
  }, []);

  const reset = useCallback(() => { setErrorCode(null); setState(s => (s === 'error' ? 'idle' : s)); }, []);

  return { state, isAvailable, errorCode, start, stop, reset };
}

// iOS(iPadOS 含む)判定 — Web Speech が壊れている端末で録音方式に切り替える
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  return iOS;
}
