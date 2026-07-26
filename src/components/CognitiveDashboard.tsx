import { motion } from 'framer-motion';
import type { Persona, PersonaId } from '../types/identity';
import MyBusinessRevenueCard from './MyBusinessRevenueCard';
import PersonaGlyph from './PersonaGlyph';

interface Props {
  activeId: PersonaId;
  personas: Persona[];
  onEditFinance?: (persona: Persona) => void;
  onOpenIntegrations?: () => void;
}

export default function CognitiveDashboard({ activeId, personas, onEditFinance, onOpenIntegrations }: Props) {
  const totalIncome = personas.reduce((s, p) => s + Math.max(p.cashflow.income, 0), 0);
  const totalExpense = personas.reduce((s, p) => s + Math.abs(Math.min(p.cashflow.expense, 0)), 0);
  const netCashflow = totalIncome - totalExpense;

  const fmt = (n: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', notation: 'compact' }).format(n);

  return (
    <div className="space-y-3">
      {/* 時間投資リングは 2026-07-26 オーナー指示で廃止（「必要ない」）。
          代わりに売上(財務核心)が右カラムの一番上=一等地に来る。 */}

      {/* Finance */}
      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-start justify-between mb-2 gap-2">
          <div>
            <p className="text-neutral-600 text-xs tracking-widest uppercase">財務核心</p>
            <p className="text-neutral-500 text-[10px] mt-0.5 leading-snug">収入 - 支出 = 手元に残るお金。ペルソナ別の収支も下に並びます</p>
          </div>
          {onEditFinance && totalIncome === 0 && totalExpense === 0 && (
            <button
              onClick={() => {
                const active = personas.find(p => p.id === activeId);
                if (active) onEditFinance(active);
              }}
              className="text-[10px] text-fg-muted hover:text-fg underline flex-shrink-0"
            >資料から抽出</button>
          )}
        </div>

        {/* あなた自身の事業の売上 (連携した Stripe から) */}
        <MyBusinessRevenueCard onOpenIntegrations={onOpenIntegrations} />

        <motion.p className="text-lg font-extralight mb-2"
          style={{ color: netCashflow >= 0 ? '#34d399' : '#f87171' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {netCashflow >= 0 ? '+' : ''}{fmt(netCashflow)}
        </motion.p>

        <div className="space-y-1.5 mb-2">
          {[
            { label: '収入', value: totalIncome, color: '#34d399', pct: 100 },
            { label: '支出', value: -totalExpense, color: '#f87171', pct: totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0 },
          ].map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-neutral-600">{r.label}</span>
                <span style={{ color: r.color }}>{r.value >= 0 ? '' : '-'}{fmt(Math.abs(r.value))}</span>
              </div>
              <div className="h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div className="h-full rounded-full" style={{ background: r.color }}
                  initial={{ width: 0 }} animate={{ width: `${Math.min(r.pct, 100)}%` }}
                  transition={{ delay: 0.4, duration: 0.9 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {personas.map(p => {
            const n = p.cashflow.income + p.cashflow.expense;
            const row = (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <PersonaGlyph icon={p.icon} color={p.accentColor} size={12} />
                  <span className="text-xs text-neutral-600 truncate max-w-16">{p.name}</span>
                </div>
                <span className="text-xs" style={{ color: n >= 0 ? '#34d399' : '#f87171' }}>
                  {n >= 0 ? '+' : ''}{fmt(n)}
                </span>
              </div>
            );
            return onEditFinance ? (
              <button
                key={p.id}
                onClick={() => onEditFinance(p)}
                className="w-full px-1 py-1 rounded hover:bg-white/5 transition-colors text-left"
                title={`${p.name} の収支を編集`}
              >{row}</button>
            ) : (
              <div key={p.id}>{row}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
