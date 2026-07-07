// ヒーローの「触れるデモ」— 主張(DMスクショ→案件登録30秒)を、その場で体験させる。
// 純クライアント・サンプル明記(honest)。タップ→AI読み取り演出→構造化された案件カードに変身。
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { IRIS_COLORS, IRIS_FONTS } from './irisStyle';

const C = IRIS_COLORS;

export default function IrisHeroDemo({ onStart }: { onStart: () => void }) {
  const [phase, setPhase] = useState<'dm' | 'reading' | 'card'>('dm');

  const run = () => {
    if (phase !== 'dm') return;
    setPhase('reading');
    setTimeout(() => setPhase('card'), 1400);
  };

  return (
    <div style={{ marginTop: '2rem', maxWidth: 420 }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', color: C.hotPink, marginBottom: '0.6rem', textTransform: 'uppercase' }}>
        30秒の魔法を、いま体験 — サンプルDM
      </p>

      <div style={{
        borderRadius: 20, border: `1px solid rgba(225,48,108,0.25)`, background: 'rgba(255,255,255,0.04)',
        padding: '1rem', backdropFilter: 'blur(8px)', boxShadow: '0 24px 70px -24px rgba(225,48,108,0.45)',
      }}>
        {/* 退場アニメは重なり事故を起こすため使わない(キー切替の入場のみ) */}
        {phase !== 'card' ? (
            <motion.div key="dm">
              {/* Instagram DM 風の受信バブル */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C.purple}, ${C.hotPink})`, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 800 }}>B</div>
                <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '4px 16px 16px 16px', padding: '0.7rem 0.85rem', fontSize: '0.82rem', lineHeight: 1.7, color: C.ivoryDeep }}>
                  はじめまして、Bloom Cosmetics PR担当です。新作リップのご紹介投稿をお願いできますか？
                  <b style={{ color: C.cream }}>報酬は¥50,000</b>、投稿は<b style={{ color: C.cream }}>7/25まで</b>を想定しています。
                </div>
              </div>

              <button
                type="button"
                onClick={run}
                disabled={phase === 'reading'}
                style={{
                  marginTop: '0.9rem', width: '100%', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: phase === 'reading' ? 'rgba(255,255,255,0.10)' : `linear-gradient(90deg, ${C.hotPink}, ${C.purple})`,
                  color: '#fff', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.02em',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {phase === 'reading' ? (
                  <motion.span initial={{ opacity: 0.6 }} animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} /> AIが読み取っています…
                  </motion.span>
                ) : (
                  <><Sparkles size={16} /> このDMをAIに読み取らせる</>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div key="card" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}>
              {/* 変身後: 構造化された案件カード */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.1em', color: C.hotPink, border: `1px solid rgba(225,48,108,0.4)`, borderRadius: 999, padding: '3px 10px' }}>案件として登録されました</span>
                <span style={{ fontSize: '0.66rem', color: 'rgba(255,250,245,0.45)' }}>所要 数秒</span>
              </div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.cream }}>Bloom Cosmetics — 新作リップPR</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {[['報酬', '¥50,000'], ['期日', '7/25 投稿'], ['形式', 'フィード投稿'], ['状態', '交渉中']].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.55rem 0.7rem' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,250,245,0.5)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.ivory }}>{v}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  // LPの約束(DMスクショ→案件登録)を入室後に直結: ホーム経由の迷子を無くす
                  try { sessionStorage.setItem('iris_intent_dm_capture', '1'); } catch { /* private mode */ }
                  onStart();
                }}
                style={{
                  marginTop: '0.9rem', width: '100%', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(90deg, ${C.hotPink}, ${C.purple})`, color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                自分のDMでやってみる（7日間無料） <ArrowRight size={16} strokeWidth={2.6} />
              </button>
              <button type="button" onClick={() => setPhase('dm')} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'rgba(255,250,245,0.4)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                もう一度みる
              </button>
            </motion.div>
          )}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'rgba(255,250,245,0.4)', marginTop: '0.55rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
        体験用のサンプルです。実際はDMのスクショを投げるだけで、AIが交渉文まで用意します。
      </p>
    </div>
  );
}
