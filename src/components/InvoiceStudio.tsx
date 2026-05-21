import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import type { Persona, AppSettings } from '../types/identity';
import type { Client, Invoice, InvoiceLine, IssuerProfile, TaxRate } from '../types/invoice';
import { useInvoices } from '../hooks/useInvoices';
import { computeTotals, fmtJpy, calcDueDate } from '../lib/invoiceCalc';
import { aiSuggestInvoice } from '../lib/invoiceAI';
import { InvoicePrintView } from './InvoicePrintView';
import { confirmAction } from '../lib/confirmDialog';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = 'compose' | 'history' | 'issuer' | 'clients';

export default function InvoiceStudio({ persona, settings, onClose }: Props) {
  const inv = useInvoices();
  const [tab, setTab] = useState<Tab>('compose');
  const [error, setError] = useState<string | null>(null);

  // 発行者プロファイル (人格に紐づき、なければデフォルトで作成)
  const issuerExisting = inv.getIssuer(persona.id);
  const [issuer, setIssuer] = useState<IssuerProfile>(issuerExisting || {
    personaId: persona.id,
    companyName: persona.name,
    registrationNumber: '',
    bankInfo: '',
    address: '',
    phone: '',
    email: '',
    postalCode: '',
    representativeName: '',
  });

  // 顧客選択
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = useMemo(() => inv.clients.find(c => c.id === selectedClientId) || null, [inv.clients, selectedClientId]);
  const [newClient, setNewClient] = useState<Client>({ id: '', name: '', contactName: '', address: '', email: '', postalCode: '' });

  // 請求書内容
  const today = new Date().toISOString().slice(0, 10);
  const [subject, setSubject] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(calcDueDate(today, 'eom-next'));
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: uuidv4(), description: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 },
  ]);
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('月末締・翌月末日払い');

  // AI アシスト
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // 発行済プレビュー (印刷用)
  const [issued, setIssued] = useState<Invoice | null>(null);

  const totals = useMemo(() => computeTotals(lines), [lines]);

  // ─── ライン操作 ─────────────────────
  const addLine = () => setLines(prev => [...prev, { id: uuidv4(), description: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 }]);
  const updateLine = (id: string, patch: Partial<InvoiceLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  const removeLine = (id: string) =>
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);

  // ─── AI 明細生成 ─────────────────────
  const handleAi = useCallback(async () => {
    if (!aiPrompt.trim()) {
      setError('依頼内容を入力してください');
      return;
    }
    setAiBusy(true);
    setError(null);
    try {
      const result = await aiSuggestInvoice({
        settings, prompt: aiPrompt,
        clientName: selectedClient?.name || newClient.name,
        issueDate,
      });
      if (result.subject) setSubject(result.subject);
      if (result.lines.length > 0) setLines(result.lines);
      if (result.notes) setNotes(result.notes);
      if (result.paymentTerms) setPaymentTerms(result.paymentTerms);
      if (result.dueKind) setDueDate(calcDueDate(issueDate, result.dueKind));
      // AI が依頼文から抽出した宛先を反映 (既存顧客に無ければ新規顧客に)
      if (result.clientName) {
        const matched = inv.clients.find(c => c.name === result.clientName);
        if (matched) {
          setSelectedClientId(matched.id);
        } else {
          setSelectedClientId(null);
          setNewClient(prev => ({ ...prev, name: result.clientName as string }));
        }
      }
      // 明細が 1 行でも入ったらエラーを消す
      if (result.lines.length > 0) setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }, [aiPrompt, settings, selectedClient, newClient, issueDate]);

  // ─── 発行 ───────────────────────────
  const handleIssue = useCallback(() => {
    setError(null);
    if (!issuer.companyName.trim()) { setTab('issuer'); setError('発行者情報 (会社名) を設定してください'); return; }
    let client = selectedClient;
    if (!client) {
      if (!newClient.name.trim()) { setError('顧客名を入力してください'); return; }
      client = inv.newClient({ ...newClient });
      setSelectedClientId(client.id);
    } else {
      // 既存クライアントの上書き反映
      inv.upsertClient(client);
    }
    if (lines.every(l => !l.description.trim() || (l.unitPrice <= 0 && l.taxRate !== 0))) {
      setError('明細を1行以上入力してください');
      return;
    }
    inv.upsertIssuer(issuer);
    const invoice = inv.createInvoice({
      personaId: persona.id,
      personaName: persona.name,
      issuer, client, subject, issueDate, dueDate,
      lines: lines.filter(l => l.description.trim().length > 0),
      notes, paymentTerms,
    });
    setIssued(invoice);
  }, [issuer, selectedClient, newClient, lines, subject, issueDate, dueDate, notes, paymentTerms, inv, persona]);

  const handlePrint = () => window.print();

  const personaInvoices = inv.getForPersona(persona.id);

  // 印刷モードでは投票印刷ビューを全画面で表示
  if (issued) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto" style={{ background: '#222' }}>
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur px-5 py-3 flex items-center justify-between print:hidden">
          <div className="text-white">
            <p className="text-sm font-semibold">{issued.number} 発行完了</p>
            <p className="text-xs opacity-70">印刷ダイアログから「PDFとして保存」も可能です</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-md text-sm font-semibold"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
            >🖨 印刷 / PDF保存</button>
            <button
              onClick={() => { setIssued(null); }}
              className="px-3 py-1.5 rounded-md text-sm text-white/70 hover:text-white"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            >新規作成</button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-white/70 hover:text-white"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            >閉じる</button>
          </div>
        </div>
        <div className="py-6">
          <div className="shadow-2xl mx-auto" style={{ background: '#FFF' }}>
            <InvoicePrintView invoice={issued} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >🧾</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">請求書スタジオ</p>
              <p className="text-fg-muted text-xs truncate">{persona.name} · インボイス制度準拠 · AI で明細を自動構成</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'compose' as Tab, label: '✍ 新規作成' },
            { id: 'history' as Tab, label: `🗂 履歴 (${personaInvoices.length})` },
            { id: 'issuer' as Tab, label: '🏢 発行者' },
            { id: 'clients' as Tab, label: `👥 顧客 (${inv.clients.length})` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              className="text-sm px-4 py-2 rounded-t-md font-medium"
              style={{
                background: tab === t.id ? persona.accentColorLight : 'transparent',
                color: tab === t.id ? persona.accentColor : 'var(--fg-muted)',
                borderBottom: tab === t.id ? `2px solid ${persona.accentColor}` : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-md p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {tab === 'compose' && (
            <>
              {/* AI アシスト */}
              <div className="rounded-xl p-3" style={{ background: `${persona.accentColor}10`, border: `1px solid ${persona.accentColor}50` }}>
                <p className="text-fg text-sm font-semibold mb-1">✨ AI で明細を自動構成</p>
                <p className="text-fg-muted text-xs mb-2">「Web制作50万円、月末締翌月末払い、振込手数料はクライアント負担」のように書くだけで明細が組まれます。</p>
                <div className="flex gap-2">
                  <input
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="依頼内容を自然言語で..."
                    className="flex-1 text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none placeholder:text-fg-subtle"
                  />
                  <button
                    onClick={handleAi}
                    disabled={aiBusy || !aiPrompt.trim()}
                    className="text-xs px-3 py-2 rounded font-semibold disabled:opacity-50"
                    style={{ background: persona.accentColor, color: '#0a0a0f' }}
                  >{aiBusy ? '生成中…' : '✨ 構成'}</button>
                </div>
              </div>

              {/* 顧客 */}
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">宛先</p>
                {inv.clients.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {inv.clients.slice(0, 8).map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClientId(c.id); setNewClient({ id: '', name: '', contactName: '', address: '', email: '', postalCode: '' }); }}
                        className="text-xs px-2.5 py-1 rounded-md"
                        style={{
                          background: selectedClientId === c.id ? persona.accentColorLight : 'var(--surface)',
                          color: selectedClientId === c.id ? persona.accentColor : 'var(--fg-muted)',
                          border: `1px solid ${selectedClientId === c.id ? persona.accentColor + '50' : 'var(--border)'}`,
                        }}
                      >{c.name}</button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="顧客名 (御中)">
                    <input
                      type="text"
                      value={selectedClient ? selectedClient.name : newClient.name}
                      onChange={e => {
                        if (selectedClient) inv.upsertClient({ ...selectedClient, name: e.target.value });
                        else setNewClient({ ...newClient, name: e.target.value });
                      }}
                      placeholder="株式会社サンプル"
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                    />
                  </Field>
                  <Field label="担当者名">
                    <input
                      type="text"
                      value={selectedClient ? (selectedClient.contactName || '') : (newClient.contactName || '')}
                      onChange={e => {
                        if (selectedClient) inv.upsertClient({ ...selectedClient, contactName: e.target.value });
                        else setNewClient({ ...newClient, contactName: e.target.value });
                      }}
                      placeholder="山田 太郎 様"
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                    />
                  </Field>
                  <Field label="郵便番号">
                    <input
                      type="text"
                      value={selectedClient ? (selectedClient.postalCode || '') : (newClient.postalCode || '')}
                      onChange={e => {
                        if (selectedClient) inv.upsertClient({ ...selectedClient, postalCode: e.target.value });
                        else setNewClient({ ...newClient, postalCode: e.target.value });
                      }}
                      placeholder="100-0001"
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                    />
                  </Field>
                  <Field label="メール">
                    <input
                      type="email"
                      value={selectedClient ? (selectedClient.email || '') : (newClient.email || '')}
                      onChange={e => {
                        if (selectedClient) inv.upsertClient({ ...selectedClient, email: e.target.value });
                        else setNewClient({ ...newClient, email: e.target.value });
                      }}
                      placeholder="contact@sample.co.jp"
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                    />
                  </Field>
                  <Field label="住所" full>
                    <input
                      type="text"
                      value={selectedClient ? (selectedClient.address || '') : (newClient.address || '')}
                      onChange={e => {
                        if (selectedClient) inv.upsertClient({ ...selectedClient, address: e.target.value });
                        else setNewClient({ ...newClient, address: e.target.value });
                      }}
                      placeholder="東京都千代田区..."
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                    />
                  </Field>
                </div>
                {selectedClient && (
                  <button onClick={() => setSelectedClientId(null)} className="mt-2 text-xs text-fg-muted hover:text-fg">+ 新規顧客にする</button>
                )}
              </div>

              {/* 件名 + 日付 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <Field label="件名">
                    <input value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="2026年5月分 ご請求"
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                  </Field>
                </div>
                <Field label="発行日">
                  <input type="date" value={issueDate} onChange={e => { setIssueDate(e.target.value); setDueDate(calcDueDate(e.target.value, 'eom-next')); }}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="支払期限">
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="支払期限プリセット">
                  <select onChange={e => setDueDate(calcDueDate(issueDate, e.target.value as any))}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg">
                    <option value="">選択…</option>
                    <option value="eom-next">月末締・翌月末払い</option>
                    <option value="plus30">発行日 +30日</option>
                    <option value="plus14">発行日 +14日</option>
                    <option value="plus60">発行日 +60日</option>
                  </select>
                </Field>
              </div>

              {/* 明細 */}
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-fg-muted text-xs tracking-wider uppercase">明細</p>
                  <button onClick={addLine} className="text-xs px-2 py-1 rounded bg-surface-3 border-edge border text-fg-muted hover:text-fg">+ 行を追加</button>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-1.5 text-[10px] text-fg-muted tracking-wider uppercase px-1">
                    <span className="col-span-5">品目</span>
                    <span className="col-span-1 text-right">数量</span>
                    <span className="col-span-1 text-center">単位</span>
                    <span className="col-span-2 text-right">単価</span>
                    <span className="col-span-1 text-center">税率</span>
                    <span className="col-span-2 text-right">小計</span>
                  </div>
                  {lines.map(l => {
                    const sub = (l.quantity || 0) * (l.unitPrice || 0);
                    return (
                      <div key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          value={l.description}
                          onChange={e => updateLine(l.id, { description: e.target.value })}
                          placeholder="サービス内容"
                          className="col-span-5 text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                        />
                        <input
                          type="number" min={0} value={l.quantity}
                          onChange={e => updateLine(l.id, { quantity: Number(e.target.value) || 0 })}
                          className="col-span-1 text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg text-right"
                        />
                        <input
                          value={l.unit || ''}
                          onChange={e => updateLine(l.id, { unit: e.target.value })}
                          placeholder="式"
                          className="col-span-1 text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg text-center"
                        />
                        <input
                          type="number" min={0} value={l.unitPrice}
                          onChange={e => updateLine(l.id, { unitPrice: Number(e.target.value) || 0 })}
                          className="col-span-2 text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg text-right"
                        />
                        <select
                          value={l.taxRate}
                          onChange={e => updateLine(l.id, { taxRate: Number(e.target.value) as TaxRate, reducedTax: Number(e.target.value) === 8 })}
                          className="col-span-1 text-sm px-1 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                        >
                          <option value={10}>10%</option>
                          <option value={8}>軽8%</option>
                          <option value={0}>非課</option>
                        </select>
                        <div className="col-span-2 text-right text-sm text-fg pr-1">
                          {fmtJpy(sub)}
                        </div>
                        <button
                          onClick={() => removeLine(l.id)}
                          className="absolute opacity-0"
                          tabIndex={-1}
                          aria-hidden
                        />
                      </div>
                    );
                  })}
                </div>
                {lines.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lines.map((l, i) => (
                      <button key={l.id} onClick={() => removeLine(l.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface text-fg-muted hover:text-red-400 hover:bg-red-400/10">
                        × {i + 1}行目を削除
                      </button>
                    ))}
                  </div>
                )}

                {/* 合計 */}
                <div className="mt-3 pt-3 border-t border-border flex justify-end">
                  <div className="text-sm space-y-0.5 text-right">
                    <div className="text-fg-muted">小計（税抜） <span className="font-mono text-fg ml-2">{fmtJpy(totals.subtotal)}</span></div>
                    {totals.tax10 > 0 && <div className="text-fg-muted">消費税10%対象 <span className="font-mono text-fg ml-2">{fmtJpy(totals.tax10)}</span></div>}
                    {totals.tax8 > 0 && <div className="text-fg-muted">消費税8% (軽減) <span className="font-mono text-fg ml-2">{fmtJpy(totals.tax8)}</span></div>}
                    <div className="text-base font-semibold pt-1" style={{ color: persona.accentColor }}>
                      合計（税込） <span className="font-mono ml-2">{fmtJpy(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 備考 + 支払条件 */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="支払条件">
                  <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="備考">
                  <input value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="振込手数料はご負担ください"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="text-xs px-4 py-2 rounded text-fg-muted hover:text-fg">キャンセル</button>
                <button
                  onClick={handleIssue}
                  className="text-sm px-5 py-2 rounded-lg font-semibold"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                >🧾 請求書を発行 (連番採番)</button>
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {personaInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-fg-muted text-sm">発行済み請求書はまだありません</p>
                </div>
              ) : personaInvoices.map(invItem => {
                const t = computeTotals(invItem.lines);
                return (
                  <div key={invItem.id} className="rounded-xl p-3 flex items-center justify-between gap-3"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-fg text-sm font-mono">{invItem.number}</span>
                        <span className="text-fg-muted text-xs">{invItem.issueDate}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: invItem.status === 'paid' ? 'rgba(74,222,128,0.15)' : `${persona.accentColor}20`, color: invItem.status === 'paid' ? '#4ADE80' : persona.accentColor }}>
                          {invItem.status === 'paid' ? '入金済' : invItem.status === 'cancelled' ? '取消' : '発行済'}
                        </span>
                      </div>
                      <p className="text-fg text-sm mt-0.5 truncate">{invItem.clientSnapshot.name} · {invItem.subject}</p>
                      <p className="text-fg-muted text-xs">合計 {fmtJpy(t.total)} · 期限 {invItem.dueDate}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setIssued(invItem)} className="text-xs px-3 py-1.5 rounded font-semibold"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}>表示</button>
                      {invItem.status !== 'paid' && (
                        <button onClick={() => inv.updateInvoice(invItem.id, { status: 'paid' })} className="text-xs px-2 py-1.5 rounded text-fg-muted hover:text-fg">入金済に</button>
                      )}
                      <button onClick={async () => { if (await confirmAction({ title: 'この請求書を削除しますか?', tone: 'danger' })) inv.removeInvoice(invItem.id); }} className="text-xs px-2 py-1.5 rounded text-fg-muted hover:text-red-400">削除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'issuer' && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">発行者情報 (人格に紐づく)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="会社名 / 屋号 *">
                  <input value={issuer.companyName}
                    onChange={e => setIssuer({ ...issuer, companyName: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="代表者氏名">
                  <input value={issuer.representativeName || ''}
                    onChange={e => setIssuer({ ...issuer, representativeName: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="郵便番号">
                  <input value={issuer.postalCode || ''}
                    onChange={e => setIssuer({ ...issuer, postalCode: e.target.value })}
                    placeholder="100-0001"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="電話番号">
                  <input value={issuer.phone || ''}
                    onChange={e => setIssuer({ ...issuer, phone: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="住所" full>
                  <input value={issuer.address || ''}
                    onChange={e => setIssuer({ ...issuer, address: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="メール">
                  <input type="email" value={issuer.email || ''}
                    onChange={e => setIssuer({ ...issuer, email: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="適格請求書発行事業者登録番号">
                  <input value={issuer.registrationNumber || ''}
                    onChange={e => setIssuer({ ...issuer, registrationNumber: e.target.value })}
                    placeholder="T1234567890123"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg font-mono" />
                </Field>
                <Field label="振込先" full>
                  <textarea value={issuer.bankInfo || ''}
                    onChange={e => setIssuer({ ...issuer, bankInfo: e.target.value })}
                    rows={2}
                    placeholder="○○銀行 △△支店 普通 1234567 コア カブシキガイシャ"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg resize-none" />
                </Field>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => { inv.upsertIssuer(issuer); setError(null); setTab('compose'); }}
                  className="text-sm px-4 py-2 rounded-lg font-semibold"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                >保存して請求書作成へ →</button>
              </div>
            </div>
          )}

          {tab === 'clients' && (
            <div className="space-y-1.5">
              {inv.clients.length === 0 ? (
                <p className="text-fg-muted text-sm text-center py-8">顧客が登録されていません。請求書発行時に自動で追加されます</p>
              ) : inv.clients.map(c => (
                <div key={c.id} className="rounded-lg p-2.5 flex items-center justify-between gap-2"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm truncate">{c.name}</p>
                    <p className="text-fg-muted text-xs truncate">{c.contactName || ''} {c.email && `· ${c.email}`}</p>
                  </div>
                  <button onClick={async () => { if (await confirmAction({ title: 'この取引先を削除しますか?', tone: 'danger' })) inv.removeClient(c.id); }}
                    className="text-xs px-2 py-1 rounded text-fg-muted hover:text-red-400">削除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-fg-muted text-[10px] tracking-wider uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}
