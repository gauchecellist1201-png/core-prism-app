// ============================================================
// 🎙 音声入力ボタン — 任意の text input/textarea に並べて使う
// 既存の useVoiceInput hook をラップ
// 触感フィードバック (振動 + 微音 + 押下スケール + リップル) 対応
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { triggerHaptic, playClick } from '../lib/haptic';

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

  const { state, isAvailable, start, stop, interim } = useVoiceInput(handleResult, {
    lang: 'ja-JP',
    continuous,
    interimResults: true,
    silenceTimeout: continuous ? 4000 : 2500,
  });

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

  if (!isAvailable) return null; // 非対応ブラウザではボタン非表示

  const isListening = state === 'listening';

  const handleClick = () => {
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
      title={interim ? `🎙 認識中: ${interim}` : title}
      aria-pressed={isListening}
      aria-label={isListening ? '音声入力を止める' : '音声入力を開始'}
      className={className}
      style={{
        background: isListening
          ? `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`
          : 'rgba(255,255,255,0.92)',
        color: isListening ? '#FFFFFF' : '#1F1A2E',
        border: `1px solid ${isListening ? accentColor : 'rgba(31,26,46,0.12)'}`,
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
        boxShadow: isListening
          ? `0 0 0 4px ${accentColor}33, 0 4px 12px ${accentColor}55`
          : pressed
            ? `0 1px 2px rgba(0,0,0,0.10), inset 0 1px 3px rgba(0,0,0,0.08)`
            : '0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        animation: isListening ? 'voice-pulse 1.6s ease-in-out infinite' : 'none',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, background 0.2s ease',
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, transition: 'transform 0.2s', transform: isListening ? 'scale(1.08)' : 'scale(1)' }}>
        {isListening ? '⏹' : '🎙'}
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
      `}</style>
    </button>
  );
}
