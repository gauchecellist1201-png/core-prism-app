import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import { fmtJpy } from '../lib/invoiceCalc';
import { EXPENSE_CATEGORIES } from '../types/expense';

interface Props {
  persona: Persona;
  onClose: () => void;
}

type Period = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'last12';

function periodRange(p: Period): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  if (p === 'thisMonth') {
    return { start: `${ym(y, m)}-01`, end: `${ym(y, m)}-${lastDay(y, m)}`, label: `${y}年${m + 1}月` };
  }
  if (p === 'lastMonth') {
    const ly = m === 0 ? y - 1 : y, lm = m === 0 ? 11 : m - 1;
    return { start: `${ym(ly, lm)}-01`, end: `${ym(ly, lm)}-${lastDay(ly, lm)}`, label: `${ly}年${lm + 1}月` };
  }
  if (p === 'thisQuarter') {
    const qStart = Math.floor(m / 3) * 3;
    return { start: `${ym(y, qStart)}-01`, end: `${ym(y, qStart + 2)}-${lastDay(y, qStart + 2)}`, label: `${y}年Q${Math.floor(m / 3) + 1}` };
  }
  if (p === 'thisYear') {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}年` };
  }
  // last12
  const startD = new Date(y, m - 11, 1);
  return { start: `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-01`, end: `${y}-12-31`, label: '直近12ヶ月' };
}

export default function PnLStudio({ persona, onClose }: Props) {
  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();
  const [period, setPeriod] = useState<Period>('thisMonth');
  const r = periodRange(period);

  const sales = useMemo(
    () => ledger.entries.filter(e =>
      e.personaId === persona.id && e.date >= r.start && e.date <= r.end
    ),
    [ledger.entries, persona.id, r.start, r.end]
  );
  const expenses = useMemo(
    () => exp.entries.filter(e =>
      e.personaId === persona.id && e.date >= r.start && e.date <= r.end
    ),
    [exp.entries, persona.id, r.start, r.end]
  );

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, e) => s + e.totalExcl, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amountExcl, 0);
    const grossProfit = revenue - expenseTotal;
    const grossMargin = revenue === 0 ? 0 : (grossProfit / revenue) * 100;
    const paidRevenue = sales.reduce((s, e) => s + (e.status === 'paid' ? e.totalIncl : (e.paidAmount || 0)), 0);
    const unpaidRevenue = sales.reduce((s, e) => s + e.totalIncl, 0) - paidRevenue;
    return { revenue, expenseTotal, grossProfit, grossMargin, paidRevenue, unpaidRevenue, salesCount: sales.length, expenseCount: expenses.length };
  }, [sales, expenses]);

  // 経費科目別
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) || 0) + e.amountExcl);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // 月次推移 (過去12ヶ月)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const out: { ym: string; revenue: number; expense: number; profit: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const revenue = ledger.entries
        .filter(e => e.personaId === persona.id && e.date.startsWith(ym))
        .reduce((s, e) => s + e.totalExcl, 0);
      const expense = exp.entries
        .filter(e => e.personaId === persona.id && e.date.startsWith(ym))
        .reduce((s, e) => s + e.amountExcl, 0);
      out.push({ ym, revenue, expense, profit: revenue - expense });
    }
    return out;
  }, [ledger.entries, exp.entries, persona.id]);

  const handleExportCsv = () => {
    const rows = [
      ['CORE Prism P&L', persona.name, r.label],
      [],
      ['項目', '金額(税抜)'],
      ['売上高', totals.revenue],
      ['経費合計', totals.expenseTotal],
      ['粗利益', totals.grossProfit],
      [`粗利率`, `${totals.grossMargin.toFixed(1)}%`],
      [],
      ['経費科目別'],
      ...byCategory.map(([c, a]) => [c, a]),
      [],
      ['月次推移 (税抜)'],
      ['月', '売上', '経費', '利益'],
      ...monthlyTrend.map(m => [m.ym, m.revenue, m.expense, m.profit]),
    ];
    const escape = (v: any) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map(r => Array.isArray(r) ? r.map(escape).join(',') : '').join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PnL_${persona.name}_${r.label}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="cp-modal" style={{ maxWidth: '1100px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}>

        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>📊</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">P&L 損益計算書</p>
              <p className="cp-meta truncate">{persona.name} · 売上台帳 + 経費 から自動算出</p>
            </div>
          </div>
          <div className="cp-row">
            <button onClick={handleExportCsv}
              className="cp-btn cp-btn-sm"
              style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>⬇ CSV</button>
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
          </div>
        </div>

        <div className="cp-modal-body cp-stack">
          {/* 期間切替 */}
          <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {([
              { id: 'thisMonth' as Period,    label: '今月' },
              { id: 'lastMonth' as Period,    label: '先月' },
              { id: 'thisQuarter' as Period,  label: '今四半期' },
              { id: 'thisYear' as Period,     label: '今年' },
              { id: 'last12' as Period,       label: '直近12ヶ月' },
            ]).map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className="cp-btn cp-btn-sm"
                style={period === p.id ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' } : {}}>
                {p.label}
              </button>
            ))}
            <span className="cp-meta ml-auto">{r.label}</span>
          </div>

          {/* サマリー */}
          <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="cp-card text-center">
              <p className="cp-tiny">売上高</p>
              <p className="text-fg" style={{ fontSize: '1.45rem', fontWeight: 600, fontFamily: 'monospace' }}>{fmtJpy(totals.revenue)}</p>
              <p className="cp-meta">{totals.salesCount}件</p>
            </div>
            <div className="cp-card text-center">
              <p className="cp-tiny">経費</p>
              <p className="text-fg" style={{ fontSize: '1.45rem', fontWeight: 600, fontFamily: 'monospace', color: '#FF6B6B' }}>{fmtJpy(totals.expenseTotal)}</p>
              <p className="cp-meta">{totals.expenseCount}件</p>
            </div>
            <div className="cp-card text-center">
              <p className="cp-tiny">粗利益</p>
              <p className="text-fg" style={{ fontSize: '1.45rem', fontWeight: 600, fontFamily: 'monospace', color: totals.grossProfit >= 0 ? '#4ADE80' : '#FF6B6B' }}>{fmtJpy(totals.grossProfit)}</p>
              <p className="cp-meta">{totals.grossProfit >= 0 ? '黒字' : '赤字'}</p>
            </div>
            <div className="cp-card text-center">
              <p className="cp-tiny">粗利率</p>
              <p className="text-fg" style={{ fontSize: '1.45rem', fontWeight: 600, color: persona.accentColor }}>{totals.grossMargin.toFixed(1)}%</p>
              <p className="cp-meta">対 売上</p>
            </div>
          </div>

          {/* 月次推移グラフ */}
          <div className="cp-card-section">
            <p className="cp-h3 mb-3">📈 過去12ヶ月の推移 (税抜)</p>
            <MonthlyChart series={monthlyTrend} color={persona.accentColor} />
            <div className="cp-row mt-3" style={{ gap: 16, justifyContent: 'center' }}>
              <span className="cp-meta"><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: persona.accentColor, verticalAlign: 'middle' }}></span> 売上</span>
              <span className="cp-meta"><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: '#FF6B6B', verticalAlign: 'middle' }}></span> 経費</span>
              <span className="cp-meta"><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: '#4ADE80', verticalAlign: 'middle' }}></span> 利益</span>
            </div>
          </div>

          {/* 経費科目別 */}
          {byCategory.length > 0 && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">💼 経費科目別 ({r.label})</p>
              {byCategory.map(([cat, amt]) => {
                const meta = EXPENSE_CATEGORIES.find(c => c.value === cat);
                const pct = totals.expenseTotal > 0 ? (amt / totals.expenseTotal) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="cp-row-between" style={{ gap: 8 }}>
                      <span className="text-fg cp-body">
                        <span className="mr-1">{meta?.emoji}</span>{cat}
                      </span>
                      <span className="cp-meta font-mono">{fmtJpy(amt)} <span className="cp-tiny">{pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--surface-3)' }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: meta?.color || '#888' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 入金状況 */}
          <div className="cp-card-section">
            <p className="cp-h3 mb-2">💰 入金状況</p>
            <div className="cp-grid-2">
              <div className="cp-card">
                <p className="cp-tiny">入金済み</p>
                <p className="text-fg" style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'monospace', color: '#4ADE80' }}>
                  {fmtJpy(totals.paidRevenue)}
                </p>
              </div>
              <div className="cp-card">
                <p className="cp-tiny">未入金</p>
                <p className="text-fg" style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'monospace', color: '#FF6B6B' }}>
                  {fmtJpy(totals.unpaidRevenue)}
                </p>
              </div>
            </div>
          </div>

          {sales.length === 0 && expenses.length === 0 && (
            <div className="cp-empty">
              <p className="cp-empty-icon">📭</p>
              <p>この期間にデータがありません</p>
              <p className="cp-meta mt-2">請求書を発行するか、経費OCRで読み込むとここに反映されます</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MonthlyChart({ series, color }: { series: { ym: string; revenue: number; expense: number; profit: number }[]; color: string }) {
  const max = Math.max(...series.map(s => Math.max(s.revenue, s.expense, Math.abs(s.profit))), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {series.map(s => {
        const rH = (s.revenue / max) * 100;
        const eH = (s.expense / max) * 100;
        const pH = (Math.abs(s.profit) / max) * 100;
        return (
          <div key={s.ym} className="flex-1 flex flex-col items-stretch gap-0.5 min-w-0">
            <div className="flex-1 flex items-end gap-0.5">
              <div className="flex-1 rounded-sm" style={{ background: color, height: `${rH}%`, minHeight: rH > 0 ? '2px' : 0 }} title={`売上 ${s.revenue.toLocaleString()}`} />
              <div className="flex-1 rounded-sm" style={{ background: '#FF6B6B', height: `${eH}%`, minHeight: eH > 0 ? '2px' : 0 }} title={`経費 ${s.expense.toLocaleString()}`} />
              <div className="flex-1 rounded-sm" style={{ background: s.profit >= 0 ? '#4ADE80' : '#FF6B6B', height: `${pH}%`, minHeight: pH > 0 ? '2px' : 0, opacity: 0.7 }} title={`利益 ${s.profit.toLocaleString()}`} />
            </div>
            <p className="text-[8px] text-center" style={{ color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>{s.ym.slice(5)}</p>
          </div>
        );
      })}
    </div>
  );
}
