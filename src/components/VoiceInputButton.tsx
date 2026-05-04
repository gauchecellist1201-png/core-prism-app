// ============================================================
// 🎙 音声入力ボタン — 任意の text input/textarea に並べて使う
// 既存の useVoiceInput hook をラップ
// ============================================================
import { useCallback } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';

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

  if (!isAvailable) return null; // 非対応ブラウザではボタン非表示

  const isListening = state === 'listening';

  return (
    <button
      type="button"
      onClick={isListening ? stop : start}
      title={interim ? `🎙 認識中: ${interim}` : title}
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
        boxShadow: isListening
          ? `0 0 0 4px ${accentColor}33, 0 4px 12px ${accentColor}55`
          : '0 1px 3px rgba(0,0,0,0.08)',
        animation: isListening ? 'voice-pulse 1.6s ease-in-out infinite' : 'none',
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {isListening ? '⏹' : '🎙'}
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${accentColor}33, 0 4px 12px ${accentColor}55; }
          50%      { box-shadow: 0 0 0 10px ${accentColor}11, 0 4px 16px ${accentColor}88; }
        }
      `}</style>
    </button>
  );
}
