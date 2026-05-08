import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice, IssuerProfile, Client, InvoiceTemplate, InvoiceLine, BusinessDocument, DocumentKind } from '../types/invoice';
import { nextInvoiceNumber, personaSlug } from '../lib/invoiceCalc';

const KEY_INVOICES   = 'core_invoices_v1';
const KEY_ISSUERS    = 'core_invoice_issuers_v1';
const KEY_CLIENTS    = 'core_invoice_clients_v1';
const KEY_TEMPLATES  = 'core_invoice_templates_v1';
const KEY_DOCUMENTS  = 'core_documents_v1';

function load<T>(k: string, fb: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
}

const KIND_PREFIX: Record<DocumentKind, string> = {
  estimate: 'EST',
  order:    'ORD',
  delivery: 'DEL',
  invoice:  'INV',
};

function nextDocNumber(docs: BusinessDocument[], personaId: string, slug: string, kind: DocumentKind, year: number): string {
  const prefix = `${KIND_PREFIX[kind]}-${slug.toUpperCase()}-${year}-`;
  const max = docs
    .filter(d => d.personaId === personaId && d.kind === kind && d.number.startsWith(prefix))
    .reduce((m, d) => Math.max(m, Number(d.number.slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => load<Invoice[]>(KEY_INVOICES, []));
  const [issuers, setIssuers]   = useState<IssuerProfile[]>(() => load<IssuerProfile[]>(KEY_ISSUERS, []));
  const [clients, setClients]   = useState<Client[]>(() => load<Client[]>(KEY_CLIENTS, []));
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(() => load<InvoiceTemplate[]>(KEY_TEMPLATES, []));
  const [documents, setDocuments] = useState<BusinessDocument[]>(() => load<BusinessDocument[]>(KEY_DOCUMENTS, []));

  useEffect(() => save(KEY_INVOICES, invoices), [invoices]);
  useEffect(() => save(KEY_ISSUERS, issuers), [issuers]);
  useEffect(() => save(KEY_CLIENTS, clients), [clients]);
  useEffect(() => save(KEY_TEMPLATES, templates), [templates]);
  useEffect(() => save(KEY_DOCUMENTS, documents), [documents]);

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

  // ビジネス書類 (見積 / 発注 / 納品 / 書類請求)
  const createDocument = useCallback((opts: {
    personaId: string;
    personaName: string;
    kind: DocumentKind;
    issuer: IssuerProfile;
    client: Client;
    subject: string;
    issueDate: string;
    lines: InvoiceLine[];
    notes?: string;
    paymentTerms?: string;
    validUntil?: string;
    deliveryDate?: string;
    dueDate?: string;
    dealId?: string;
    sourceDocumentId?: string;
  }): BusinessDocument => {
    const year = new Date(opts.issueDate).getFullYear() || new Date().getFullYear();
    const slug = personaSlug(opts.personaName);
    const number = nextDocNumber(documents, opts.personaId, slug, opts.kind, year);
    const now = new Date().toISOString();
    const doc: BusinessDocument = {
      id: uuidv4(),
      personaId: opts.personaId,
      kind: opts.kind,
      status: 'draft',
      number,
      sourceDocumentId: opts.sourceDocumentId,
      dealId: opts.dealId,
      issuerSnapshot: opts.issuer,
      clientSnapshot: opts.client,
      subject: opts.subject,
      issueDate: opts.issueDate,
      validUntil: opts.validUntil,
      deliveryDate: opts.deliveryDate,
      dueDate: opts.dueDate,
      lines: opts.lines,
      notes: opts.notes,
      paymentTerms: opts.paymentTerms,
      createdAt: now,
      updatedAt: now,
    };
    setDocuments(prev => [doc, ...prev]);
    return doc;
  }, [documents]);

  const updateDocument = useCallback((id: string, patch: Partial<BusinessDocument>) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  const duplicateAsNext = useCallback((sourceId: string, nextKind: DocumentKind, personaName: string): BusinessDocument | null => {
    const src = documents.find(d => d.id === sourceId);
    if (!src) return null;
    const year = new Date().getFullYear();
    const slug = personaSlug(personaName);
    const number = nextDocNumber(documents, src.personaId, slug, nextKind, year);
    const kindLabel: Record<DocumentKind, string> = { estimate: '見積', order: '発注', delivery: '納品', invoice: '請求' };
    const now = new Date().toISOString();
    const doc: BusinessDocument = {
      ...src,
      id: uuidv4(),
      kind: nextKind,
      status: 'draft',
      number,
      sourceDocumentId: sourceId,
      subject: src.subject.replace(/見積|発注|納品|請求/, kindLabel[nextKind]),
      issueDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    setDocuments(prev => [doc, ...prev]);
    return doc;
  }, [documents]);

  const getDocumentsForPersona = useCallback((personaId: string) =>
    documents.filter(d => d.personaId === personaId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [documents]);

  const getDocumentsForDeal = useCallback((dealId: string) =>
    documents.filter(d => d.dealId === dealId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [documents]);

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
    invoices, issuers, clients, templates, documents,
    getIssuer, upsertIssuer,
    upsertClient, newClient, removeClient,
    createInvoice, updateInvoice, removeInvoice, getForPersona,
    saveTemplate, removeTemplate, getTemplatesForPersona,
    createDocument, updateDocument, removeDocument, duplicateAsNext,
    getDocumentsForPersona, getDocumentsForDeal,
  };
}
