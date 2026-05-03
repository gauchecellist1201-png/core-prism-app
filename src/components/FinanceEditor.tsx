import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  hasFinancialKnowledge: boolean;
  onSave: (income: number, expense: number, label: string) => void;
  onRecompute: () => Promise<{
    success: boolean;
    totalIncome: number;
    totalExpense: number;
    period?: string;
    sources: number;
    failed: number;
    error?: string;
  }>;
  onClose: () => void;
}

function parseAmount(s: string): number {
  // 「1,000,000」「1,000万」「100万」「1.5億」などを円に変換
  const trimmed = s.trim().replace(/[¥￥,，]/g, '');
  if (!trimmed) return 0;
  const m = trimmed.match(/^(-?[\d.]+)\s*(億|百万|万|千)?\s*円?$/);
  if (m) {
    const n = parseFloat(m[1]);
    const unit = m[2];
    if (unit === '億') return Math.round(n * 100_000_000);
    if (unit === '百万') return Math.round(n * 1_000_000);
    if (unit === '万') return Math.round(n * 10_000);
    if (unit === '千') return Math.round(n * 1_000);
    return Math.round(n);
  }
  const n = Number(trimmed);
  return isNaN(n) ? 0 : Math.round(n);
}

function fmtJpy(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

export default function FinanceEditor({ persona, hasFinancialKnowledge, onSave, onRecompute, onClose }: Props) {
  const [incomeStr, setIncomeStr] = useState(String(persona.cashflow.income || ''));
  const [expenseStr, setExpenseStr] = useState(String(Math.abs(persona.cashflow.expense) || ''));
  const [label, setLabel] = useState(persona.cashflow.label || `${persona.name}の収支`);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const income = parseAmount(incomeStr);
  const expense = parseAmount(expenseStr);
  const net = income - expense;

  const handleSave = () => {
    onSave(income, -Math.abs(expense), label.trim() || `${persona.name}の収支`);
    onClose();
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    setRecomputeResult(null);
    try {
      const result = await onRecompute();
      if (result.success) {
        setIncomeStr(String(result.totalIncome));
        setExpenseStr(String(result.totalExpense));
        if (result.period) setLabel(`${persona.name}・${result.period}`);
        setRecomputeResult({
          ok: true,
          msg: `${result.sources}件の財務資料から抽出: 収入${fmtJpy(result.totalIncome)} / 支出${fmtJpy(result.totalExpense)}${result.failed > 0 ? ` (${result.failed}件失敗)` : ''}`,
        });
      } else {
        setRecomputeResult({ ok: false, msg: result.error || '抽出できませんでした' });
      }
    } catch (e) {
      setRecomputeResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >{persona.icon}</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">{persona.name} の収支</p>
              <p className="text-fg-muted text-xs truncate">手動編集 / AI で資料から抽出</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* AI から再計算 */}
          <div
            className="rounded-xl p-3"
            style={{
              background: hasFinancialKnowledge ? `${persona.accentColor}12` : 'var(--surface-3)',
              border: `1px solid ${hasFinancialKnowledge ? persona.accentColor + '50' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-start gap-3 mb-2">
              <span className="text-xl mt-0.5">🤖</span>
              <div className="flex-1 min-w-0">
                <p className="text-fg text-sm font-semibold">AI で資料から再計算</p>
                <p className="text-fg-muted text-xs leading-snug mt-0.5">
                  {hasFinancialKnowledge
                    ? `この人格に紐づく決算書・財務資料から金額を自動抽出します`
                    : `この人格に決算・財務資料が見つかりません。先にナレッジに資料を追加してください`}
                </p>
              </div>
            </div>
            <button
              onClick={handleRecompute}
              disabled={recomputing || !hasFinancialKnowledge}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
            >
              {recomputing ? '🧠 抽出中…(順次処理)' : '✨ 資料から金額を抽出'}
            </button>
            <AnimatePresence>
              {recomputeResult && (
                <motion.p
                  className="text-xs mt-2 leading-snug"
                  style={{ color: recomputeResult.ok ? '#34d399' : '#f87171' }}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  {recomputeResult.ok ? '✓ ' : '⚠ '}{recomputeResult.msg}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* 手動入力 */}
          <div className="space-y-3">
            <p className="text-fg-muted text-xs tracking-wider uppercase">手動編集</p>

            <div>
              <label className="block text-fg-muted text-xs mb-1">収入 (income)</label>
              <input
                type="text"
                value={incomeStr}
                onChange={e => setIncomeStr(e.target.value)}
                placeholder="例: 1,500,000 / 150万 / 1.5百万"
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
              />
              <p className="text-fg-subtle text-[11px] mt-1">→ {fmtJpy(income)}</p>
            </div>

            <div>
              <label className="block text-fg-muted text-xs mb-1">支出 (expense)</label>
              <input
                type="text"
                value={expenseStr}
                onChange={e => setExpenseStr(e.target.value)}
                placeholder="例: 800,000 / 80万"
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
              />
              <p className="text-fg-subtle text-[11px] mt-1">→ {fmtJpy(expense)} (負値で保存)</p>
            </div>

            <div>
              <label className="block text-fg-muted text-xs mb-1">ラベル (期間など)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="例: 2026年Q1 / 月次平均"
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
              />
            </div>

            <div
              className="rounded-lg p-3 flex items-baseline justify-between"
              style={{ background: persona.accentColorLight, border: `1px solid ${persona.accentColor}40` }}
            >
              <span className="text-fg-muted text-xs">純収支</span>
              <span
                className="text-xl font-semibold"
                style={{ color: net >= 0 ? '#34d399' : '#f87171' }}
              >
                {net >= 0 ? '+' : ''}{fmtJpy(net)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg-muted hover:text-fg"
          >キャンセル</button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold rounded-lg"
            style={{ background: persona.accentColor, color: '#0a0a0f' }}
          >保存</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
