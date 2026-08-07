// LP用・モバイル追従CTA（共有部品）。
// ヒーローを過ぎたら下からスッと現れ、ページ末尾では引っ込む。
// 「読んでいる途中で始めたくなった瞬間」を逃さない、売れる導線の最後の一押し。
// corp / Prism / Iris / Crystal の各LPが、自分のブランド色と主CTAを渡して使う。
import { useEffect, useState } from 'react';
import { contrast, whiteSafeGradient } from '../lib/accentFace';

export default function LpStickyCta({
  title,
  sub,
  cta,
  href,
  onClick,
  accent1,
  accent2,
  ctaColor = '#1a1408',
}: {
  title: string;
  sub: string;
  cta: string;
  href?: string;
  onClick?: () => void;
  accent1: string;
  accent2: string;
  ctaColor?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const nearEnd = window.innerHeight + y > document.body.scrollHeight - 640;
      setShow(y > 560 && !nearEnd && window.innerWidth < 760);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // 白い文字を乗せる回（Prism LP は #a78bfa→#6366F1 で白 2.20、Iris は #E1306C で 4.34）だけ
  // 面の側を「白が通るところまで」暗くする。金の面は濃い文字(ctaColor=#1a1408)を乗せるので触らない。
  // ＝ページを読んでいる途中で「始めたくなった瞬間」に出る最後の一押しが読めない事故を面の側で塞ぐ。
  const inkIsWhite = contrast(ctaColor, '#000000') > 15;
  const faceBg = inkIsWhite
    ? whiteSafeGradient([accent1, accent2], 135)
    : `linear-gradient(135deg, ${accent1}, ${accent2})`;

  const btnStyle: React.CSSProperties = {
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    padding: '12px 20px',
    borderRadius: 999,
    background: faceBg,
    color: ctaColor,
    fontWeight: 800,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: `0 10px 26px -10px ${accent2}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      aria-hidden={!show}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
        background: 'rgba(9,9,16,.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid ${accent1}55`,
        transform: show ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform .5s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#fff', lineHeight: 1.35 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>{sub}</div>
      </div>
      {href ? (
        <a href={href} style={btnStyle}>{cta}</a>
      ) : (
        <button type="button" onClick={onClick} style={btnStyle}>{cta}</button>
      )}
    </div>
  );
}
