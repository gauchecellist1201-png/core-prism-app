// ============================================================
// GlobalVoiceInput — どの入力欄でも音声入力 (オーナー指示 2026-05-17)
//
// 仕組み:
//   - 画面のどこかの input / textarea / contentEditable にフォーカスが
//     当たると、その欄の右上に小さなマイクボタンが出現
//   - 押すと日本語音声認識 (Web Speech API, ja-JP) が起動
//   - 認識テキストを、React 制御コンポーネントでも正しく反映されるよう
//     ネイティブ setter 経由で挿入し input イベントを発火
//   - 1 つマウントするだけでアプリ全体の入力欄をカバー
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Loader2, AlertCircle, Check, RefreshCw, X } from 'lucide-react';

function getSR(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// 音声認識のエラーコードを「やさしい日本語＋次の一手」に翻訳。
// 黙って失敗させず、必ず原因と復旧方法を本人に伝える。
function errorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'マイクの使用がオフになっています。ブラウザのアドレスバー横の🔒からマイクを「許可」にしてください。';
    case 'no-speech':
      return '音声が聞き取れませんでした。マイクに近づいて、もう一度お試しください。';
    case 'audio-capture':
      return 'マイクが見つかりませんでした。マイクの接続を確認してください。';
    case 'network':
      return '通信が不安定で聞き取れませんでした。もう一度お試しください。';
    default:
      return 'うまく聞き取れませんでした。もう一度お試しください。';
  }
}

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const t = (el as HTMLInputElement).type;
    return ['text', 'search', 'email', 'url', 'tel', 'number', ''].includes(t);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** React 制御コンポーネントでも反映されるよう値を挿入 */
