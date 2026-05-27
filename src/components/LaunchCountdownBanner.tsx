// ============================================================
// 6/1 一般公開カウントダウンバナー
// Prism (紫) / Iris (ピンク) でブランド色を切り替え
// 閉じる × で当日中は非表示 (localStorage)
// prefers-reduced-motion: reduce ではアニメ無効
// ============================================================
import { useEffect, useMemo, useState } from 'react';

interface Props {
  kind: 'prism' | 'iris';
}

const LAUNCH_AT = new Date('2026-06-01T00:00:00+09:00').getTime();

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(kind: 'prism' | 'iris'): string {
  return `core-prism:launch-banner-closed:${kind}:${todayKey()}`;
}

export default function LaunchCountdownBanner({ kind }: Props) {
  const [closed, setClosed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(storageKey(kind)) === '1';
    } catch {
      return false;
    }
  });

  // 残日数を 1 分ごとに再計算 (深夜跨ぎに対応)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const daysLeft = useMemo(() => {
    return Math.ceil((LAUNCH_AT - now) / 86_400_000);
  }, [now]);

  const isLaunched = daysLeft <= 0;

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  if (closed) return null;

  const handleClose = () => {
    try {
      localStorage.setItem(storageKey(kind), '1');
    } catch { /* quota — そのまま閉じる */ }
    setClosed(true);
  };

  const gradient =
    kind === 'iris'
      ? 'linear-gradient(90deg, #FF7AB6 0%, #E1306C 50%, #B22A6C 100%)'
      : 'linear-gradient(90deg, #A78BFA 0%, #7C3AED 50%, #5B21B6 100%)';

  const message = isLaunched ? (
    <>
      🎉 公開中! <strong>招待で +30 日延長</strong> — ご紹介でお互いにお得に
    </>
  ) : (
    <>
      🎉 6/1 一般公開まで残り <strong>{daysLeft} 日</strong> — 今登録すると <strong>+30 日無料</strong>
    </>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="core-launch-banner"
      style={{
        background: gradient,
        color: '#fff',
        textAlign: 'center',
        padding: '0.6rem 2.5rem 0.6rem 1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        position: 'relative',
        zIndex: 70,
        lineHeight: 1.5,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          animation: reducedMotion ? 'none' : 'core-banner-pulse 2.4s ease-in-out infinite',
        }}
      >
        {message}
      </span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="バナーを閉じる"
        style={{
          position: 'absolute',
          top: '50%',
          right: '0.5rem',
          transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.18)',
          border: 'none',
          color: '#fff',
          width: 24,
          height: 24,
          borderRadius: '50%',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes core-banner-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.92; transform: scale(1.015); }
        }
        @media (prefers-reduced-motion: reduce) {
          .core-launch-banner span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
