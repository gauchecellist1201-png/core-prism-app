// ============================================================
// FinancialStatementsStudio — 貸借対照表(BS) / 損益計算書(PL) の作成・出力
//
// 方針（数字の嘘禁止・feedback_quality_thoroughness）:
// - 売上高 / 販管費 / 売掛金 は実データ(請求・売上台帳・経費)から自動算出
// - 現金預金・借入金・資本金など実データが無い項目は手入力（未入力は「—」表示。0と偽らない）
// - BS は貸借一致を常時チェックし、ズレていればその額を明示（黙って合わせない）
// - 出力: Excel(.xlsx) / CSV / 印刷(PDF保存)
// ============================================================
import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer, FileSpreadsheet, Scale, TrendingUp, X } from 'lucide-react';
import type { Persona } from '../types/identity';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import { useFinancials } from '../hooks/useFinancials';
import { n } from '../types/financials';
import { fmtJpy } from '../lib/invoiceCalc';
import { StudioIntro } from './StudioIntro';
import StudioBackButton from './StudioBackButton';
import { notifyInApp } from '../lib/inAppNotify';

interface Props {
  persona: Persona;
  onClose: () => void;
}

type Tab = 'pl' | 'bs';
type Period = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear';

function periodRange(p: Period): { start: string; end: string; label: string; key: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const p2 = (v: number) => String(v).padStart(2, '0');
  const lastDay = (yy: number, mm: number) => new Date(yy, mm + 1, 0).getDate();
  if (p === 'thisMonth') return { start: `${y}-${p2(m + 1)}-01`, end: `${y}-${p2(m + 1)}-${lastDay(y, m)}`, label: `${y}年${m + 1}月`, key: `${y}-${p2(m + 1)}` };
  if (p === 'lastMonth') {
    const ly = m === 0 ? y - 1 : y, lm = m === 0 ? 11 : m - 1;
    return { start: `${ly}-${p2(lm + 1)}-01`, end: `${ly}-${p2(lm + 1)}-${lastDay(ly, lm)}`, label: `${ly}年${lm + 1}月`, key: `${ly}-${p2(lm + 1)}` };
  }
  if (p === 'thisQuarter') {
    const qs = Math.floor(m / 3) * 3;
    return { start: `${y}-${p2(qs + 1)}-01`, end: `${y}-${p2(qs + 3)}-${lastDay(y, qs + 2)}`, label: `${y}年 第${Math.floor(m / 3) + 1}四半期`, key: `${y}-Q${Math.floor(m / 3) + 1}` };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}年 (年次)`, key: `${y}` };
}

/** 金額セル: 未入力は「—」。0 と区別する（嘘ゼロ） */
function Yen({ v, bold, muted }: { v: number | null; bold?: boolean; muted?: boolean }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 400, color: muted ? 'var(--fg-muted)' : 'var(--fg)' }}>
      {v === null ? '—' : fmtJpy(v)}
    </span>
  );
}

export default function FinancialStatementsStudio({ persona, onClose }: Props) {
  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();
  const { getBs, saveBs, getPl, savePl } = useFinancials();

  const [tab, setTab] = useState<Tab>('pl');
  const [period, setPeriod] = useState<Period>('thisYear');
  const r = periodRange(period);

  // ── 実データ集計 ──────────────────────────────
  const sales = useMemo(
    () => ledger.entries.filter(e => e.personaId === persona.id && e.date >= r.start && e.date <= r.end),
    [ledger.entries, persona.id, r.start, r.end],
  );
  const expenses = useMemo(
    () => exp.entries.filter(e => e.personaId === persona.id && e.date >= r.start && e.date <= r.end),
    [exp.entries, persona.id, r.start, r.end],
  );

  const revenue = useMemo(() => sales.reduce((s, e) => s + e.totalExcl, 0), [sales]);
  const sgaByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amountExcl);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const sgaTotal = useMemo(() => sgaByCategory.reduce((s, [, v]) => s + v, 0), [sgaByCategory]);

  // 売掛金 = 期末時点の未回収（請求の未入金分）。実データから自動。
  const autoAR = useMemo(() => {
    return ledger.entries
      .filter(e => e.personaId === persona.id && e.date <= r.end)
      .reduce((s, e) => {
        const paid = e.status === 'paid' ? e.totalIncl : (e.paidAmount || 0);
        return s + Math.max(0, e.totalIncl - paid);
      }, 0);
  }, [ledger.entries, persona.id, r.end]);

  // ── 入力値 ────────────────────────────────────
  const plIn = getPl(persona.id, r.key);
  const bsIn = getBs(persona.id, r.end);

  // ── PL 計算 ───────────────────────────────────
  const pl = useMemo(() => {
    const costOfSales = n(plIn?.costOfSales);
    const grossProfit = revenue - costOfSales;
    const operatingIncome = grossProfit - sgaTotal;
    const ordinaryIncome = operatingIncome + n(plIn?.nonOperatingIncome) - n(plIn?.nonOperatingExpense);
    const pretaxIncome = ordinaryIncome + n(plIn?.extraordinaryIncome) - n(plIn?.extraordinaryLoss);
    const netIncome = pretaxIncome - n(plIn?.incomeTax);
    return { costOfSales, grossProfit, operatingIncome, ordinaryIncome, pretaxIncome, netIncome };
  }, [revenue, sgaTotal, plIn]);

  // ── BS 計算 ───────────────────────────────────
  const bs = useMemo(() => {
    const ar = typeof bsIn?.accountsReceivable === 'number' ? bsIn.accountsReceivable : autoAR;
    const currentAssets = n(bsIn?.cash) + ar + n(bsIn?.inventory) + n(bsIn?.otherCurrentAssets);
    const fixedAssets = n(bsIn?.tangibleAssets) + n(bsIn?.intangibleAssets) + n(bsIn?.investments);
    const totalAssets = currentAssets + fixedAssets;

    const currentLiabilities = n(bsIn?.accountsPayable) + n(bsIn?.shortTermDebt) + n(bsIn?.accruedExpenses) + n(bsIn?.otherCurrentLiabilities);
    const fixedLiabilities = n(bsIn?.longTermDebt) + n(bsIn?.otherFixedLiabilities);
    const totalLiabilities = currentLiabilities + fixedLiabilities;

    // 純資産 = 資本金 + 利益剰余金(期首) + 当期純利益(PLから自動連携)
    const retained = n(bsIn?.retainedEarnings) + pl.netIncome;
    const netAssets = n(bsIn?.capital) + retained;
    const totalLiabilitiesAndNetAssets = totalLiabilities + netAssets;
    const diff = totalAssets - totalLiabilitiesAndNetAssets;
    return { ar, currentAssets, fixedAssets, totalAssets, currentLiabilities, fixedLiabilities, totalLiabilities, retained, netAssets, totalLiabilitiesAndNetAssets, diff };
  }, [bsIn, autoAR, pl.netIncome]);

  // ── 出力データ（PL/BS 共通の行データ） ──────────
  const plRows = useMemo<(string | number)[][]>(() => ([
    ['損益計算書 (P/L)'],
    [`${persona.name}`, r.label],
    [],
    ['科目', '金額（円・税抜）'],
    ['売上高', revenue],
    ['売上原価', pl.costOfSales],
    ['売上総利益', pl.grossProfit],
    ['販売費及び一般管理費', sgaTotal],
    ...sgaByCategory.map(([c, v]) => [`　${c}`, v]),
    ['営業利益', pl.operatingIncome],
    ['営業外収益', n(plIn?.nonOperatingIncome)],
    ['営業外費用', n(plIn?.nonOperatingExpense)],
    ['経常利益', pl.ordinaryIncome],
    ['特別利益', n(plIn?.extraordinaryIncome)],
    ['特別損失', n(plIn?.extraordinaryLoss)],
    ['税引前当期純利益', pl.pretaxIncome],
    ['法人税等', n(plIn?.incomeTax)],
    ['当期純利益', pl.netIncome],
  ]), [persona.name, r.label, revenue, pl, sgaTotal, sgaByCategory, plIn]);

  const bsRows = useMemo<(string | number)[][]>(() => ([
    ['貸借対照表 (B/S)'],
    [`${persona.name}`, `${r.end} 現在`],
    [],
    ['【資産の部】', '金額（円）'],
    ['流動資産'],
    ['　現金及び預金', n(bsIn?.cash)],
    ['　売掛金', bs.ar],
    ['　棚卸資産', n(bsIn?.inventory)],
    ['　その他流動資産', n(bsIn?.otherCurrentAssets)],
    ['流動資産 合計', bs.currentAssets],
    ['固定資産'],
    ['　有形固定資産', n(bsIn?.tangibleAssets)],
    ['　無形固定資産', n(bsIn?.intangibleAssets)],
    ['　投資その他の資産', n(bsIn?.investments)],
    ['固定資産 合計', bs.fixedAssets],
    ['資産の部 合計', bs.totalAssets],
    [],
    ['【負債の部】', '金額（円）'],
    ['流動負債'],
    ['　買掛金', n(bsIn?.accountsPayable)],
    ['　短期借入金', n(bsIn?.shortTermDebt)],
    ['　未払費用', n(bsIn?.accruedExpenses)],
    ['　その他流動負債', n(bsIn?.otherCurrentLiabilities)],
    ['流動負債 合計', bs.currentLiabilities],
    ['固定負債'],
    ['　長期借入金', n(bsIn?.longTermDebt)],
    ['　その他固定負債', n(bsIn?.otherFixedLiabilities)],
    ['固定負債 合計', bs.fixedLiabilities],
    ['負債の部 合計', bs.totalLiabilities],
    [],
    ['【純資産の部】', '金額（円）'],
    ['　資本金', n(bsIn?.capital)],
    ['　利益剰余金（期首）', n(bsIn?.retainedEarnings)],
    ['　当期純利益（P/Lより）', pl.netIncome],
    ['純資産の部 合計', bs.netAssets],
    ['負債・純資産 合計', bs.totalLiabilitiesAndNetAssets],
    [],
    ['貸借差額（0 が正常）', bs.diff],
  ]), [persona.name, r.end, bsIn, bs, pl.netIncome]);

  // ── 出力 ──────────────────────────────────────
  const exportCsv = useCallback(() => {
    const rows = tab === 'pl' ? plRows : bsRows;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map(row => row.map(esc).join(',')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab === 'pl' ? '損益計算書' : '貸借対照表'}_${persona.name}_${tab === 'pl' ? r.key : r.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notifyInApp({ kind: 'success', title: 'CSVを書き出しました', duration: 2000 });
  }, [tab, plRows, bsRows, persona.name, r.key, r.end]);

  const exportXlsx = useCallback(async () => {
    // xlsx は 1MB 級 → 押した瞬間だけ読む（初期表示を重くしない）
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plRows), 'PL 損益計算書');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsRows), 'BS 貸借対照表');
    XLSX.writeFile(wb, `財務諸表_${persona.name}_${r.key}.xlsx`);
    notifyInApp({ kind: 'success', title: 'Excel（BS・PL）を書き出しました', duration: 2200 });
  }, [plRows, bsRows, persona.name, r.key]);

  const doPrint = useCallback(() => window.print(), []);

  // ── 入力欄 ────────────────────────────────────
  const NumInput = ({ label, value, onSave, auto, hint }: {
    label: string; value: number | undefined; onSave: (v: number | undefined) => void; auto?: number; hint?: string;
  }) => (
    <label className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm text-fg min-w-0">
        {label}
        {auto !== undefined && value === undefined && (
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>自動</span>
        )}
        {hint && <span className="block text-[11px] text-fg-muted">{hint}</span>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        defaultValue={value ?? (auto !== undefined ? auto : '')}
        placeholder={auto !== undefined ? String(auto) : '0'}
        onBlur={e => {
          const raw = e.target.value.trim();
          onSave(raw === '' ? undefined : Number(raw));
        }}
        className="w-36 shrink-0 rounded-lg px-3 text-right text-fg"
        style={{ minHeight: 44, fontSize: 16, background: 'var(--surface-3)', border: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}
      />
    </label>
  );

  const Row = ({ label, v, bold, indent, accentBg }: { label: string; v: number | null; bold?: boolean; indent?: boolean; accentBg?: boolean }) => (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5"
      style={{
        borderBottom: '1px solid var(--border)',
        background: accentBg ? persona.accentColorLight : undefined,
        paddingLeft: indent ? 26 : 12,
      }}
    >
      <span className="text-sm" style={{ color: bold ? 'var(--fg)' : 'var(--fg-muted)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <Yen v={v} bold={bold} />
    </div>
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)', paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[900px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <StudioBackButton onClick={onClose} />
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: persona.accentColorLight, color: persona.accentColor }}>
              <Scale size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">決算書スタジオ</p>
              <p className="text-fg-muted text-xs truncate">損益計算書(P/L)・貸借対照表(B/S)</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="閉じる" className="flex items-center justify-center rounded-full text-fg-muted hover:text-fg" style={{ width: 44, height: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs + Period */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          {([['pl', '損益計算書 P/L', TrendingUp], ['bs', '貸借対照表 B/S', Scale]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="text-sm px-3 rounded-lg font-medium inline-flex items-center gap-1.5"
              style={{
                minHeight: 44,
                background: tab === id ? persona.accentColorLight : 'var(--surface-3)',
                color: tab === id ? persona.accentColor : 'var(--fg-muted)',
                border: `1px solid ${tab === id ? persona.accentColor : 'var(--border)'}`,
              }}
            ><Icon size={15} strokeWidth={2.2} />{label}</button>
          ))}
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="ml-auto rounded-lg px-3 text-fg"
            style={{ minHeight: 44, fontSize: 16, background: 'var(--surface-3)', border: '1px solid var(--border)' }}
          >
            <option value="thisMonth">今月</option>
            <option value="lastMonth">先月</option>
            <option value="thisQuarter">今四半期</option>
            <option value="thisYear">今年（年次）</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <StudioIntro
            id="financial-statements"
            accent={persona.accentColor}
            iconKey="pnl"
            what="請求と経費から P/L を自動作成。B/S は残高を入れるだけで完成し、Excel で出せます"
            tryThis="上のタブで P/L と B/S を切替"
            example="売上高 → 営業利益 → 当期純利益／資産・負債・純資産"
          />

          {tab === 'pl' ? (
            <>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg text-sm font-bold">損益計算書</p>
                  <p className="text-fg-muted text-xs">{persona.name} · {r.label}</p>
                </div>
                <Row label="売上高" v={revenue} bold />
                <Row label="売上原価" v={pl.costOfSales} indent />
                <Row label="売上総利益" v={pl.grossProfit} bold accentBg />
                <Row label="販売費及び一般管理費" v={sgaTotal} indent />
                {sgaByCategory.map(([c, v]) => <Row key={c} label={`　${c}`} v={v} indent />)}
                <Row label="営業利益" v={pl.operatingIncome} bold accentBg />
                <Row label="営業外収益" v={n(plIn?.nonOperatingIncome)} indent />
                <Row label="営業外費用" v={n(plIn?.nonOperatingExpense)} indent />
                <Row label="経常利益" v={pl.ordinaryIncome} bold accentBg />
                <Row label="特別利益" v={n(plIn?.extraordinaryIncome)} indent />
                <Row label="特別損失" v={n(plIn?.extraordinaryLoss)} indent />
                <Row label="税引前当期純利益" v={pl.pretaxIncome} bold />
                <Row label="法人税等" v={n(plIn?.incomeTax)} indent />
                <Row label="当期純利益" v={pl.netIncome} bold accentBg />
              </div>

              <details className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <summary className="px-3 py-3 text-sm text-fg cursor-pointer" style={{ minHeight: 44 }}>
                  数字を入れる（売上原価・営業外・税金）
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-fg-muted text-xs py-2">売上高と販管費は請求・経費から自動です。それ以外を入れると精度が上がります。</p>
                  <NumInput label="売上原価" value={plIn?.costOfSales} onSave={v => savePl(persona.id, r.key, { costOfSales: v })} hint="仕入・原材料など（サービス業は0でOK）" />
                  <NumInput label="営業外収益" value={plIn?.nonOperatingIncome} onSave={v => savePl(persona.id, r.key, { nonOperatingIncome: v })} hint="受取利息・雑収入など" />
                  <NumInput label="営業外費用" value={plIn?.nonOperatingExpense} onSave={v => savePl(persona.id, r.key, { nonOperatingExpense: v })} hint="支払利息など" />
                  <NumInput label="特別利益" value={plIn?.extraordinaryIncome} onSave={v => savePl(persona.id, r.key, { extraordinaryIncome: v })} />
                  <NumInput label="特別損失" value={plIn?.extraordinaryLoss} onSave={v => savePl(persona.id, r.key, { extraordinaryLoss: v })} />
                  <NumInput label="法人税等" value={plIn?.incomeTax} onSave={v => savePl(persona.id, r.key, { incomeTax: v })} />
                </div>
              </details>
            </>
          ) : (
            <>
              {/* 貸借一致チェック — 黙って合わせない */}
              <div
                className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                style={{
                  background: bs.diff === 0 ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                  border: `1px solid ${bs.diff === 0 ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)'}`,
                }}
              >
                <span className="text-sm font-semibold" style={{ color: bs.diff === 0 ? '#34D399' : '#FBBF24' }}>
                  {bs.diff === 0 ? '貸借一致しています' : '貸借が一致していません'}
                </span>
                <span className="text-sm" style={{ fontVariantNumeric: 'tabular-nums', color: bs.diff === 0 ? '#34D399' : '#FBBF24' }}>
                  差額 {fmtJpy(bs.diff)}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg text-sm font-bold">貸借対照表</p>
                  <p className="text-fg-muted text-xs">{persona.name} · {r.end} 現在</p>
                </div>
                <Row label="【資産の部】" v={null} bold />
                <Row label="現金及び預金" v={n(bsIn?.cash)} indent />
                <Row label="売掛金" v={bs.ar} indent />
                <Row label="棚卸資産" v={n(bsIn?.inventory)} indent />
                <Row label="その他流動資産" v={n(bsIn?.otherCurrentAssets)} indent />
                <Row label="流動資産 合計" v={bs.currentAssets} bold />
                <Row label="有形固定資産" v={n(bsIn?.tangibleAssets)} indent />
                <Row label="無形固定資産" v={n(bsIn?.intangibleAssets)} indent />
                <Row label="投資その他の資産" v={n(bsIn?.investments)} indent />
                <Row label="固定資産 合計" v={bs.fixedAssets} bold />
                <Row label="資産の部 合計" v={bs.totalAssets} bold accentBg />

                <Row label="【負債の部】" v={null} bold />
                <Row label="買掛金" v={n(bsIn?.accountsPayable)} indent />
                <Row label="短期借入金" v={n(bsIn?.shortTermDebt)} indent />
                <Row label="未払費用" v={n(bsIn?.accruedExpenses)} indent />
                <Row label="その他流動負債" v={n(bsIn?.otherCurrentLiabilities)} indent />
                <Row label="流動負債 合計" v={bs.currentLiabilities} bold />
                <Row label="長期借入金" v={n(bsIn?.longTermDebt)} indent />
                <Row label="その他固定負債" v={n(bsIn?.otherFixedLiabilities)} indent />
                <Row label="固定負債 合計" v={bs.fixedLiabilities} bold />
                <Row label="負債の部 合計" v={bs.totalLiabilities} bold accentBg />

                <Row label="【純資産の部】" v={null} bold />
                <Row label="資本金" v={n(bsIn?.capital)} indent />
                <Row label="利益剰余金（期首）" v={n(bsIn?.retainedEarnings)} indent />
                <Row label="当期純利益（P/Lより）" v={pl.netIncome} indent />
                <Row label="純資産の部 合計" v={bs.netAssets} bold />
                <Row label="負債・純資産 合計" v={bs.totalLiabilitiesAndNetAssets} bold accentBg />
              </div>

              <details open className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <summary className="px-3 py-3 text-sm text-fg cursor-pointer" style={{ minHeight: 44 }}>
                  残高を入れる（{r.end} 現在）
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-fg-muted text-xs py-2">売掛金は未回収の請求から自動。他は通帳・借入残高を見ながら入れてください。</p>
                  <NumInput label="現金及び預金" value={bsIn?.cash} onSave={v => saveBs(persona.id, r.end, { cash: v })} />
                  <NumInput label="売掛金" value={bsIn?.accountsReceivable} auto={autoAR} onSave={v => saveBs(persona.id, r.end, { accountsReceivable: v })} hint="未回収の請求から自動計算（上書き可）" />
                  <NumInput label="棚卸資産" value={bsIn?.inventory} onSave={v => saveBs(persona.id, r.end, { inventory: v })} />
                  <NumInput label="その他流動資産" value={bsIn?.otherCurrentAssets} onSave={v => saveBs(persona.id, r.end, { otherCurrentAssets: v })} />
                  <NumInput label="有形固定資産" value={bsIn?.tangibleAssets} onSave={v => saveBs(persona.id, r.end, { tangibleAssets: v })} hint="設備・車両・建物など" />
                  <NumInput label="無形固定資産" value={bsIn?.intangibleAssets} onSave={v => saveBs(persona.id, r.end, { intangibleAssets: v })} hint="ソフトウェア・のれんなど" />
                  <NumInput label="投資その他の資産" value={bsIn?.investments} onSave={v => saveBs(persona.id, r.end, { investments: v })} />
                  <NumInput label="買掛金" value={bsIn?.accountsPayable} onSave={v => saveBs(persona.id, r.end, { accountsPayable: v })} />
                  <NumInput label="短期借入金" value={bsIn?.shortTermDebt} onSave={v => saveBs(persona.id, r.end, { shortTermDebt: v })} hint="1年以内に返す借入" />
                  <NumInput label="未払費用" value={bsIn?.accruedExpenses} onSave={v => saveBs(persona.id, r.end, { accruedExpenses: v })} />
                  <NumInput label="その他流動負債" value={bsIn?.otherCurrentLiabilities} onSave={v => saveBs(persona.id, r.end, { otherCurrentLiabilities: v })} />
                  <NumInput label="長期借入金" value={bsIn?.longTermDebt} onSave={v => saveBs(persona.id, r.end, { longTermDebt: v })} />
                  <NumInput label="その他固定負債" value={bsIn?.otherFixedLiabilities} onSave={v => saveBs(persona.id, r.end, { otherFixedLiabilities: v })} />
                  <NumInput label="資本金" value={bsIn?.capital} onSave={v => saveBs(persona.id, r.end, { capital: v })} />
                  <NumInput label="利益剰余金（期首）" value={bsIn?.retainedEarnings} onSave={v => saveBs(persona.id, r.end, { retainedEarnings: v })} hint="前期までの累計利益" />
                </div>
              </details>
            </>
          )}
        </div>

        {/* Footer — 出力 */}
        <div className="flex flex-wrap gap-2 justify-end px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={doPrint} className="text-xs px-3 rounded-lg text-fg-muted hover:text-fg inline-flex items-center gap-1.5" style={{ minHeight: 44, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Printer size={14} strokeWidth={2.2} />印刷 / PDF
          </button>
          <button onClick={exportCsv} className="text-xs px-3 rounded-lg text-fg-muted hover:text-fg inline-flex items-center gap-1.5" style={{ minHeight: 44, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Download size={14} strokeWidth={2.2} />CSV（表示中）
          </button>
          <button onClick={exportXlsx} className="text-xs px-4 rounded-lg font-semibold inline-flex items-center gap-1.5" style={{ minHeight: 44, background: persona.accentColor, color: '#0a0a0f', border: 'none' }}>
            <FileSpreadsheet size={15} strokeWidth={2.2} />Excel で出力（BS・PL）
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
