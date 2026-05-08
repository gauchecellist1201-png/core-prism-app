import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import type { Persona, AppSettings } from '../types/identity';
import type { BusinessDocument, DocumentKind, DocumentStatus, InvoiceLine, Client } from '../types/invoice';
import { useInvoices } from '../hooks/useInvoices';
import { useCRM } from '../hooks/useCRM';
import { computeTotals, fmtJpy, calcDueDate } from '../lib/invoiceCalc';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = DocumentKind;
type View = 'list' | 'compose' | 'detail';

const KIND_META: Record<DocumentKind, { label: string; emoji: string; color: string; prefix: string }> = {
  estimate: { label: '見積書', emoji: '📋', color: '#60a5fa', prefix: 'EST' },
  order:    { label: '発注書', emoji: '📦', color: '#a78bfa', prefix: 'ORD' },
  delivery: { label: '納品書', emoji: '🚚', color: '#34d399', prefix: 'DEL' },
  invoice:  { label: '請求書', emoji: '🧾', color: '#f59e0b', prefix: 'INV' },
};

const STATUS_LABEL: Record<DocumentStatus, { label: string; color: string }> = {
  draft:     { label: '下書き',   color: '#9088A8' },
  sent:      { label: '送付済',   color: '#60a5fa' },
  approved:  { label: '承認済',   color: '#34d399' },
  delivered: { label: '納品済',   color: '#a78bfa' },
  paid:      { label: '支払済',   color: '#4ade80' },
  cancelled: { label: '取消',     color: '#f87171' },
};

const NEXT_KIND: Partial<Record<DocumentKind, DocumentKind>> = {
  estimate: 'order',
  order:    'delivery',
  delivery: 'invoice',
};

const NEXT_STATUS: Partial<Record<DocumentKind, DocumentStatus[]>> = {
  estimate: ['draft', 'sent', 'approved', 'cancelled'],
  order:    ['draft', 'sent', 'cancelled'],
  delivery: ['draft', 'delivered', 'cancelled'],
  invoice:  ['draft', 'sent', 'paid', 'cancelled'],
};

function emptyLines(): InvoiceLine[] {
  return [{ id: uuidv4(), description: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 }];
}

