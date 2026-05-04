import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CompanyResearch, SalesLead, ApproachDraft, IntentSignal } from '../types/salesAgent';

const KEY_C = 'core_sales_companies_v1';
const KEY_L = 'core_sales_leads_v1';
const KEY_A = 'core_sales_approaches_v1';
const KEY_S = 'core_sales_signals_v1';
const KEY_PRODUCT = 'core_sales_product_'; // suffix: personaId

function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
}

export function useSalesAgent() {
  const [companies, setCompanies] = useState<CompanyResearch[]>(() => load(KEY_C, []));
  const [leads, setLeads]         = useState<SalesLead[]>(() => load(KEY_L, []));
  const [approaches, setApproaches] = useState<ApproachDraft[]>(() => load(KEY_A, []));
  const [signals, setSignals]     = useState<IntentSignal[]>(() => load(KEY_S, []));

  useEffect(() => save(KEY_C, companies), [companies]);
  useEffect(() => save(KEY_L, leads), [leads]);
  useEffect(() => save(KEY_A, approaches), [approaches]);
  useEffect(() => save(KEY_S, signals), [signals]);

  // 企業
  const addCompany = useCallback((personaId: string, data: Omit<CompanyResearch, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>): CompanyResearch => {
    const c: CompanyResearch = {
      ...data,
      id: uuidv4(),
      personaId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCompanies(prev => [c, ...prev]);
    return c;
  }, []);
  const updateCompany = useCallback((id: string, patch: Partial<CompanyResearch>) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
  }, []);
  const removeCompany = useCallback((id: string) => {
    setCompanies(prev => prev.filter(c => c.id !== id));
  }, []);

  // リード
  const addLead = useCallback((personaId: string, data: Omit<SalesLead, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>): SalesLead => {
    const l: SalesLead = {
      ...data,
      id: uuidv4(),
      personaId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLeads(prev => [l, ...prev]);
    return l;
  }, []);
  const updateLead = useCallback((id: string, patch: Partial<SalesLead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l));
  }, []);
  const removeLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  }, []);

  // アプローチ (メール下書き等)
  const addApproach = useCallback((data: Omit<ApproachDraft, 'id'>): ApproachDraft => {
    const a: ApproachDraft = { ...data, id: uuidv4() };
    setApproaches(prev => [a, ...prev]);
    return a;
  }, []);
  const updateApproach = useCallback((id: string, patch: Partial<ApproachDraft>) => {
    setApproaches(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);
  const removeApproach = useCallback((id: string) => {
    setApproaches(prev => prev.filter(a => a.id !== id));
  }, []);

  // シグナル
  const upsertSignals = useCallback((personaId: string, list: Omit<IntentSignal, 'id' | 'personaId' | 'detectedAt'>[]) => {
    const enriched: IntentSignal[] = list.map(s => ({
      ...s, id: uuidv4(), personaId, detectedAt: new Date().toISOString(),
    }));
    setSignals(prev => [...enriched, ...prev].slice(0, 200));
  }, []);
  const markSignalRead = useCallback((id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, read: true } : s));
  }, []);
  const removeSignal = useCallback((id: string) => {
    setSignals(prev => prev.filter(s => s.id !== id));
  }, []);

  // 自社の商材説明 (人格別)
  const getOwnProduct = useCallback((personaId: string): string => {
    return localStorage.getItem(KEY_PRODUCT + personaId) || '';
  }, []);
  const setOwnProduct = useCallback((personaId: string, text: string) => {
    localStorage.setItem(KEY_PRODUCT + personaId, text);
  }, []);

  // フィルター
  const getCompaniesForPersona = useCallback((personaId: string) => companies.filter(c => c.personaId === personaId), [companies]);
  const getLeadsForPersona = useCallback((personaId: string) => leads.filter(l => l.personaId === personaId), [leads]);
  const getSignalsForPersona = useCallback((personaId: string) => signals.filter(s => s.personaId === personaId), [signals]);
  const getApproachesForLead = useCallback((leadId: string) => approaches.filter(a => a.leadId === leadId), [approaches]);

  return {
    companies, leads, approaches, signals,
    addCompany, updateCompany, removeCompany,
    addLead, updateLead, removeLead,
    addApproach, updateApproach, removeApproach,
    upsertSignals, markSignalRead, removeSignal,
    getOwnProduct, setOwnProduct,
    getCompaniesForPersona, getLeadsForPersona, getSignalsForPersona, getApproachesForLead,
  };
}
