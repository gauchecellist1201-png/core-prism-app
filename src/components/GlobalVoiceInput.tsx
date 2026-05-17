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
import { Mic, Loader2 } from 'lucide-react';

function getSR(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
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
  const recRef = useRef<any>(null);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  targetRef.current = target;

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
        el.focus();
        insertValue(el, text);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      if ('vibrate' in navigator) (navigator as any).vibrate?.(15);
    } catch { setListening(false); }
  }, []);

  if (!supported || !target || !rect) return null;

  // マイクボタンは入力欄の右上内側に配置
  const size = 30;
  const left = Math.min(window.innerWidth - size - 6, rect.right - size - 6);
  const top = Math.max(6, rect.top + (rect.height - size) / 2);

  return createPortal(
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
        transition: 'background 0.2s',
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
  );
}
