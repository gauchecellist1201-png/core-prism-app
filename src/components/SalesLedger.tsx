import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { SalesEntry } from '../types/sales';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import {
  monthlySeries, summarizeMonth, summarizeYear, clientRanking,
  entriesToCsv, downloadCsv,
} from '../lib/salesLedger';
import { fmtJpy } from '../lib/invoiceCalc';
import { CountUp } from './visualFx';
import { confirmAction } from '../lib/confirmDialog';
import SampleDataCTA from './SampleDataCTA';

interface Props {
  persona: Persona;
  onClose: () => void;
}

type Tab = 'overview' | 'entries' | 'clients' | 'add';

export default function SalesLedger({ persona, onClose }: Props) {
  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const personaEntries = useMemo(
    () => ledger.getForPersona(persona.id),
    [ledger.entries, persona.id]
  );

  const [tab, setTab] = useState<Tab>('overview');

  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thisYear = today.getFullYear();

  const monthSummary = useMemo(() => summarizeMonth(personaEntries, thisMonth), [personaEntries, thisMonth]);
  const yearSummary = useMemo(() => summarizeYear(personaEntries, thisYear), [personaEntries, thisYear]);
  const series = useMemo(() => monthlySeries(personaEntries, 12), [personaEntries]);
  const clients = useMemo(() => clientRanking(personaEntries, 8), [personaEntries]);

  // 手動エントリ追加用のフォーム state
  const [m_date, setMDate] = useState(today.toISOString().slice(0, 10));
  const [m_clientName, setMClientName] = useState('');
  const [m_subject, setMSubject] = useState('');
  const [m_amount, setMAmount] = useState('');
  const [m_taxRate, setMTaxRate] = useState<10 | 8 | 0>(10);
  const [m_status, setMStatus] = useState<SalesEntry['status']>('paid');
  const [m_paidDate, setMPaidDate] = useState(today.toISOString().slice(0, 10));
  const [m_notes, setMNotes] = useState('');
  const [m_error, setMError] = useState<string | null>(null);

  const handleAdd = () => {
    setMError(null);
    const amt = Number(m_amount.replace(/,/g, ''));
    if (!m_clientName.trim() || !amt || amt <= 0) {
      setMError('取引先と金額(税抜)を入力してください');
      return;
    }
    const tax = m_taxRate === 0 ? 0 : Math.floor(amt * (m_taxRate / 100));
    const entry = {
      personaId: persona.id,
      date: m_date,
      clientName: m_clientName,
      subject: m_subject || '(手動入力)',
      subtotal10: m_taxRate === 10 ? amt : 0,
      subtotal8:  m_taxRate === 8  ? amt : 0,
      subtotal0:  m_taxRate === 0  ? amt : 0,
      tax10:      m_taxRate === 10 ? tax : 0,
      tax8:       m_taxRate === 8  ? tax : 0,
      totalExcl: amt,
      totalTax: tax,
      totalIncl: amt + tax,
      status: m_status,
      paidDate: m_status === 'paid' ? m_paidDate : undefined,
      notes: m_notes || undefined,
    };
    ledger.addManualEntry(entry);
    // フォームリセット
    setMClientName(''); setMSubject(''); setMAmount(''); setMNotes('');
    setTab('entries');
  };

  const handleExportCsv = () => {
    const csv = entriesToCsv(personaEntries);
    downloadCsv(`売上台帳_${persona.name}_${thisMonth}.csv`, csv);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col"
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
            >📒</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">売上台帳</p>
              <p className="text-fg-muted text-xs truncate">{persona.name} · 請求書と自動連動 · CSV出力対応 (freee/MFインポート可)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={personaEntries.length === 0}
              className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-40"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
            >⬇ CSV 出力</button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
            >×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'overview' as Tab, label: '📊 サマリ' },
            { id: 'entries' as Tab,  label: `🗂 明細 (${personaEntries.length})` },
            { id: 'clients' as Tab,  label: '👥 取引先' },
            { id: 'add' as Tab,      label: '＋ 手動追加' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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
          {tab === 'overview' && (
            <>
              {/* 当月 / 当年 サマリ */}
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard title={`今月 (${thisMonth})`} summary={monthSummary} color={persona.accentColor} />
                <SummaryCard title={`今年 (${thisYear})`} summary={yearSummary} color={persona.accentColor} />
              </div>

              {/* 月次推移グラフ */}
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <p className="text-fg-muted text-xs tracking-wider uppercase mb-3">過去12ヶ月の月次推移 (税込)</p>
                <MonthlyChart series={series} color={persona.accentColor} />
              </div>

              {/* 未入金リスト */}
              {personaEntries.some(e => e.status !== 'paid') && (
                <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg text-sm font-semibold">⚠ 未入金</p>
                    <p className="text-xs text-fg-muted">
                      合計 <span className="text-fg font-mono">{fmtJpy(personaEntries.filter(e => e.status !== 'paid').reduce((s, e) => s + e.totalIncl, 0))}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {personaEntries.filter(e => e.status !== 'paid').slice(0, 12).map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs gap-2 py-1">
                        <span className="text-fg-muted font-mono w-20 flex-shrink-0">{e.date}</span>
                        <span className="text-fg truncate flex-1">{e.clientName}</span>
                        <span className="text-fg font-mono">{fmtJpy(e.totalIncl)}</span>
                        <button
                          onClick={() => ledger.markPaid(e.id)}
                          className="text-[10px] px-2 py-0.5 rounded font-semibold"
                          style={{ background: '#34D399', color: '#0a0a0f' }}
                        >入金済に</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'entries' && (
            <div className="space-y-1.5">
              {personaEntries.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-2">
                  <p className="text-4xl mb-1">📭</p>
                  <p className="text-fg text-sm font-semibold">ここに「いつ・誰から・いくら」が並びます</p>
                  <p className="text-fg-muted text-xs max-w-[260px] leading-relaxed">
                    請求書を発行するか「＋ 手動追加」で 1 件登録すると、月ごとの売上と入金状況がここに自動でたまっていきます。
                  </p>
                  <button
                    onClick={() => setTab('add')}
                    className="cp-btn cp-btn-primary mt-2"
                    style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44, padding: '0 18px' }}>
                    ＋ 最初の売上を手で 1 件入れる
                  </button>
                  <SampleDataCTA
                    accent={persona.accentColor}
                    label="✨ サンプルの売上で中を見てみる"
                    hint="カフェ田中さんの 12 ヶ月分の売上が入り、画面の使い方がすぐ分かります（あとで消せます）"
                  />
                </div>
              ) : personaEntries.map(e => (
                <div key={e.id} className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <div className="min-w-0 flex-1 grid grid-cols-12 gap-2 items-center text-xs">
                    <span className="col-span-2 text-fg-muted font-mono">{e.date}</span>
                    <span className="col-span-3 text-fg truncate">{e.clientName}</span>
                    <span className="col-span-3 text-fg-muted truncate">{e.subject}</span>
                    <span className="col-span-2 text-fg font-mono text-right">{fmtJpy(e.totalIncl)}</span>
                    <span className="col-span-1 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: e.status === 'paid' ? 'rgba(74,222,128,0.15)' : `${persona.accentColor}20`,
                          color: e.status === 'paid' ? '#4ADE80' : persona.accentColor,
                        }}>
                        {e.status === 'paid' ? '入金済' : e.status === 'partial' ? '一部' : '未入金'}
                      </span>
                    </span>
                    <span className="col-span-1 text-center">
                      <span className="text-[10px] text-fg-subtle">
                        {e.source === 'invoice' ? '請求書' : '手動'}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {e.status !== 'paid' && (
                      <button
                        onClick={() => ledger.markPaid(e.id)}
                        className="text-[10px] px-2 py-1 rounded text-fg-muted hover:text-fg"
                        style={{ background: 'var(--surface)' }}
                      >入金済</button>
                    )}
                    {e.source === 'manual' && (
                      <button
                        onClick={async () => { if (await confirmAction({ title: 'この売上を削除しますか?', tone: 'danger' })) ledger.removeEntry(e.id); }}
                        className="text-[10px] px-2 py-1 rounded text-fg-muted hover:text-red-400"
                        style={{ background: 'var(--surface)' }}
                      >削除</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'clients' && (
            <div className="space-y-2">
              {clients.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center gap-2">
                  <p className="text-4xl mb-1">🏷️</p>
                  <p className="text-fg text-sm font-semibold">「誰がいくら買ってくれたか」のランキングが出ます</p>
                  <p className="text-fg-muted text-xs max-w-[260px] leading-relaxed">
                    売上を登録すると、取引先ごとの合計金額が自動でまとまり、大切なお客さまがひと目で分かります。
                  </p>
                  <SampleDataCTA
                    accent={persona.accentColor}
                    label="✨ サンプルの取引先で中を見てみる"
                    hint="カフェ田中さんのお客さま一覧が入ります（あとで消せます）"
                  />
                </div>
              ) : clients.map((c, i) => (
                <div key={c.name} className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-fg text-sm font-medium">{c.name}</p>
                      <p className="text-fg-muted text-xs">{c.count}件の取引</p>
                    </div>
                  </div>
                  <p className="text-fg font-mono text-sm">{fmtJpy(c.totalIncl)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'add' && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg text-sm font-semibold">手動で売上を追加</p>
              <p className="text-fg-muted text-[11px]">請求書を発行しない直接売上 (現金売上・小口売上等) はこちらから</p>

              <div className="grid grid-cols-2 gap-2">
                <Field label="取引日">
                  <input type="date" value={m_date} onChange={e => setMDate(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="取引先 *">
                  <input value={m_clientName} onChange={e => setMClientName(e.target.value)}
                    placeholder="例: 個人A様"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="件名・摘要" full>
                  <input value={m_subject} onChange={e => setMSubject(e.target.value)}
                    placeholder="例: コンサルティング 1時間"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
                <Field label="金額 (税抜) *">
                  <input value={m_amount} onChange={e => setMAmount(e.target.value)}
                    placeholder="100000"
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg font-mono text-right" />
                </Field>
                <Field label="税率">
                  <select value={m_taxRate} onChange={e => setMTaxRate(Number(e.target.value) as 10 | 8 | 0)}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg">
                    <option value={10}>10%</option>
                    <option value={8}>軽減 8%</option>
                    <option value={0}>非課税</option>
                  </select>
                </Field>
                <Field label="入金状況">
                  <select value={m_status} onChange={e => setMStatus(e.target.value as SalesEntry['status'])}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg">
                    <option value="paid">入金済</option>
                    <option value="unpaid">未入金</option>
                    <option value="partial">一部入金</option>
                  </select>
                </Field>
                {m_status === 'paid' && (
                  <Field label="入金日">
                    <input type="date" value={m_paidDate} onChange={e => setMPaidDate(e.target.value)}
                      className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                  </Field>
                )}
                <Field label="備考" full>
                  <input value={m_notes} onChange={e => setMNotes(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg" />
                </Field>
              </div>

              {m_error && (
                <div className="rounded-md p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                  {m_error}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleAdd}
                  className="text-sm px-5 py-2 rounded-lg font-semibold"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                >＋ 売上に追加</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummaryCard({ title, summary, color }: { title: string; summary: ReturnType<typeof summarizeMonth>; color: string }) {
  return (
    <motion.div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', transition: 'box-shadow 0.2s ease' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: `0 12px 26px ${color}26` }}
    >
      <p className="text-fg-muted text-[10px] tracking-wider uppercase mb-2">{title}</p>
      <CountUp className="text-fg text-2xl font-mono font-light" value={summary.totalIncl} format={fmtJpy} />
      <p className="text-fg-muted text-xs mt-1">税抜 {fmtJpy(summary.totalExcl)} · 消費税 {fmtJpy(summary.totalTax)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded p-2" style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.25)' }}>
          <p className="text-[10px] text-fg-muted">入金済</p>
          <CountUp className="font-mono" style={{ color: '#4ADE80' }} value={summary.paidIncl} format={fmtJpy} />
        </div>
        <div className="rounded p-2" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
          <p className="text-[10px] text-fg-muted">未入金</p>
          <CountUp className="font-mono" style={{ color }} value={summary.unpaidIncl} format={fmtJpy} />
        </div>
      </div>
      <p className="text-[10px] text-fg-subtle mt-2">{summary.count}件</p>
    </motion.div>
  );
}

function MonthlyChart({ series, color }: { series: ReturnType<typeof monthlySeries>; color: string }) {
  const max = Math.max(...series.map(s => s.totalIncl), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {series.map((s, i) => {
        const h = (s.totalIncl / max) * 100;
        const paidH = (s.paidIncl / max) * 100;
        return (
          <div key={s.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <motion.div
              className="w-full flex flex-col-reverse items-stretch h-24"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.55, delay: 0.25 + i * 0.045, ease: [0.34, 1.2, 0.64, 1] }}
              style={{ transformOrigin: 'bottom' }}
              whileHover={{ scaleY: 1.04 }}
            >
              <div
                className="w-full rounded-sm"
                style={{ background: color, height: `${paidH}%`, minHeight: paidH > 0 ? '2px' : 0, boxShadow: paidH > 0 ? `0 0 8px ${color}66` : 'none' }}
                title={`入金済 ${fmtJpy(s.paidIncl)}`}
              />
              <div
                className="w-full rounded-sm"
                style={{ background: `${color}40`, height: `${h - paidH}%`, minHeight: 0 }}
                title={`未入金 ${fmtJpy(s.totalIncl - s.paidIncl)}`}
              />
            </motion.div>
            <p className="text-[9px] text-fg-subtle font-mono">{s.label.slice(5)}</p>
          </div>
        );
      })}
    </div>
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
