// ============================================================
// CreditBar — 今月のクレジット使用量を 1 行で見せる進捗バー
//
// オーナー指示 (2026-05-28): 月額の上限が見えて、超えたら買い足し。
// ダッシュボード上部に常時表示。マスターは表示しない (無制限なので)。
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { getCredits, PLANS, type CreditView } from '../lib/credits';

interface Props {
  onTopUp?: () => void;
  onUpgrade?: () => void;
}

export default function CreditBar({ onTopUp, onUpgrade }: Props) {
  const [view, setView] = useState<CreditView>(() => getCredits());

  useEffect(() => {
    const sync = () => setView(getCredits());
    window.addEventListener('core:credits-updated', sync);
    // 5 秒ごとに同期 (他タブの消費を拾う)
    const t = window.setInterval(sync, 5000);
    return () => {
      window.removeEventListener('core:credits-updated', sync);
      window.clearInterval(t);
    };
  }, []);

  // マスターは表示しない
  if (view.isMaster) return null;

  const plan = PLANS[view.planId as Exclude<typeof view.planId, 'master'>];
  const total = view.limit + view.addon;

  const barColor = view.warning === 'over' ? '#F87171'
    : view.warning === 'hard' ? '#F87171'
    : view.warning === 'soft' ? '#FBBF24'
    : '#34D399';

  const trackColor = 'rgba(255,255,255,0.06)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 12,
      background: view.warning === 'hard' || view.warning === 'over'
        ? 'rgba(248,113,113,0.06)'
        : 'var(--surface-3)',
      border: `1px solid ${view.warning === 'hard' || view.warning === 'over' ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
      marginBottom: '0.85rem',
    }}>
      {/* プラン表示 */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>{plan.emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg)', letterSpacing: '0.04em' }}>
          {plan.name}
        </span>
      </div>

      {/* 使用量 */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: '"SF Mono", "JetBrains Mono", Menlo, monospace',
          fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4,
        }}>
          <span>
            <strong style={{ color: 'var(--fg)', fontSize: 13 }}>{view.used.toLocaleString()}</strong>
            <span style={{ opacity: 0.5 }}> / {total.toLocaleString()}</span>
            {view.addon > 0 && (
              <span style={{ color: '#34D399', marginLeft: 6, fontSize: 10 }}>(+{view.addon} 追加)</span>
            )}
          </span>
          <span style={{ color: barColor, fontWeight: 700 }}>
            {view.warning === 'over' ? '⚠ 上限超過' : `あと ${view.available.toLocaleString()}`}
          </span>
        </div>
        <div style={{
          width: '100%', height: 6, borderRadius: 999,
          background: trackColor, overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${view.pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
              boxShadow: `0 0 8px ${barColor}66`,
            }}
          />
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {view.warning === 'soft' || view.warning === 'hard' || view.warning === 'over' ? (
          <button
            type="button"
            onClick={onTopUp}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 8,
              background: `linear-gradient(135deg, ${barColor}, ${barColor}cc)`,
              color: '#0a0a0f', border: 'none', fontSize: 11.5, fontWeight: 800,
              cursor: 'pointer', boxShadow: `0 4px 12px ${barColor}44`,
            }}
          >
            <Plus size={12} /> 買い足す
          </button>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'transparent', color: 'var(--fg-muted)',
              border: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            プラン
          </button>
        )}
      </div>
    </div>
  );
}
