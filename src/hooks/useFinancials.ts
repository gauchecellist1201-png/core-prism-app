// ============================================================
// useFinancials — BS/PL の手入力値を人格 × 期間ごとに永続化
// 実データ(請求・経費)から導ける値は Studio 側で算出し、ここは「入力の保管」だけ担う。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import type { BalanceSheetInput, ProfitLossInput } from '../types/financials';
import { safeSetJSON } from '../lib/storage';

const BS_KEY = 'core_bs_inputs_v1';
const PL_KEY = 'core_pl_inputs_v1';

function load<T>(key: string): T[] {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

export function useFinancials() {
  const [bsInputs, setBsInputs] = useState<BalanceSheetInput[]>(() => load<BalanceSheetInput>(BS_KEY));
  const [plInputs, setPlInputs] = useState<ProfitLossInput[]>(() => load<ProfitLossInput>(PL_KEY));

  useEffect(() => { safeSetJSON(BS_KEY, bsInputs, { module: '貸借対照表' }); }, [bsInputs]);
  useEffect(() => { safeSetJSON(PL_KEY, plInputs, { module: '損益計算書' }); }, [plInputs]);

  const getBs = useCallback(
    (personaId: string, asOf: string): BalanceSheetInput | undefined =>
      bsInputs.find(b => b.personaId === personaId && b.asOf === asOf),
    [bsInputs],
  );

  const saveBs = useCallback((personaId: string, asOf: string, patch: Partial<BalanceSheetInput>) => {
    setBsInputs(prev => {
      const i = prev.findIndex(b => b.personaId === personaId && b.asOf === asOf);
      const next = [...prev];
      const base: BalanceSheetInput = i >= 0 ? next[i] : { personaId, asOf, updatedAt: '' };
      const merged = { ...base, ...patch, personaId, asOf, updatedAt: new Date().toISOString() };
      if (i >= 0) next[i] = merged; else next.push(merged);
      return next;
    });
  }, []);

  const getPl = useCallback(
    (personaId: string, periodKey: string): ProfitLossInput | undefined =>
      plInputs.find(p => p.personaId === personaId && p.periodKey === periodKey),
    [plInputs],
  );

  const savePl = useCallback((personaId: string, periodKey: string, patch: Partial<ProfitLossInput>) => {
    setPlInputs(prev => {
      const i = prev.findIndex(p => p.personaId === personaId && p.periodKey === periodKey);
      const next = [...prev];
      const base: ProfitLossInput = i >= 0 ? next[i] : { personaId, periodKey, updatedAt: '' };
      const merged = { ...base, ...patch, personaId, periodKey, updatedAt: new Date().toISOString() };
      if (i >= 0) next[i] = merged; else next.push(merged);
      return next;
    });
  }, []);

  return { getBs, saveBs, getPl, savePl };
}
