// ============================================================
// 🎙 音声入力ボタン — 任意の text input/textarea に並べて使う
// 既存の useVoiceInput hook をラップ
// 触感フィードバック (振動 + 微音 + 押下スケール + リップル) 対応
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useAudioDictation, isIosSafari } from '../hooks/useAudioDictation';
import { triggerHaptic, playClick, tactileError } from '../lib/haptic';
import { notifyInApp } from '../lib/inAppNotify';

/** エラーコード → やさしい復旧メッセージ */
function recoveryMessage(code: string | null): { title: string; body: string } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        title: 'マイクの使用が許可されていません',
        body: 'ブラウザのアドレスバーの🔒からマイクを「許可」にして、もう一度ボタンをタップしてください。',
      };
    case 'audio-capture':
      return {
        title: 'マイクが見つかりませんでした',
        body: 'マイクが接続されているか確認して、もう一度タップしてください。',
      };
    case 'network':
      return {
        title: 'ネットワークが不安定です',
        body: '通信環境を確認して、もう一度ボタンをタップしてください。',
      };
    default:
      return {
        title: '音声をうまく拾えませんでした',
        body: 'もう一度ボタンをタップすると、すぐに録り直せます。',
      };
  }
}

interface Props {
  /** 認識結果を text として受け取る (現在値 + スペース + 結果) */
  onText: (newText: string) => void;
  /** 現在の text の値 (追記モード) */
  currentValue?: string;
  /** 連続認識 (デフォルト false: 一文ずつ確定) */
  continuous?: boolean;
  /** ボタンの表示色 (アクセント) */
  accentColor?: string;
  /** サイズ (px), default 36 */
  size?: number;
  /** ツールチップ */
  title?: string;
  /** className 追加 */
  className?: string;
  /** style 追加 */
  style?: React.CSSProperties;
}