function insertValue(el: HTMLInputElement | HTMLTextAreaElement, addition: string) {
  if ((el as HTMLElement).isContentEditable) {
    el.textContent = (el.textContent || '') + addition;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + addition + el.value.slice(end);
  if (setter) setter.call(el, next);
  else el.value = next;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  // カーソルを挿入位置の後ろへ
  const caret = start + addition.length;
  try { el.setSelectionRange(caret, caret); } catch { /* number 型などは無視 */ }
}

export default function GlobalVoiceInput() {
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!getSR());
  // 聞いてます / 入力できました / 失敗（復旧ボタン付き）を本人に必ず見せる
  const [feedback, setFeedback] = useState<{ type: 'listening' | 'success' | 'error'; text: string } | null>(null);
  const recRef = useRef<any>(null);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const gotResultRef = useRef(false);
  const fbTimerRef = useRef<number | null>(null);

  targetRef.current = target;

  // 一定時間後に自動で消す（聞いてます中は消さない）
  const scheduleFeedbackClear = useCallback((ms: number) => {
    if (fbTimerRef.current) window.clearTimeout(fbTimerRef.current);
    fbTimerRef.current = window.setTimeout(() => setFeedback(null), ms);
  }, []);

  const updateRect = useCallback((el: Element) => {
    setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!supported) return;

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (isTextField(el)) {
        setTarget(el as HTMLInputElement | HTMLTextAreaElement);
        updateRect(el);
      }
    };
    const onFocusOut = () => {
      // マイクボタンのクリックを拾えるよう少し遅延
      window.setTimeout(() => {
        const a = document.activeElement;
        if (!isTextField(a) && !(a as HTMLElement)?.dataset?.voiceMic) {
          setTarget(null);
        }
      }, 180);
    };
    const onScrollResize = () => {
      const el = targetRef.current;
      if (el && document.contains(el)) setRect(el.getBoundingClientRect());
      else setTarget(null);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [supported, updateRect]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SRClass = getSR();
    if (!SRClass || !targetRef.current) return;
    const el = targetRef.current;
    const rec = new SRClass();
    rec.lang = 'ja-JP';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: any) => {
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) text += ev.results[i][0].transcript;
      }
      if (text) {
        gotResultRef.current = true;
        el.focus();
        insertValue(el, text);
        setFeedback({ type: 'success', text: '入力しました' });
        scheduleFeedbackClear(1600);
        if ('vibrate' in navigator) (navigator as any).vibrate?.(10);
      }
    };
    rec.onerror = (ev: any) => {
      setListening(false);
      // ユーザーが自分で止めた場合（aborted）はエラー扱いしない
      if (ev?.error === 'aborted') { setFeedback(null); return; }
      gotResultRef.current = true; // onend での二重表示を防ぐ
      setFeedback({ type: 'error', text: errorMessage(ev?.error || '') });
      scheduleFeedbackClear(7000);
      if ('vibrate' in navigator) (navigator as any).vibrate?.([10, 40, 10]);
    };
    rec.onend = () => {
      setListening(false);
      // 何も聞き取れずに終わった時も黙らせない
      if (!gotResultRef.current) {
        setFeedback({ type: 'error', text: '聞き取れませんでした。もう一度お試しください。' });
        scheduleFeedbackClear(7000);
      }
    };
    recRef.current = rec;
    try {
      gotResultRef.current = false;
      rec.start();
      setListening(true);
      setFeedback({ type: 'listening', text: '聞いています…話しかけてください' });
      if (fbTimerRef.current) window.clearTimeout(fbTimerRef.current);
      if ('vibrate' in navigator) (navigator as any).vibrate?.(15);
    } catch {
      setListening(false);
      setFeedback({ type: 'error', text: 'マイクを起動できませんでした。もう一度お試しください。' });
      scheduleFeedbackClear(7000);
    }
  }, [scheduleFeedbackClear]);

  if (!supported) return null;

  const retry = () => {
    const el = targetRef.current;
    if (el && document.contains(el)) {
      el.focus();
      setFeedback(null);
      start();
    } else {
      setFeedback({ type: 'error', text: '入力欄をもう一度タップしてから🎤を押してください。' });
      scheduleFeedbackClear(5000);
    }
  };

  // 失敗しても黙らせない: 状況と次の一手を画面下に必ず出す
  const feedbackToast = feedback
    ? createPortal(
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            maxWidth: 'min(92vw, 420px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 14,
            fontSize: 13.5,
            lineHeight: 1.45,
            color: '#fff',
            background:
              feedback.type === 'error'
                ? 'linear-gradient(135deg, #B91C1C, #DC2626)'
                : feedback.type === 'success'
                  ? 'linear-gradient(135deg, #047857, #10B981)'
                  : 'linear-gradient(135deg, #1E3A8A, #2E6FFF)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            animation: 'voiceToastIn 0.22s cubic-bezier(.2,.9,.3,1.2)',
          }}
        >
          <span style={{ flexShrink: 0, display: 'inline-flex' }}>
            {feedback.type === 'error' ? (
              <AlertCircle size={17} />
            ) : feedback.type === 'success' ? (
              <Check size={17} />
            ) : (
              <Mic size={17} className="voice-spin" />
            )}
          </span>
          <span style={{ flex: 1 }}>{feedback.text}</span>
          {feedback.type === 'error' && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={retry}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 11px',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#B91C1C',
                background: '#fff',
              }}
            >
              <RefreshCw size={13} /> もう一度
            </button>
          )}
          <button
            type="button"
            aria-label="閉じる"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFeedback(null)}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              background: 'rgba(255,255,255,0.18)',
            }}
          >
            <X size={14} />
          </button>
          <style>{`
            @keyframes voiceToastIn {
              from { opacity: 0; transform: translate(-50%, 10px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
        </div>,
        document.body,
      )
    : null;

  if (!target || !rect) return feedbackToast;

  // マイクボタンは入力欄の右上内側に配置
  const size = 30;
  const left = Math.min(window.innerWidth - size - 6, rect.right - size - 6);
  const top = Math.max(6, rect.top + (rect.height - size) / 2);

  return (
    <>
      {feedbackToast}
      {createPortal(
    <button
      type="button"
      data-voice-mic="1"
      aria-label={listening ? '音声入力を止める' : '音声で入力'}
      onMouseDown={(e) => e.preventDefault()} // 入力欄の focus を奪わない
      onClick={() => (listening ? stop() : start())}
      style={{
        position: 'fixed',
        left, top,
        width: size, height: size,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        zIndex: 9999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: listening
          ? 'linear-gradient(135deg, #EF4444, #F87171)'
          : 'linear-gradient(135deg, #2E6FFF, #8E5CFF)',
        color: '#fff',
        boxShadow: listening
          ? '0 0 0 4px rgba(239,68,68,0.25), 0 4px 12px rgba(239,68,68,0.5)'
          : '0 4px 12px rgba(46,111,255,0.45)',
        transition: 'background var(--cp-duration-fast) var(--cp-ease-smooth)',
        animation: listening ? 'voiceMicPulse 1.1s ease-in-out infinite' : 'none',
      }}
    >
      {listening ? <Loader2 size={15} className="voice-spin" /> : <Mic size={15} />}
      <style>{`
        @keyframes voiceMicPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.25), 0 4px 12px rgba(239,68,68,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0.05), 0 4px 12px rgba(239,68,68,0.5); }
        }
        .voice-spin { animation: voiceSpin 1s linear infinite; }
        @keyframes voiceSpin { to { transform: rotate(360deg); } }
      `}</style>
    </button>,
        document.body,
      )}
    </>
  );
}
