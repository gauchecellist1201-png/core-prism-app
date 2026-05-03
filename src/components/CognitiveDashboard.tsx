import { motion } from 'framer-motion';
import type { Persona, PersonaId } from '../types/identity';

interface Props {
  activeId: PersonaId;
  personas: Persona[];
  onEditFinance?: (persona: Persona) => void;
}

function TimeRing({ persona, index }: { persona: Persona; index: number }) {
  const radius = 34 - index * 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (persona.timeAllocation / 100) * circumference;

  return (
    <>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4.5" />
      <motion.circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke={persona.accentColor}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        style={{ transformOrigin: '50px 50px', transform: 'rotate(-90deg)' }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ delay: 0.2 + index * 0.1, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </>
  );
}

export default function CognitiveDashboard({ activeId, personas, onEditFinance }: Props) {
  const totalIncome = personas.reduce((s, p) => s + Math.max(p.cashflow.income, 0), 0);
  const totalExpense = personas.reduce((s, p) => s + Math.abs(Math.min(p.cashflow.expense, 0)), 0);
  const netCashflow = totalIncome - totalExpense;

  const fmt = (n: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', notation: 'compact' }).format(n);

  return (
    <div className="space-y-3">
      {/* Time rings */}
      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-neutral-600 text-xs tracking-widest uppercase mb-3">時間投資</p>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              {personas.map((p, i) => <TimeRing key={p.id} persona={p} index={i} />)}
            </svg>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {personas.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.accentColor }} />
                  <span className="text-xs text-neutral-500 font-light truncate">{p.name}</span>
                </div>
                <span className="text-xs font-light ml-1 flex-shrink-0"
                  style={{ color: p.id === activeId ? p.accentColor : '#3a3a4a' }}>
                  {p.timeAllocation}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Finance */}
      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-neutral-600 text-xs tracking-widest uppercase">財務核心</p>
          {onEditFinance && totalIncome === 0 && totalExpense === 0 && (
            <button
              onClick={() => {
                const active = personas.find(p => p.id === activeId);
                if (active) onEditFinance(active);
              }}
              className="text-[10px] text-fg-muted hover:text-fg underline"
            >資料から抽出</button>
          )}
        </div>

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
                  <span style={{ color: p.accentColor, fontSize: '11px' }}>{p.icon}</span>
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