export default function VoiceInputButton({
  onText, currentValue = '',
  continuous = false,
  accentColor = '#FF1493',
  size = 36,
  title = '音声入力 (日本語)',
  className,
  style,
}: Props) {
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (!isFinal) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const sep = currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n') ? ' ' : '';
    onText(currentValue + sep + trimmed);
  }, [currentValue, onText]);

  const web = useVoiceInput(handleResult, {
    lang: 'ja-JP',
    continuous,
    interimResults: true,
    silenceTimeout: continuous ? 4000 : 2500,
  });
  // iOS Safari は Web Speech が動かない → MediaRecorder 録音→文字起こしに切替(2026-07-08)
  const dict = useAudioDictation((t) => handleResult(t, true));
  const useRecorder = isIosSafari() || !web.isAvailable;
  const isAvailable = useRecorder ? dict.isAvailable : web.isAvailable;
  const state = useRecorder
    ? (dict.state === 'recording' ? 'listening' : dict.state === 'transcribing' ? 'processing' : dict.state)
    : web.state;
  const interim = useRecorder ? '' : web.interim;
  const errorCode = useRecorder ? dict.errorCode : web.errorCode;
  const start = useRecorder ? () => { dict.reset(); dict.start(); } : web.start;
  const stop = useRecorder ? dict.stop : web.stop;

  const [pressed, setPressed] = useState(false);
  const [ripple, setRipple] = useState(0);
  const wasListeningRef = useRef(false);

  // 認識結果が確定した瞬間に「成功」のタクタイル
  useEffect(() => {
    if (wasListeningRef.current && state !== 'listening') {
      triggerHaptic('success');
      playClick('success');
    }
    wasListeningRef.current = state === 'listening';
  }, [state]);

  const isListening = state === 'listening';
  const isProcessing = state === 'processing';
  const isError = state === 'error';

  // 非対応ブラウザでも「無言で消える」のはやめて、押すと理由が分かる説明ボタンを残す
  if (!isAvailable) {
    return (
      <button
        type="button"
        onClick={() => {
          triggerHaptic('warning');
          playClick('close');
          notifyInApp({
            kind: 'info',
            title: 'このブラウザは音声入力に未対応です',
            body: 'Chrome または Safari（iPhone は標準ブラウザ）でひらくと、マイクで入力できます。',
          });
        }}
        title="このブラウザは音声入力に未対応（タップで案内）"
        aria-label="音声入力はこのブラウザでは使えません"
        className={className}
        style={{
          background: 'rgba(255,255,255,0.6)',
          color: '#9A93A8',
          border: '1px dashed rgba(31,26,46,0.18)',
          borderRadius: '50%',
          width: size, height: size,
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontSize: size * 0.42,
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          ...style,
        }}
      >
        <span aria-hidden>🎙</span>
      </button>
    );
  }

  const handleClick = () => {
    if (isProcessing) return; // 文字起こし中は待つ
    if (isError) {
      // 失敗状態 → タップで「何が起きたか + 直し方」を出して即リトライ
      tactileError();
      const msg = recoveryMessage(errorCode);
      notifyInApp({ kind: 'warn', title: msg.title, body: msg.body });
      setRipple(r => r + 1);
      start(); // error を idle に戻してから録り直し
      return;
    }
    triggerHaptic(isListening ? 'medium' : 'light');
    playClick(isListening ? 'close' : 'open');
    setRipple(r => r + 1);
    if (isListening) stop(); else start();
  };

  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={handleClick}
      title={
        isError
          ? `${recoveryMessage(errorCode).title}（タップで再試行）`
          : interim
            ? `🎙 認識中: ${interim}`
            : title
      }
      aria-pressed={isListening}
      aria-label={isError ? '音声入力に失敗。タップで再試行' : isListening ? '音声入力を止める' : '音声入力を開始'}
      className={className}
      style={{
        background: isError
          ? 'linear-gradient(135deg, #FFB020, #F58A00)'
          : isListening
            ? `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`
            : 'rgba(255,255,255,0.92)',
        color: isError ? '#FFFFFF' : isListening ? '#FFFFFF' : '#1F1A2E',
        border: `1px solid ${isError ? '#F58A00' : isListening ? accentColor : 'rgba(31,26,46,0.12)'}`,
        borderRadius: '50%',
        width: size, height: size,
        display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        fontSize: size * 0.45,
        flexShrink: 0,
        position: 'relative',
        overflow: 'visible',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        touchAction: 'manipulation',
        boxShadow: isError
          ? '0 0 0 4px rgba(245,138,0,0.22), 0 4px 12px rgba(245,138,0,0.40)'
          : isListening
            ? `0 0 0 4px ${accentColor}33, 0 4px 12px ${accentColor}55`
            : pressed
              ? `0 1px 2px rgba(0,0,0,0.10), inset 0 1px 3px rgba(0,0,0,0.08)`
              : '0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        animation: isListening ? 'voice-pulse 1.6s ease-in-out infinite' : isError ? 'voice-nudge 1.8s ease-in-out infinite' : 'none',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, background 0.2s ease',
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, transition: 'transform 0.2s', transform: isListening ? 'scale(1.08)' : 'scale(1)', display: 'inline-flex', animation: isProcessing ? 'voice-spin 0.9s linear infinite' : 'none' }}>
        {isError ? '↻' : isProcessing ? '◌' : isListening ? '⏹' : '🎙'}
      </span>
      {/* リップル波紋 */}
      <span
        key={ripple}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          background: `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)`,
          opacity: 0,
          animation: ripple > 0 ? 'voice-ripple 0.5s ease-out' : 'none',
        }}
      />
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${accentColor}33, 0 4px 12px ${accentColor}55; }
          50%      { box-shadow: 0 0 0 10px ${accentColor}11, 0 4px 16px ${accentColor}88; }
        }
        @keyframes voice-ripple {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes voice-nudge {
          0%, 88%, 100% { box-shadow: 0 0 0 4px rgba(245,138,0,0.22), 0 4px 12px rgba(245,138,0,0.40); }
          94%           { box-shadow: 0 0 0 9px rgba(245,138,0,0.08), 0 4px 16px rgba(245,138,0,0.55); }
        }
        @keyframes voice-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
