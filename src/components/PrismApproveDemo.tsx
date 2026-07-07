// ============================================================
// PrismApproveDemo — LP ヒーロー右側の「触れる承認トレイ」
//
// Prism の核 = 「あなたは承認するだけ、実行は AI 役員が」。
// 受動的に眺めるモックではなく、来訪者が実際に「承認」をタップして、
// AI が用意した成果物が送信済みに変わる magic moment を体験させる。
// 純クライアント・サンプル明記(honest)。framer-motion は入場のみ(退場アニメの重なり事故を回避)。
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { CXO_META } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

const BG = 'linear-gradient(150deg, rgba(21,21,42,0.92) 0%, rgba(10,10,24,0.95) 100%)';
const BORDER = 'rgba(167,139,250,0.28)';
const GLOW = 'rgba(167,139,250,0.32)';

// 承認待ちのサンプル成果物（CSO が用意した初回提案メール）
const CSO = CXO_META['CSO'];
const NEXT = CXO_META['CFO'];

export default function PrismApproveDemo({ onEnter }: { onEnter: () => void }) {
  const [state, setState] = useState<'pending' | 'sending' | 'done'>('pending');

  const approve = () => {
    if (state !== 'pending') return;
    setState('sending');
    setTimeout(() => setState('done'), 1100);
  };

  return (
    <div style={{
      position: 'relative', borderRadius: 22, background: BG, border: `1px solid ${BORDER}`,
      padding: '1.1rem 1.1rem 1.25rem',
      boxShadow: `0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px ${GLOW}`,
      overflow: 'hidden', backdropFilter: 'blur(12px)',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: CSO.color, opacity: 0.16, filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* ヘッダ: ウィンドウ風 + LIVE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem', position: 'relative', zIndex: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80' }} />
          LIVE · AI 役員 13 名稼働中
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, fontSize: '0.55rem', letterSpacing: '0.25em', fontWeight: 700, color: CSO.color, marginBottom: '0.6rem', textTransform: 'uppercase' }}>
        承認トレイ · サンプル
      </div>

      {/* 成果物カード */}
      <div style={{ position: 'relative', zIndex: 2, background: 'rgba(255,255,255,0.04)', border: `1px solid ${state === 'done' ? 'rgba(74,222,128,0.4)' : `${CSO.color}40`}`, borderRadius: 14, padding: '0.9rem 1rem', transition: 'border-color 0.5s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.7rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${CSO.color}, ${CSO.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 16px ${CSO.color}55` }}>
            <MetaIcon meta={CSO} size={18} color="#fff" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: CSO.color, fontWeight: 700 }}>{CSO.name}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>初回提案メールを用意しました</div>
          </div>
        </div>

        {state !== 'done' ? (
          <>
            {/* メール下書きプレビュー */}
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, background: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: '0.6rem 0.75rem', marginBottom: '0.85rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>宛先:</span> 株式会社ノースフィールド 様<br />
              「先日の展示会でお話を伺い、御社の◯◯課題に弊社の……」
              <span style={{ color: 'rgba(255,255,255,0.35)' }}> — 本文320字・AI作成済</span>
            </div>

            <button
              type="button"
              onClick={approve}
              disabled={state === 'sending'}
              style={{
                width: '100%', minHeight: 50, borderRadius: 13, border: 'none', cursor: state === 'sending' ? 'default' : 'pointer',
                background: state === 'sending' ? 'rgba(255,255,255,0.10)' : 'linear-gradient(90deg,#a78bfa,#60a5fa)',
                color: '#fff', fontWeight: 800, fontSize: '0.95rem',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {state === 'sending' ? (
                <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} /> AI が送信しています…
                </motion.span>
              ) : (
                <><Check size={17} strokeWidth={2.8} /> 承認して送信</>
              )}
            </button>
            <button type="button" onClick={onEnter} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              AI に修正を指示する
            </button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(74,222,128,0.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} strokeWidth={3} color="#4ade80" />
              </span>
              送信しました
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
              あなたがしたのは、<strong style={{ color: '#fff' }}>タップ1回だけ</strong>。文面の作成も、宛先の選定も、送信も、AI 役員が。
            </p>
          </motion.div>
        )}
      </div>

      {/* 次の承認待ち teaser */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
        <MetaIcon meta={NEXT} size={15} color={NEXT.color} strokeWidth={2.2} />
        <span>次の承認待ち — {NEXT.name}「今月の経費レシート 12 枚の仕訳」</span>
      </div>

      {state === 'done' && (
        <button type="button" onClick={onEnter} style={{ position: 'relative', zIndex: 2, width: '100%', marginTop: '0.9rem', minHeight: 48, borderRadius: 13, border: 'none', cursor: 'pointer', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', color: '#fff', fontWeight: 800, fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          自分の会社で承認してみる（7日間無料） <ArrowRight size={16} strokeWidth={2.6} />
        </button>
      )}

      {/* フッタ: 事実だけ(嘘の数字は書かない) */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
        {[{ label: '初期費用', value: '¥0' }, { label: '無料お試し', value: '7 日' }, { label: '解約', value: '1 タップ' }].map(stat => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.45rem 0.55rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 2 }}>{stat.label}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
