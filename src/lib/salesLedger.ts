// ============================================================
// 売上台帳の集計・CSV出力
// ============================================================
import type { Invoice } from '../types/invoice';
import type { SalesEntry, SalesSummary } from '../types/sales';
import { computeTotals } from './invoiceCalc';

/** 請求書から SalesEntry を生成 */
export function entryFromInvoice(invoice: Invoice): Omit<SalesEntry, 'id' | 'createdAt' | 'updatedAt'> {
  const t = computeTotals(invoice.lines);
  return {
    personaId: invoice.personaId,
    source: 'invoice',
    invoiceId: invoice.id,
    date: invoice.issueDate,
    clientName: invoice.clientSnapshot.name || '(未設定)',
    subject: invoice.subject || invoice.number,
    subtotal10: t.subtotal10,
    subtotal8: t.subtotal8,
    subtotal0: t.subtotal0,
    tax10: t.tax10,
    tax8: t.tax8,
    totalExcl: t.subtotal,
    totalTax: t.totalTax,
    totalIncl: t.total,
    status: invoice.status === 'paid' ? 'paid' : 'unpaid',
  };
}

/** YYYY-MM の月キー */
export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function summarizeMonth(entries: SalesEntry[], yyyymm: string): SalesSummary {
  const filtered = entries.filter(e => e.date.startsWith(yyyymm));
  const totals = filtered.reduce((acc, e) => {
    acc.totalExcl += e.totalExcl;
    acc.totalTax += e.totalTax;
    acc.totalIncl += e.totalIncl;
    if (e.status === 'paid') acc.paidIncl += e.totalIncl;
    else if (e.status === 'partial' && e.paidAmount) acc.paidIncl += e.paidAmount;
    return acc;
  }, { totalExcl: 0, totalTax: 0, totalIncl: 0, paidIncl: 0 });
  return {
    label: yyyymm,
    start: yyyymm + '-01',
    end: yyyymm + '-31',
    count: filtered.length,
    totalExcl: totals.totalExcl,
    totalTax: totals.totalTax,
    totalIncl: totals.totalIncl,
    paidIncl: totals.paidIncl,
    unpaidIncl: totals.totalIncl - totals.paidIncl,
  };
}

export function summarizeYear(entries: SalesEntry[], year: number): SalesSummary {
  const yearStr = String(year);
  const filtered = entries.filter(e => e.date.startsWith(yearStr));
  const totals = filtered.reduce((acc, e) => {
    acc.totalExcl += e.totalExcl;
    acc.totalTax += e.totalTax;
    acc.totalIncl += e.totalIncl;
    if (e.status === 'paid') acc.paidIncl += e.totalIncl;
    else if (e.status === 'partial' && e.paidAmount) acc.paidIncl += e.paidAmount;
    return acc;
  }, { totalExcl: 0, totalTax: 0, totalIncl: 0, paidIncl: 0 });
  return {
    label: yearStr,
    start: yearStr + '-01-01',
    end: yearStr + '-12-31',
    count: filtered.length,
    totalExcl: totals.totalExcl,
    totalTax: totals.totalTax,
    totalIncl: totals.totalIncl,
    paidIncl: totals.paidIncl,
    unpaidIncl: totals.totalIncl - totals.paidIncl,
  };
}

/** 過去N ヶ月の月次サマリ (古い→新しい順) */
export function monthlySeries(entries: SalesEntry[], months = 12): SalesSummary[] {
  const out: SalesSummary[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(summarizeMonth(entries, key));
  }
  return out;
}

/** 取引先別ランキング (税抜合計の降順) */
export function clientRanking(entries: SalesEntry[], topN = 10): { name: string; totalIncl: number; count: number }[] {
  const map = new Map<string, { totalIncl: number; count: number }>();
  for (const e of entries) {
    const cur = map.get(e.clientName) || { totalIncl: 0, count: 0 };
    cur.totalIncl += e.totalIncl;
    cur.count += 1;
    map.set(e.clientName, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.totalIncl - a.totalIncl)
    .slice(0, topN);
}

// ─── CSV 出力 (freee / MFクラウド インポート想定) ─────────
function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function entriesToCsv(entries: SalesEntry[]): string {
  const headers = [
    '日付', '取引先', '件名', '税抜合計', '消費税', '税込合計',
    '10%対象 税抜', '10%消費税', '8%対象 税抜', '8%消費税', '非課税',
    '入金状況', '入金日', 'ソース', '備考',
  ];
  const rows = entries.map(e => [
    e.date,
    e.clientName,
    e.subject,
    e.totalExcl, e.totalTax, e.totalIncl,
    e.subtotal10, e.tax10, e.subtotal8, e.tax8, e.subtotal0,
    e.status === 'paid' ? '入金済' : e.status === 'partial' ? '一部入金' : '未入金',
    e.paidDate || '',
    e.source === 'invoice' ? '請求書' : '手動',
    e.notes || '',
  ].map(v => csvEscape(String(v))));
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM 付与で Excel での文字化け防止
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
