import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice, IssuerProfile, Client, InvoiceTemplate, InvoiceLine } from '../types/invoice';
import { nextInvoiceNumber, personaSlug } from '../lib/invoiceCalc';

const KEY_INVOICES = 'core_invoices_v1';
const KEY_ISSUERS  = 'core_invoice_issuers_v1';
const KEY_CLIENTS  = 'core_invoice_clients_v1';
const KEY_TEMPLATES = 'core_invoice_templates_v1';

function load<T>(k: string, fb: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => load<Invoice[]>(KEY_INVOICES, []));
  const [issuers, setIssuers]   = useState<IssuerProfile[]>(() => load<IssuerProfile[]>(KEY_ISSUERS, []));
  const [clients, setClients]   = useState<Client[]>(() => load<Client[]>(KEY_CLIENTS, []));
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(() => load<InvoiceTemplate[]>(KEY_TEMPLATES, []));

  useEffect(() => save(KEY_INVOICES, invoices), [invoices]);
  useEffect(() => save(KEY_ISSUERS, issuers), [issuers]);
  useEffect(() => save(KEY_CLIENTS, clients), [clients]);
  useEffect(() => save(KEY_TEMPLATES, templates), [templates]);

  // 発行者プロファイル
  const getIssuer = useCallback((personaId: string) => issuers.find(i => i.personaId === personaId), [issuers]);
  const upsertIssuer = useCallback((p: IssuerProfile) => {
    setIssuers(prev => {
      const idx = prev.findIndex(i => i.personaId === p.personaId);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = p; return next;
      }
      return [p, ...prev];
    });
  }, []);

  // 顧客
  const upsertClient = useCallback((c: Client) => {
    setClients(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = c; return next;
      }
      return [c, ...prev];
    });
  }, []);
  const newClient = useCallback((partial?: Partial<Client>): Client => {
    const c: Client = {
      id: uuidv4(),
      name: partial?.name || '',
      contactName: partial?.contactName,
      postalCode: partial?.postalCode,
      address: partial?.address,
      email: partial?.email,
    };
    setClients(prev => [c, ...prev]);
    return c;
  }, []);
  const removeClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  // 請求書
  const createInvoice = useCallback((opts: {
    personaId: string;
    personaName: string;
    issuer: IssuerProfile;
    client: Client;
    subject: string;
    issueDate: string;
    dueDate: string;
    lines: InvoiceLine[];
    notes?: string;
    paymentTerms?: string;
  }): Invoice => {
    const year = new Date(opts.issueDate).getFullYear() || new Date().getFullYear();
    const slug = personaSlug(opts.personaName);
    const number = nextInvoiceNumber(invoices, opts.personaId, slug, year);
    const inv: Invoice = {
      id: uuidv4(),
      personaId: opts.personaId,
      number,
      issuerSnapshot: opts.issuer,
      clientSnapshot: opts.client,
      subject: opts.subject,
      issueDate: opts.issueDate,
      dueDate: opts.dueDate,
      lines: opts.lines,
      notes: opts.notes,
      paymentTerms: opts.paymentTerms,
      status: 'issued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInvoices(prev => [inv, ...prev]);
    return inv;
  }, [invoices]);

  const updateInvoice = useCallback((id: string, patch: Partial<Invoice>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i));
  }, []);

  const removeInvoice = useCallback((id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
  }, []);

  const getForPersona = useCallback((personaId: string) =>
    invoices.filter(i => i.personaId === personaId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invoices]);

  // テンプレート
  const saveTemplate = useCallback((t: Omit<InvoiceTemplate, 'id' | 'createdAt'>) => {
    const tpl: InvoiceTemplate = {
      ...t,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => [tpl, ...prev]);
    return tpl;
  }, []);
  const removeTemplate = useCallback((id: string) => setTemplates(prev => prev.filter(t => t.id !== id)), []);
  const getTemplatesForPersona = useCallback((personaId: string) => templates.filter(t => t.personaId === personaId), [templates]);

  return {
    invoices, issuers, clients, templates,
    getIssuer, upsertIssuer,
    upsertClient, newClient, removeClient,
    createInvoice, updateInvoice, removeInvoice, getForPersona,
    saveTemplate, removeTemplate, getTemplatesForPersona,
  };
}
