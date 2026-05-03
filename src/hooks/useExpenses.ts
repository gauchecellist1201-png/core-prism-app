import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ExpenseEntry } from '../types/expense';

const KEY = 'core_expenses_v1';

function load(): ExpenseEntry[] {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function save(arr: ExpenseEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* quota */ }
}

export function useExpenses() {
  const [entries, setEntries] = useState<ExpenseEntry[]>(load);
  useEffect(() => save(entries), [entries]);

  const add = useCallback((entry: Omit<ExpenseEntry, 'id' | 'createdAt'>): ExpenseEntry => {
    const e: ExpenseEntry = { ...entry, id: uuidv4(), createdAt: new Date().toISOString() };
    setEntries(prev => [e, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    return e;
  }, []);

  const update = useCallback((id: string, patch: Partial<ExpenseEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const remove = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const getForPersona = useCallback((personaId: string) =>
    entries.filter(e => e.personaId === personaId),
    [entries]);

  return { entries, add, update, remove, getForPersona };
}
