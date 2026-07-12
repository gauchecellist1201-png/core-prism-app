// ============================================================
// 6/1 一般公開カウントダウンバナー
// Prism (紫) / Iris (ピンク) でブランド色を切り替え
// 閉じる × で当日中は非表示 (localStorage)
// prefers-reduced-motion: reduce ではアニメ無効
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { REFERRAL_BONUS_DAYS } from '../lib/referral';
import { useT } from '../i18n';

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
  // LP本文の言語 (ja/en) に追従させる — 英語閲覧時に日本語が混ざらないように
  const { lang } = useT();
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

  // OS絵文字は使わない(恒久ルール) — ラインアイコンのギフトで置き換え
  const giftIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 6 }} aria-hidden>
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
  const message = isLaunched ? (
    lang === 'en' ? (
      <>
        {giftIcon}Sign up with an invite link and you and your friend{' '}
        <strong>each get +{REFERRAL_BONUS_DAYS} days free</strong>
      </>
    ) : (
      <>
        {giftIcon}招待リンクで登録すると、あなたも招待した友達も{' '}
        <strong>お互いに +{REFERRAL_BONUS_DAYS} 日 無料</strong>
      </>
    )
  ) : (
    lang === 'en' ? (
      <>
        {giftIcon}<strong>{daysLeft} days</strong> until public launch — sign up with an invite code for{' '}
        <strong>+{REFERRAL_BONUS_DAYS} days free</strong>
      </>
    ) : (
      <>
        {giftIcon}一般公開まで残り <strong>{daysLeft} 日</strong> — 招待コードで登録すると{' '}
        <strong>+{REFERRAL_BONUS_DAYS} 日 無料</strong>
      </>
    )
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
        padding: '0.6rem 3rem 0.6rem 1rem',
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
      {/* 閉じる×: 見た目は 24px の丸のまま、押せる領域を 44×44px に拡大 (誤タップ・押せないイラつき防止) */}
      <button
        type="button"
        onClick={handleClose}
        aria-label={lang === 'en' ? 'Close banner' : 'バナーを閉じる'}
        style={{
          position: 'absolute',
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: 44,
          height: 44,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            width: 24,
            height: 24,
            borderRadius: '50%',
            fontSize: '0.8rem',
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </span>
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