export default function DocumentStudio({ persona, settings: _settings, onClose }: Props) {
  const inv = useInvoices();
  const crm = useCRM();
  const deals = useMemo(() => crm.getForPersona(persona.id), [crm.deals, persona.id]);

  const [tab, setTab] = useState<Tab>('estimate');
  const [view, setView] = useState<View>('list');
  const [editingDoc, setEditingDoc] = useState<BusinessDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<BusinessDocument | null>(null);

  const docsForTab = useMemo(() =>
    inv.getDocumentsForPersona(persona.id).filter(d => d.kind === tab),
    [inv.documents, persona.id, tab]);

  const issuer = inv.getIssuer(persona.id);

  // ─── フォーム状態 ─────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [subject, setSubject] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [dueDate, setDueDate] = useState(calcDueDate(today, 'eom-next'));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>(emptyLines());
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('月末締・翌月末日払い');

  const selectedClient = useMemo(() =>
    inv.clients.find(c => c.id === selectedClientId) || null,
    [inv.clients, selectedClientId]);

  const totals = useMemo(() => computeTotals(lines), [lines]);

  const resetForm = useCallback(() => {
    setSubject(''); setIssueDate(today); setValidUntil(''); setDeliveryDate('');
    setDueDate(calcDueDate(today, 'eom-next')); setSelectedClientId(null); setDealId(null);
    setLines(emptyLines()); setNotes(''); setPaymentTerms('月末締・翌月末日払い');
  }, [today]);

  const loadDoc = useCallback((doc: BusinessDocument) => {
    setSubject(doc.subject);
    setIssueDate(doc.issueDate);
    setValidUntil(doc.validUntil || '');
    setDeliveryDate(doc.deliveryDate || '');
    setDueDate(doc.dueDate || '');
    setSelectedClientId(doc.clientSnapshot.id);
    setDealId(doc.dealId || null);
    setLines(doc.lines.map(l => ({ ...l, id: l.id || uuidv4() })));
    setNotes(doc.notes || '');
    setPaymentTerms(doc.paymentTerms || '');
  }, []);

  const openCompose = useCallback(() => {
    resetForm();
    setEditingDoc(null);
    setView('compose');
  }, [resetForm]);

  const openEdit = useCallback((doc: BusinessDocument) => {
    loadDoc(doc);
    setEditingDoc(doc);
    setView('compose');
  }, [loadDoc]);

  const openDetail = useCallback((doc: BusinessDocument) => {
    setViewingDoc(doc);
    setView('detail');
  }, []);

  // ─── ライン操作 ─────────────────────────────────────────
  const addLine = () => setLines(prev => [...prev, { id: uuidv4(), description: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 }]);
  const updateLine = (id: string, patch: Partial<InvoiceLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  const removeLine = (id: string) =>
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);

  // ─── 保存 ─────────────────────────────────────────────
  const handleSave = useCallback((status: DocumentStatus = 'draft') => {
    if (!issuer) { alert('まず発行者プロファイルを請求書スタジオで設定してください'); return; }
    const client: Client = selectedClient || { id: uuidv4(), name: '(未設定)' };

    if (editingDoc) {
      inv.updateDocument(editingDoc.id, {
        subject, issueDate, validUntil: validUntil || undefined,
        deliveryDate: deliveryDate || undefined, dueDate: dueDate || undefined,
        clientSnapshot: client, dealId: dealId || undefined,
        lines, notes, paymentTerms, status,
      });
    } else {
      inv.createDocument({
        personaId: persona.id,
        personaName: persona.name,
        kind: tab,
        issuer,
        client,
        subject, issueDate,
        validUntil: validUntil || undefined,
        deliveryDate: deliveryDate || undefined,
        dueDate: dueDate || undefined,
        lines, notes, paymentTerms,
        dealId: dealId || undefined,
      });
    }
    setView('list');
    resetForm();
    setEditingDoc(null);
  }, [editingDoc, issuer, selectedClient, subject, issueDate, validUntil, deliveryDate, dueDate, dealId, lines, notes, paymentTerms, tab, inv, persona, resetForm]);

  // ─── 複製 ─────────────────────────────────────────────
  const handleDuplicate = useCallback((doc: BusinessDocument, nextKind: DocumentKind) => {
    inv.duplicateAsNext(doc.id, nextKind, persona.name);
    setTab(nextKind);
    setView('list');
  }, [inv, persona.name]);

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '960px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>📄</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">書類スタジオ</p>
              <p className="cp-meta truncate">{persona.name} · 見積書→発注書→納品書→請求書</p>
            </div>
          </div>
          <div className="cp-row">
            {view === 'list' && (
              <button onClick={openCompose}
                className="cp-btn cp-btn-primary cp-btn-sm"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                ＋ 新規作成
              </button>
            )}
            {view !== 'list' && (
              <button onClick={() => { setView('list'); setEditingDoc(null); setViewingDoc(null); }}
                className="cp-btn cp-btn-ghost cp-btn-sm">← 一覧</button>
            )}
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
          </div>
        </div>

        {/* タブ */}
        <div className="cp-modal-tabs">
          {(Object.keys(KIND_META) as DocumentKind[]).map(k => {
            const m = KIND_META[k];
            const cnt = inv.getDocumentsForPersona(persona.id).filter(d => d.kind === k).length;
            return (
              <button key={k} onClick={() => { setTab(k); setView('list'); }}
                className="cp-modal-tab" data-active={tab === k}
                style={{ color: tab === k ? m.color : undefined }}>
                {m.emoji} {m.label} {cnt > 0 && <span className="cp-meta">({cnt})</span>}
              </button>
            );
          })}
        </div>

        <div className="cp-modal-body">
          <AnimatePresence mode="wait">
            {/* ─── 一覧 ─── */}
            {view === 'list' && (
              <motion.div key="list"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {docsForTab.length === 0 ? (
                  <div className="cp-empty">
                    <p className="cp-empty-icon">{KIND_META[tab].emoji}</p>
                    <p>{KIND_META[tab].label}がまだありません</p>
                    <button onClick={openCompose}
                      className="cp-btn cp-btn-primary mt-3"
                      style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                      ＋ 最初の{KIND_META[tab].label}を作成
                    </button>
                  </div>
                ) : (
                  <div className="cp-stack-sm">
                    {docsForTab.map(doc => {
                      const totDoc = computeTotals(doc.lines);
                      const st = STATUS_LABEL[doc.status];
                      const nextKind = NEXT_KIND[doc.kind];
                      return (
                        <div key={doc.id} className="cp-card cp-row-between">
                          <button className="flex-1 text-left cp-row min-w-0" onClick={() => openDetail(doc)}>
                            <div className="min-w-0">
                              <div className="cp-row" style={{ gap: 6 }}>
                                <span className="cp-h3 truncate">{doc.number}</span>
                                <span className="cp-pill text-[11px]"
                                  style={{ color: st.color, borderColor: st.color + '40' }}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="cp-meta truncate">{doc.subject} · {doc.clientSnapshot.name}</p>
                              <p className="cp-tiny">{doc.issueDate}</p>
                            </div>
                          </button>
                          <div className="cp-row flex-shrink-0" style={{ gap: 8 }}>
                            <span className="font-mono cp-body">{fmtJpy(totDoc.total)}</span>
                            <div className="cp-row" style={{ gap: 4 }}>
                              <button onClick={() => openEdit(doc)}
                                className="cp-btn cp-btn-ghost cp-btn-sm text-xs">編集</button>
                              {nextKind && (
                                <button
                                  onClick={() => handleDuplicate(doc, nextKind)}
                                  className="cp-btn cp-btn-sm text-xs"
                                  style={{ color: KIND_META[nextKind].color, borderColor: KIND_META[nextKind].color + '40' }}>
                                  {KIND_META[nextKind].emoji} {KIND_META[nextKind].label}化
                                </button>
                              )}
                              {doc.kind !== 'invoice' && (
                                <button
                                  onClick={() => handleDuplicate(doc, 'invoice')}
                                  className="cp-btn cp-btn-sm text-xs"
                                  style={{ color: KIND_META.invoice.color, borderColor: KIND_META.invoice.color + '40' }}>
                                  🧾 請求化
                                </button>
                              )}
                              <button onClick={() => {
                                if (confirm('削除しますか?')) inv.removeDocument(doc.id);
                              }} className="cp-btn cp-btn-ghost cp-btn-sm text-xs" style={{ color: '#f87171' }}>削除</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── 作成・編集フォーム ─── */}
            {view === 'compose' && (
              <motion.div key="compose"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="cp-stack">
                  <div className="cp-grid-2">
                    <div>
                      <label className="cp-label">件名</label>
                      <input value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder={`${KIND_META[tab].label}の件名`} className="cp-input" />
                    </div>
                    <div>
                      <label className="cp-label">発行日</label>
                      <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="cp-input" />
                    </div>
                    {tab === 'estimate' && (
                      <div>
                        <label className="cp-label">有効期限</label>
                        <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="cp-input" />
                      </div>
                    )}
                    {(tab === 'order' || tab === 'delivery') && (
                      <div>
                        <label className="cp-label">{tab === 'order' ? '希望納期' : '納品日'}</label>
                        <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="cp-input" />
                      </div>
                    )}
                    {tab === 'invoice' && (
                      <div>
                        <label className="cp-label">支払期限</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="cp-input" />
                      </div>
                    )}
                    <div>
                      <label className="cp-label">取引先</label>
                      <select value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value || null)} className="cp-select">
                        <option value="">— 取引先を選択 —</option>
                        {inv.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {deals.length > 0 && (
                      <div>
                        <label className="cp-label">CRM 案件紐付け (任意)</label>
                        <select value={dealId || ''} onChange={e => setDealId(e.target.value || null)} className="cp-select">
                          <option value="">— 案件なし —</option>
                          {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 明細 */}
                  <div>
                    <div className="cp-row-between mb-2">
                      <label className="cp-label mb-0">明細</label>
                      <button onClick={addLine} className="cp-btn cp-btn-ghost cp-btn-sm">＋ 追加</button>
                    </div>
                    <div className="cp-stack-sm">
                      {lines.map((l, idx) => (
                        <div key={l.id} className="cp-card cp-stack-sm" style={{ padding: '10px' }}>
                          <div className="cp-row">
                            <span className="cp-meta w-5 flex-shrink-0">{idx + 1}</span>
                            <input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })}
                              placeholder="品目・サービス内容" className="cp-input flex-1" />
                            <button onClick={() => removeLine(l.id)} className="cp-btn cp-btn-ghost cp-btn-sm flex-shrink-0"
                              style={{ color: '#f87171' }}>✕</button>
                          </div>
                          <div className="grid gap-2" style={{ gridTemplateColumns: '80px 60px 100px 120px 100px' }}>
                            <div>
                              <label className="cp-label">数量</label>
                              <input type="number" min={0} value={l.quantity}
                                onChange={e => updateLine(l.id, { quantity: Number(e.target.value) })}
                                className="cp-input" />
                            </div>
                            <div>
                              <label className="cp-label">単位</label>
                              <input value={l.unit || ''} onChange={e => updateLine(l.id, { unit: e.target.value })}
                                className="cp-input" />
                            </div>
                            <div>
                              <label className="cp-label">単価 (税抜)</label>
                              <input type="number" min={0} value={l.unitPrice}
                                onChange={e => updateLine(l.id, { unitPrice: Number(e.target.value) })}
                                className="cp-input" />
                            </div>
                            <div>
                              <label className="cp-label">税率</label>
                              <select value={l.taxRate} onChange={e => updateLine(l.id, { taxRate: Number(e.target.value) as 0 | 8 | 10 })}
                                className="cp-select">
                                <option value={10}>10%</option>
                                <option value={8}>8% (軽減)</option>
                                <option value={0}>非課税</option>
                              </select>
                            </div>
                            <div>
                              <label className="cp-label">金額</label>
                              <p className="cp-input font-mono" style={{ display: 'flex', alignItems: 'center' }}>
                                {fmtJpy(l.quantity * l.unitPrice)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* 合計 */}
                    <div className="mt-3 p-3 rounded-xl text-right cp-stack-sm" style={{ background: 'var(--surface-3)' }}>
                      {totals.subtotal10 > 0 && <p className="cp-meta">10%対象: {fmtJpy(totals.subtotal10)} → 消費税 {fmtJpy(totals.tax10)}</p>}
                      {totals.subtotal8 > 0 && <p className="cp-meta">8%対象: {fmtJpy(totals.subtotal8)} → 消費税 {fmtJpy(totals.tax8)}</p>}
                      <p className="cp-body">税抜合計: <span className="font-mono">{fmtJpy(totals.subtotal)}</span></p>
                      <p className="text-fg font-semibold" style={{ fontSize: '1.1rem' }}>
                        税込合計: <span className="font-mono" style={{ color: persona.accentColor }}>{fmtJpy(totals.total)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="cp-grid-2">
                    <div>
                      <label className="cp-label">備考</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        className="cp-textarea" rows={3} />
                    </div>
                    <div>
                      <label className="cp-label">支払条件</label>
                      <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                        className="cp-textarea" rows={3} />
                    </div>
                  </div>

                  <div className="cp-row-between pt-2">
                    {editingDoc && (
                      <button onClick={() => { if (confirm('削除しますか?')) { inv.removeDocument(editingDoc.id); setView('list'); setEditingDoc(null); } }}
                        className="cp-btn cp-btn-ghost cp-btn-sm" style={{ color: '#f87171' }}>削除</button>
                    )}
                    <div className="cp-row ml-auto">
                      <button onClick={() => handleSave('draft')}
                        className="cp-btn cp-btn-ghost">下書き保存</button>
                      <button onClick={() => handleSave('sent')}
                        className="cp-btn cp-btn-primary"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                        発送済として保存
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── 詳細表示 ─── */}
            {view === 'detail' && viewingDoc && (
              <motion.div key="detail"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <DocDetail
                  doc={viewingDoc}
                  persona={persona}
                  deals={deals}
                  onEdit={() => openEdit(viewingDoc)}
                  onDuplicate={handleDuplicate}
                  onStatusChange={(status) => {
                    inv.updateDocument(viewingDoc.id, { status });
                    setViewingDoc({ ...viewingDoc, status });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DocDetail({ doc, persona, deals, onEdit, onDuplicate, onStatusChange }: {
  doc: BusinessDocument;
  persona: Persona;
  deals: import('../types/crm').CRMDeal[];
  onEdit: () => void;
  onDuplicate: (doc: BusinessDocument, kind: DocumentKind) => void;
  onStatusChange: (s: DocumentStatus) => void;
}) {
  const totals = computeTotals(doc.lines);
  const meta = KIND_META[doc.kind];
  const deal = deals.find(d => d.id === doc.dealId);
  const nextKind = NEXT_KIND[doc.kind];
  const validStatuses = NEXT_STATUS[doc.kind] || [];

  return (
    <div className="cp-stack">
      <div className="cp-row-between">
        <div>
          <div className="cp-row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="text-lg">{meta.emoji}</span>
            <span className="cp-h2" style={{ color: meta.color }}>{doc.number}</span>
            <span className="cp-pill" style={{ color: STATUS_LABEL[doc.status].color, borderColor: STATUS_LABEL[doc.status].color + '40' }}>
              {STATUS_LABEL[doc.status].label}
            </span>
          </div>
          <p className="cp-meta">{doc.subject}</p>
        </div>
        <div className="cp-row">
          <button onClick={onEdit} className="cp-btn cp-btn-ghost cp-btn-sm">編集</button>
        </div>
      </div>

      {/* ステータス変更 */}
      <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <span className="cp-meta">ステータス変更:</span>
        {validStatuses.map(s => (
          <button key={s} onClick={() => onStatusChange(s)}
            className="cp-btn cp-btn-sm text-xs"
            style={doc.status === s
              ? { background: STATUS_LABEL[s].color, color: '#0a0a0f', borderColor: 'transparent' }
              : { color: STATUS_LABEL[s].color, borderColor: STATUS_LABEL[s].color + '40' }}>
            {STATUS_LABEL[s].label}
          </button>
        ))}
      </div>

      {/* 複製ボタン */}
      <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <span className="cp-meta">複製先:</span>
        {nextKind && (
          <button onClick={() => onDuplicate(doc, nextKind)}
            className="cp-btn cp-btn-sm text-xs"
            style={{ color: KIND_META[nextKind].color, borderColor: KIND_META[nextKind].color + '40' }}>
            {KIND_META[nextKind].emoji} {KIND_META[nextKind].label}として複製
          </button>
        )}
        {doc.kind !== 'invoice' && doc.kind !== 'delivery' && (
          <button onClick={() => onDuplicate(doc, 'invoice')}
            className="cp-btn cp-btn-sm text-xs"
            style={{ color: KIND_META.invoice.color, borderColor: KIND_META.invoice.color + '40' }}>
            🧾 請求書として複製
          </button>
        )}
      </div>

      {/* 基本情報 */}
      <div className="cp-grid-2">
        <div className="cp-card-section">
          <p className="cp-section-head">発行情報</p>
          <p className="cp-body">{doc.issuerSnapshot.companyName}</p>
          <p className="cp-meta">発行日: {doc.issueDate}</p>
          {doc.validUntil && <p className="cp-meta">有効期限: {doc.validUntil}</p>}
          {doc.deliveryDate && <p className="cp-meta">納期: {doc.deliveryDate}</p>}
          {doc.dueDate && <p className="cp-meta">支払期限: {doc.dueDate}</p>}
        </div>
        <div className="cp-card-section">
          <p className="cp-section-head">請求先</p>
          <p className="cp-body">{doc.clientSnapshot.name}</p>
          {doc.clientSnapshot.contactName && <p className="cp-meta">{doc.clientSnapshot.contactName}</p>}
          {doc.clientSnapshot.address && <p className="cp-meta">{doc.clientSnapshot.address}</p>}
          {deal && <p className="cp-meta">🤝 案件: {deal.title}</p>}
        </div>
      </div>

      {/* 明細 */}
      <div className="cp-card-section">
        <p className="cp-section-head mb-2">明細</p>
        <div className="cp-stack-sm">
          {doc.lines.map((l, i) => (
            <div key={l.id || i} className="cp-row-between">
              <span className="cp-body flex-1">{l.description}</span>
              <span className="cp-meta">{l.quantity}{l.unit} × {fmtJpy(l.unitPrice)}</span>
              <span className="font-mono cp-body">{fmtJpy(l.quantity * l.unitPrice)}</span>
            </div>
          ))}
          <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            {totals.subtotal10 > 0 && <p className="cp-meta text-right">消費税 10%: {fmtJpy(totals.tax10)}</p>}
            {totals.subtotal8 > 0 && <p className="cp-meta text-right">消費税 8%: {fmtJpy(totals.tax8)}</p>}
            <p className="text-fg font-semibold text-right" style={{ fontSize: '1.1rem', color: persona.accentColor }}>
              合計: {fmtJpy(totals.total)}
            </p>
          </div>
        </div>
      </div>

      {doc.notes && (
        <div className="cp-card-section">
          <p className="cp-section-head">備考</p>
          <p className="cp-body" style={{ whiteSpace: 'pre-wrap' }}>{doc.notes}</p>
        </div>
      )}
    </div>
  );
}
