// ============================================================
// SafeImg — 外部 URL <img> の 「黒いまま放置」 問題を 撲滅する 共通 ラッパー
//
// 用途: Pollinations / OpenAI / YouTube / Cloudinary / Stripe Connect avatar 等、
//       任意 外部 CDN の URL を 表示する 全 <img> に 使う。
//
// 動き:
//   loading  → 🖼 スピン + 「読み込み中…」
//   ok       → 通常 (フェードイン)
//   error    → ⚠️ + 「画像を読み込めません」 + 🔄 再読込 (cache-bust)
//
// 1 回 だけ 自動 cache-bust リトライ する 行儀の 良さ も 標準装備。
// ============================================================
import { useEffect, useState, type CSSProperties, type MouseEventHandler } from 'react';

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;       // e.g. "16/9" — error/loading 時 領域を 保つ
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
  draggable?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  background?: string;        // loading 中の 背景色 (default: #0a0a0f)
  errorLabel?: string;        // 失敗時 表示 (default: 画像を 読み込めません)
  showRetry?: boolean;        // 失敗時 🔄 ボタン (default: true)
  silent?: boolean;           // 失敗時 何も 出さない (avatar 等 装飾的 な 場面)
  fallback?: React.ReactNode; // silent ではなく 独自 fallback を 出す
  objectFit?: CSSProperties['objectFit'];
}

export default function SafeImg({
  src, alt = '', className, style, width, height, aspectRatio,
  loading = 'lazy', decoding = 'async', draggable = false, onClick,
  background = '#0a0a0f', errorLabel = '画像を読み込めません',
  showRetry = true, silent = false, fallback, objectFit = 'cover',
}: Props) {
  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading');
  const [bust, setBust] = useState(0);
  const [autoRetried, setAutoRetried] = useState(false);

  useEffect(() => {
    setPhase('loading'); setBust(0); setAutoRetried(false);
  }, [src]);

  const finalSrc = bust ? `${src}${src.includes('?') ? '&' : '?'}_=${bust}` : src;

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'block',
    width: width ?? '100%',
    height: height ?? (aspectRatio ? undefined : '100%'),
    aspectRatio,
    background,
    overflow: 'hidden',
    ...style,
  };

  return (
    <div className={className} style={wrapperStyle} onClick={onClick}>
      <img
        src={finalSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        onLoad={() => setPhase('ok')}
        onError={() => {
          // 1 回だけ 自動 cache-bust リトライ (鮮度の問題 / 一時的 429 等)
          if (!autoRetried) {
            setAutoRetried(true);
            setBust(Date.now());
            return;
          }
          setPhase('error');
        }}
        style={{
          width: '100%', height: '100%', objectFit,
          display: 'block',
          opacity: phase === 'ok' ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />
      {phase === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)', fontSize: 11,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 20, animation: 'iris-spin 1.4s linear infinite', display: 'inline-block', opacity: 0.6 }}>🖼️</span>
        </div>
      )}
      {phase === 'error' && !silent && (
        fallback ? <>{fallback}</> : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: 10, background: 'rgba(0,0,0,0.55)',
            color: 'rgba(255,255,255,0.82)',
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.3 }}>{errorLabel}</span>
            {showRetry && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBust(Date.now()); setPhase('loading'); }}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 5, fontWeight: 700,
                  background: 'rgba(251,191,36,0.18)', color: '#FBBF24',
                  border: '1px solid rgba(251,191,36,0.4)', cursor: 'pointer',
                }}
              >🔄 再読込</button>
            )}
          </div>
        )
      )}
    </div>
  );
}
