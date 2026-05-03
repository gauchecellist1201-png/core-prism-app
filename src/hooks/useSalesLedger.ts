import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SalesEntry } from '../types/sales';
import type { Invoice } from '../types/invoice';
import { entryFromInvoice } from '../lib/salesLedger';

const KEY = 'core_sales_ledger_v1';

function load(): SalesEntry[] {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function save(arr: SalesEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* quota */ }
}

/**
 * 売上台帳。
 * 請求書一覧 (invoices) と同期: 発行済み / 入金済の請求書を自動的にエントリ化する。
 */
export function useSalesLedger(invoices: Invoice[]) {
  const [entries, setEntries] = useState<SalesEntry[]>(load);

  useEffect(() => save(entries), [entries]);

  // 請求書 → 売上エントリの自動同期
  // - invoiceId が一致するエントリは status / 金額 を上書き
  // - invoiceId に対応する請求書が消えていれば、対応エントリも削除
  // - 新規発行の請求書はエントリ追加
  useEffect(() => {
    setEntries(prev => {
      const next: SalesEntry[] = [];
      const byInvoice = new Map<string, SalesEntry>();
      for (const e of prev) {
        if (e.source === 'invoice' && e.invoiceId) byInvoice.set(e.invoiceId, e);
        else next.push(e); // 手動エントリは保持
      }

      for (const inv of invoices) {
        if (inv.status === 'cancelled') continue; // 取消は除外
        const base = entryFromInvoice(inv);
        const existing = byInvoice.get(inv.id);
        if (existing) {
          next.push({
            ...existing,
            ...base,
            // 入金日は既存を尊重しつつ、status が paid に切り替わったときに今日の日付を入れる
            paidDate: base.status === 'paid' && existing.status !== 'paid'
              ? new Date().toISOString().slice(0, 10)
              : existing.paidDate,
            updatedAt: new Date().toISOString(),
          });
        } else {
          next.push({
            id: uuidv4(),
            ...base,
            paidDate: base.status === 'paid' ? new Date().toISOString().slice(0, 10) : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      // 並び (新しい→古い)
      next.sort((a, b) => b.date.localeCompare(a.date));
      return next;
    });
  }, [invoices]);

  const addManualEntry = useCallback((entry: Omit<SalesEntry, 'id' | 'source' | 'createdAt' | 'updatedAt'>): SalesEntry => {
    const e: SalesEntry = {
      ...entry,
      id: uuidv4(),
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEntries(prev => [e, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    return e;
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<SalesEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const markPaid = useCallback((id: string, paidDate?: string) => {
    setEntries(prev => prev.map(e => e.id === id ? {
      ...e,
      status: 'paid',
      paidDate: paidDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    } : e));
  }, []);

  const getForPersona = useCallback((personaId: string) =>
    entries.filter(e => e.personaId === personaId),
    [entries]);

  return { entries, addManualEntry, updateEntry, removeEntry, markPaid, getForPersona };
}
