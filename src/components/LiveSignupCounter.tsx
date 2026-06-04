// ============================================================
// LiveSignupCounter — 業界 LP に「累計 N 社が 7 日 無料 を 始めました」
//
// オーナー指示 (2026-06-04 第 45 波 SSSSSS):
//   /api/signup-count を 取得し、Hero と Pain の間に 大きく 表示。
//   source='live' なら 通常、'demo' なら 注釈、'fallback' (0) なら 非表示。
//   嘘禁止: 「demo」 / 「サンプル」 を 明示。
// ============================================================

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Resp { ok: boolean; count: number; source: 'live' | 'demo' | 'fallback'; asOf: string; }

interface Props {
  accentLeft?: string;
  accentRight?: string;
}

export default function LiveSignupCounter({ accentLeft = '#A78BFA', accentRight = '#F472B6' }: Props) {
  const [data, setData] = useState<Resp | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/signup-count', { cache: 'force-cache' })
      .then((r) => r.ok ? r.json() : null)
      .then((j: any) => { if (!cancelled && j) setData(j as Resp); })
      .catch(() => { /* */ });
    return () => { cancelled = true; };
  }, []);

  // 数字 カウント アップ アニメ (1.2 秒)
  useEffect(() => {
    if (!data?.count) return;
    const target = data.count;
    const start = Date.now();
    const dur = 1200;
    let raf: number | null = null;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      // easeOutQuad
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.floor(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== null) cancelAnimationFrame(raf); };
  }, [data?.count]);

  // 0 or fallback の時 は そもそも 表示しない (嘘禁止)
  if (!data || data.count <= 0 || data.source === 'fallback') return null;

  const isDemo = data.source === 'demo';

  return (
    <section
      aria-label="累計 サインアップ 数"
      style={{
        padding: '2.5rem 1.5rem 2rem',
        background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 100%)',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
          padding: '20px 32px',
          borderRadius: 20,
          background: `linear-gradient(135deg, ${accentLeft}18, ${accentRight}10)`,
          border: `1px solid ${accentLeft}55`,
          boxShadow: `0 12px 40px ${accentLeft}22`,
          maxWidth: 720, width: '100%',
        }}
      >
        <div style={{
          fontSize: 10, letterSpacing: '0.32em', color: accentRight,
          fontWeight: 800, marginBottom: 8,
        }}>
          {isDemo ? 'LIVE (デモ表示)' : 'LIVE COUNT'}
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 'clamp(2.4rem, 7vw, 4rem)',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.02em',
            background: `linear-gradient(120deg, ${accentLeft}, ${accentRight})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {display.toLocaleString('ja-JP')}
          </span>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
            社が 7 日無料 を 始めました
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.6 }}>
          カード登録なし · いつでも 解約可
          {isDemo && (
            <span style={{ marginLeft: 6, color: 'rgba(251,191,36,0.85)' }}>
              ※ 現在 デモ表示中 (本番接続 後は 実数字)
            </span>
          )}
        </div>
        {/* リアルタイム 心拍 ドット */}
        <span aria-hidden="true" style={{
          position: 'relative', display: 'inline-block',
          width: 8, height: 8, borderRadius: 4,
          background: isDemo ? '#FBBF24' : '#34D399',
          boxShadow: `0 0 12px ${isDemo ? 'rgba(251,191,36,0.8)' : 'rgba(52,211,153,0.8)'}`,
          marginTop: 10,
        }}>
          <span style={{
            position: 'absolute', inset: -3, borderRadius: 999,
            background: isDemo ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)',
            animation: 'core-pulse 1.8s ease-out infinite',
          }} />
        </span>
        <style>{`@keyframes core-pulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.4); opacity: 0; } }`}</style>
      </motion.div>
    </section>
  );
}
