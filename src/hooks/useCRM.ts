import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CRMDeal, CRMActivity, CRMStage } from '../types/crm';

const KEY = 'core_crm_deals_v1';

function load(): CRMDeal[] {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function save(arr: CRMDeal[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* */ }
}

export function useCRM() {
  const [deals, setDeals] = useState<CRMDeal[]>(load);
  useEffect(() => save(deals), [deals]);

  const createDeal = useCallback((personaId: string, init: Partial<CRMDeal>): CRMDeal => {
    const d: CRMDeal = {
      id: uuidv4(),
      personaId,
      title: init.title || '新規案件',
      contact: init.contact,
      amount: init.amount,
      probability: init.probability ?? 30,
      stage: init.stage || 'lead',
      expectedCloseDate: init.expectedCloseDate,
      source: init.source,
      description: init.description,
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDeals(prev => [d, ...prev]);
    return d;
  }, []);

  const updateDeal = useCallback((id: string, patch: Partial<CRMDeal>) => {
    setDeals(prev => prev.map(d => {
      if (d.id !== id) return d;
      const next = { ...d, ...patch, updatedAt: new Date().toISOString() };
      // ステージが won/lost に変わったら closedAt を記録
      if ((patch.stage === 'won' || patch.stage === 'lost') && !d.closedAt) {
        next.closedAt = new Date().toISOString();
      }
      return next;
    }));
  }, []);

  const removeDeal = useCallback((id: string) => {
    setDeals(prev => prev.filter(d => d.id !== id));
  }, []);

  const addActivity = useCallback((dealId: string, activity: Omit<CRMActivity, 'id'>) => {
    setDeals(prev => prev.map(d => d.id === dealId ? {
      ...d,
      activities: [{ ...activity, id: uuidv4() }, ...d.activities],
      updatedAt: new Date().toISOString(),
    } : d));
  }, []);

  const moveStage = useCallback((id: string, stage: CRMStage) => {
    updateDeal(id, { stage });
  }, [updateDeal]);

  const getForPersona = useCallback((personaId: string) =>
    deals.filter(d => d.personaId === personaId),
    [deals]);

  return { deals, createDeal, updateDeal, removeDeal, addActivity, moveStage, getForPersona };
}
