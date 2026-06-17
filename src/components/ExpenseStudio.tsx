import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { ExpenseCategory, ExpenseEntry, ExpenseTaxRate } from '../types/expense';
import { EXPENSE_CATEGORIES } from '../types/expense';
import { useExpenses } from '../hooks/useExpenses';
import { extractFromReceipt, refineExpenseClassification, fileToDataUrl, calcExpenseAmounts } from '../lib/expenseOCR';
import { fmtJpy } from '../lib/invoiceCalc';
import AgentProposalCard from './AgentProposalCard';
import EmptyState from './EmptyState';
import { StudioIntro } from './StudioIntro';
import DelegateToAgentTeamBanner from './DelegateToAgentTeamBanner';
import { useCelebrate } from '../hooks/useCelebrate';
import { confirmAction } from '../lib/confirmDialog';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = 'ocr' | 'list' | 'manual' | 'summary';

export default function ExpenseStudio({ persona, settings, onClose }: Props) {
  const { celebrate, CelebratePortal } = useCelebrate();
  const exp = useExpenses();
  const personaEntries = useMemo(() => exp.getForPersona(persona.id), [exp.entries, persona.id]);
  const [tab, setTab] = useState<Tab>('ocr');

  // ─── OCR タブ ─────────────
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [refineBusy, setRefineBusy] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const ocrFormRef = useRef<HTMLDivElement>(null);

  // 編集中エントリ (OCR or 手動)
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<Partial<ExpenseEntry>>({
    date: today,
    vendor: '',
    category: '会議費',
    description: '',
    amountIncl: 0,
    taxRate: 10,
    payment: 'card',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setOcrError(null);
    const dataUrl = await fileToDataUrl(file);
    setOcrPreview(dataUrl);
    setOcrBusy(true);
    try {
      const result = await extractFromReceipt({ settings, imageDataUrl: dataUrl });
      setDraft(prev => ({
        ...prev,
        date: result.date || prev.date,
        vendor: result.vendor || prev.vendor,
        amountIncl: result.amountIncl ?? prev.amountIncl,
        taxRate: result.taxRate ?? prev.taxRate,
        category: result.category || prev.category,
        description: result.description || prev.description,
        receiptDataUrl: dataUrl,
      }));
      // フォームへスクロール
      setTimeout(() => ocrFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcrBusy(false);
    }
  }, [settings]);

  // 先回り提案カードの「✏️ 直す」: 1 行指示で AI が仕訳を直す
  const handleRefine = useCallback(async (instruction: string) => {
    setRefineBusy(true);
    setOcrError(null);
    try {
      const fixed = await refineExpenseClassification({
        settings,
        current: {
          date: draft.date,
          vendor: draft.vendor,
          amountIncl: draft.amountIncl,
          taxRate: draft.taxRate as ExpenseTaxRate,
          category: draft.category as ExpenseCategory,
          description: draft.description,
        },
        instruction,
      });
      setDraft(prev => ({ ...prev, ...fixed }));
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefineBusy(false);
    }
  }, [settings, draft]);

  // 先回り提案カードの「✗ 却下」: 読取結果を破棄
  const handleDismissProposal = useCallback(() => {
    setDraft({ date: today, vendor: '', category: '会議費', description: '', amountIncl: 0, taxRate: 10, payment: 'card' });
    setOcrPreview(null); setOcrError(null); setShowDetail(false);
  }, [today]);

  const handleSave = useCallback((source: 'ocr' | 'manual') => {
    if (!draft.vendor?.trim() || !draft.amountIncl || draft.amountIncl <= 0) {
      setOcrError('店舗名と税込金額を入力してください');
      return;
    }
    const taxRate = (draft.taxRate || 10) as ExpenseTaxRate;
    const { amountExcl, taxAmount } = calcExpenseAmounts(draft.amountIncl, taxRate);
    exp.add({
      personaId: persona.id,
      date: draft.date || today,
      vendor: draft.vendor,
      category: (draft.category || 'その他') as ExpenseCategory,
      description: draft.description,
      amountIncl: draft.amountIncl,
      taxRate,
      amountExcl,
      taxAmount,
      payment: draft.payment || 'card',
      receiptDataUrl: source === 'ocr' ? draft.receiptDataUrl : undefined,
      notes: draft.notes,
      source,
    });
    // リセット
    setDraft({ date: today, vendor: '', category: '会議費', description: '', amountIncl: 0, taxRate: 10, payment: 'card' });
    setOcrPreview(null); setOcrError(null); setShowDetail(false);
    setTab('list');
    celebrate({ message: 'レシートを登録しました' });
  }, [draft, exp, persona.id, today, celebrate]);

  const handleRemove = async (id: string) => {
    if (await confirmAction({ title: 'この経費を削除しますか?', tone: 'danger' })) exp.remove(id);
  };

  // ─── サマリ ─────────────
  const summary = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    const filtered = personaEntries.filter(e => e.date.startsWith(thisMonth));
    const total = filtered.reduce((s, e) => s + e.amountIncl, 0);
    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of filtered) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amountIncl);
    }
    const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    return { thisMonth, count: filtered.length, total, ranked };
  }, [personaEntries, today]);

  // 先回り提案カードに出す「仕訳案」テキスト
  const proposalDraftText = useMemo(() => {
    const tr = (draft.taxRate || 10) as ExpenseTaxRate;
    const { amountExcl, taxAmount } = calcExpenseAmounts(draft.amountIncl || 0, tr);
    const cat = EXPENSE_CATEGORIES.find(c => c.value === draft.category);
    return [
      `日付　${draft.date || '—'}`,
      `店舗　${draft.vendor || '—'}`,
      `科目　${cat?.emoji || ''} ${draft.category || 'その他'}`,
      `金額　${fmtJpy(draft.amountIncl || 0)}（税抜 ${fmtJpy(amountExcl)} ／ 税${tr}% ${fmtJpy(taxAmount)}）`,
      `摘要　${draft.description || '—'}`,
    ].join('\n');
  }, [draft]);

  const handleExportCsv = () => {
    const headers = ['日付', '店舗', '科目', '摘要', '税抜', '税率', '税額', '税込', '支払方法', 'ソース'];
    const rows = personaEntries.map(e => [
      e.date, e.vendor, e.category, e.description || '',
      e.amountExcl, `${e.taxRate}%`, e.taxAmount, e.amountIncl,
      e.payment || '', e.source,
    ]);
    const escape = (v: any) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `経費_${persona.name}_${summary.thisMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    {CelebratePortal}
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '900px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >📷</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">経費管理</p>
              <p className="cp-meta truncate">{persona.name} · レシート OCR で撮影即仕訳</p>
            </div>
          </div>
          <div className="cp-row">
            <button onClick={handleExportCsv} disabled={personaEntries.length === 0}
              className="cp-btn cp-btn-sm">⬇ CSV</button>
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm" aria-label="閉じる">✕</button>
          </div>
        </div>

        <DelegateToAgentTeamBanner
          taskTitle="今月の経費を CFO が分類 + 異常検知"
          suggestedCxos={['CFO', 'CDS']}
          why="月末に慌てないよう、AI 会社がレシートを科目別に整え異常値も洗います"
          expected="科目別集計 + 異常値リストつきの月次まとめ"
        />

        {/* Tabs */}
        <div className="cp-modal-tabs">
          {([
            { id: 'ocr' as Tab,    label: '📷 レシート読込' },
            { id: 'manual' as Tab, label: '✍ 手動入力' },
            { id: 'list' as Tab,   label: `🗂 一覧 (${personaEntries.length})` },
            { id: 'summary' as Tab,label: '📊 月次サマリ' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="cp-modal-tab" data-active={tab === t.id}
              style={{ color: tab === t.id ? persona.accentColor : undefined }}
            >{t.label}</button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          <StudioIntro
            id="expense"
            accent={persona.accentColor}
            iconKey="expense"
            what="レシートを撮るだけで、店名・金額・勘定科目をAIが読み取って経費に登録する画面です。"
            tryThis="下の枠にレシート写真を 1 枚アップロードしてみます。"
            example="コンビニのレシート → 「消耗品費 480円」と自動で仕訳されて一覧に追加。"
            sampleLabel="出来上がりイメージ"
            samplePreview={
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 140 }}>
                {/* 左: レシート写真の縮小 */}
                <div
                  style={{
                    width: 36,
                    height: 56,
                    background: 'linear-gradient(180deg, #fafaf5 0%, #f3f0e7 100%)',
                    borderRadius: 3,
                    padding: '4px 3px',
                    fontSize: 4,
                    lineHeight: 1.3,
                    color: '#3a3a2e',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    fontFamily: 'monospace',
                    transform: 'rotate(-3deg)',
                    flexShrink: 0,
                    border: '1px solid #e8e3d5',
                  }}
                  aria-label="レシート写真"
                >
                  <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 2 }}>セブン</div>
                  <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '1px 0', marginBottom: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>コピー</span><span>320</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ペン</span><span>160</span></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>合計</span><span>480</span>
                  </div>
                </div>
                {/* 矢印 */}
                <span style={{ color: persona.accentColor, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>→</span>
                {/* 右: 仕訳 1 行 */}
                <div
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    color: '#0f172a',
                    borderRadius: 5,
                    padding: '6px 7px',
                    fontSize: 7,
                    lineHeight: 1.4,
                    boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    borderLeft: `3px solid ${persona.accentColor}`,
                    minWidth: 70,
                  }}
                  aria-label="仕訳 1 行"
                >
                  <div style={{ fontSize: 5, color: persona.accentColor, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 1 }}>
                    AI 仕訳済み
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 1 }}>セブン-イレブン</div>
                  <div style={{ opacity: 0.7, fontSize: 6, marginBottom: 2 }}>消耗品費 · 課税10%</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ opacity: 0.6, fontSize: 6 }}>5/22</span>
                    <strong style={{ color: persona.accentColor, fontSize: 9 }}>¥480</strong>
                  </div>
                </div>
              </div>
            }
          />
          {tab === 'ocr' && (
            <>
              {/* ファイル UP */}
              <div className="cp-card-section text-center" style={{ borderStyle: 'dashed', borderColor: persona.accentColor + '60' }}>
                <p className="text-3xl mb-2">📷</p>
                <p className="cp-h3">レシート画像をアップロード</p>
                <p className="cp-meta mt-1">JPG / PNG / HEIC · AI が自動で店舗・金額・科目を読み取ります</p>
                <input
                  ref={fileInputRef}
                  type="file" accept="image/*" capture="environment"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <button onClick={() => fileInputRef.current?.click()} className="cp-btn cp-btn-primary mt-3"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  画像を選択 / 撮影
                </button>
              </div>

              {ocrBusy && (
                <div className="cp-card text-center">
                  <p className="cp-body">🧠 AI がレシートを読み取り中...</p>
                </div>
              )}

              <ApiErrorCard error={ocrError} />
              <AILoadingState
                active={ocrBusy}
                label="レシートを読み取り中"
                stages={['画像を解析', '店名・日付・金額を抽出', '勘定科目を推測', '入力を整形']}
                brand="prism"
                skeletonLines={4}
              />

              {/* AI 先回り提案カード */}
              {(ocrPreview || (draft.amountIncl ?? 0) > 0) && !ocrBusy && (
                <div ref={ocrFormRef} className="cp-stack-sm">
                  <AgentProposalCard
                    icon="📷"
                    title={draft.vendor || 'レシート読取結果'}
                    reason="レシートを読みました — この経費、こう仕訳しましょうか?"
                    accentColor={persona.accentColor}
                    draft={proposalDraftText}
                    meta="「✏️ 直す」に 1 行書くと AI が仕訳を直します (例: 科目を交際費に / 金額1500)"
                    approveLabel="✓ 承認して経費に追加"
                    busy={refineBusy}
                    onApprove={() => handleSave('ocr')}
                    onRefine={handleRefine}
                    onDismiss={handleDismissProposal}
                  />
                  <div className="cp-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setShowDetail(s => !s)} className="cp-btn cp-btn-ghost cp-btn-sm">
                      {showDetail ? '▲ 詳細フォームを閉じる' : '▼ 自分で細かく直す'}
                    </button>
                    {ocrPreview && (
                      <a href={ocrPreview} target="_blank" rel="noopener noreferrer" className="cp-tiny hover:opacity-70">レシート画像を見る ↗</a>
                    )}
                  </div>
                </div>
              )}

              {/* 詳細フォーム (任意) */}
              {showDetail && (ocrPreview || (draft.amountIncl ?? 0) > 0) && (
                <div className="cp-card-section cp-stack">
                  <p className="cp-h3">細かく直す</p>
                  <div className="cp-grid-2">
                    <div>
                      <label className="cp-label">日付</label>
                      <input type="date" value={draft.date || ''} onChange={e => setDraft({ ...draft, date: e.target.value })} className="cp-input" />
                    </div>
                    <div>
                      <label className="cp-label">店舗 *</label>
                      <input value={draft.vendor || ''} onChange={e => setDraft({ ...draft, vendor: e.target.value })} placeholder="店舗名" className="cp-input" />
                    </div>
                    <div>
                      <label className="cp-label">科目</label>
                      <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as ExpenseCategory })} className="cp-select">
                        {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cp-label">税込金額 *</label>
                      <input type="number" value={draft.amountIncl || ''} onChange={e => setDraft({ ...draft, amountIncl: Number(e.target.value) })} className="cp-input" placeholder="0" />
                    </div>
                    <div>
                      <label className="cp-label">税率</label>
                      <select value={draft.taxRate} onChange={e => setDraft({ ...draft, taxRate: Number(e.target.value) as ExpenseTaxRate })} className="cp-select">
                        <option value={10}>10%</option>
                        <option value={8}>軽減 8%</option>
                        <option value={0}>非課税</option>
                      </select>
                    </div>
                    <div>
                      <label className="cp-label">支払方法</label>
                      <select value={draft.payment} onChange={e => setDraft({ ...draft, payment: e.target.value as ExpenseEntry['payment'] })} className="cp-select">
                        <option value="card">カード</option>
                        <option value="cash">現金</option>
                        <option value="bank">銀行振込</option>
                        <option value="paypay">電子マネー</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="cp-label">摘要</label>
                    <input value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="例: 取引先打ち合わせ コーヒー2杯" className="cp-input" />
                  </div>
                  <div className="cp-row-between">
                    <p className="cp-meta">
                      税抜 <strong className="text-fg">{fmtJpy(calcExpenseAmounts(draft.amountIncl || 0, (draft.taxRate || 10) as ExpenseTaxRate).amountExcl)}</strong>
                      ・税額 <strong className="text-fg">{fmtJpy(calcExpenseAmounts(draft.amountIncl || 0, (draft.taxRate || 10) as ExpenseTaxRate).taxAmount)}</strong>
                    </p>
                    <button onClick={() => handleSave('ocr')} className="cp-btn cp-btn-primary"
                      style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                      経費に追加
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'manual' && (
            <div className="cp-card-section cp-stack">
              <p className="cp-h3">手動で経費を入力</p>
              <div className="cp-grid-2">
                <div>
                  <label className="cp-label">日付</label>
                  <input type="date" value={draft.date || today} onChange={e => setDraft({ ...draft, date: e.target.value })} className="cp-input" />
                </div>
                <div>
                  <label className="cp-label">店舗 *</label>
                  <input value={draft.vendor || ''} onChange={e => setDraft({ ...draft, vendor: e.target.value })} placeholder="例: スターバックス 550 円 打合せ" className="cp-input" />
                </div>
                <div>
                  <label className="cp-label">科目</label>
                  <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as ExpenseCategory })} className="cp-select">
                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cp-label">税込金額 *</label>
                  <input type="number" value={draft.amountIncl || ''} onChange={e => setDraft({ ...draft, amountIncl: Number(e.target.value) })} className="cp-input" placeholder="0" />
                </div>
                <div>
                  <label className="cp-label">税率</label>
                  <select value={draft.taxRate} onChange={e => setDraft({ ...draft, taxRate: Number(e.target.value) as ExpenseTaxRate })} className="cp-select">
                    <option value={10}>10%</option>
                    <option value={8}>軽減 8%</option>
                    <option value={0}>非課税</option>
                  </select>
                </div>
                <div>
                  <label className="cp-label">支払方法</label>
                  <select value={draft.payment} onChange={e => setDraft({ ...draft, payment: e.target.value as ExpenseEntry['payment'] })} className="cp-select">
                    <option value="card">カード</option>
                    <option value="cash">現金</option>
                    <option value="bank">銀行振込</option>
                    <option value="paypay">電子マネー</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="cp-label">摘要</label>
                <input value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} className="cp-input" />
              </div>
              {ocrError && <p className="cp-meta" style={{ color: '#f87171' }}>{ocrError}</p>}
              <div className="cp-row-between">
                <p className="cp-meta">
                  税抜 <strong className="text-fg">{fmtJpy(calcExpenseAmounts(draft.amountIncl || 0, (draft.taxRate || 10) as ExpenseTaxRate).amountExcl)}</strong>
                  ・税額 <strong className="text-fg">{fmtJpy(calcExpenseAmounts(draft.amountIncl || 0, (draft.taxRate || 10) as ExpenseTaxRate).taxAmount)}</strong>
                </p>
                <button onClick={() => handleSave('manual')} className="cp-btn cp-btn-primary"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  経費に追加
                </button>
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div className="cp-stack-sm">
              {personaEntries.length === 0 ? (
                <EmptyState
                  icon="🧾"
                  title="今月のレシートはまだ 0 枚"
                  description={'スマホで撮るだけ、AI が日付・金額・科目を自動で読み取ります。\n月末のまとめも自動。確定申告も「ボタンひとつ」を目指してます。'}
                  ctaLabel="レシートを撮る / 取り込む"
                  onCta={() => setTab('ocr')}
                  accent={persona.accentColor}
                  preview="📷 セブン-イレブン　2026-05-25　¥430　会議費 (打合せ用コーヒー)"
                />
              ) : personaEntries.map(e => {
                const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category);
                return (
                  <div key={e.id} className="cp-card cp-row-between">
                    <div className="cp-row min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: (cat?.color || '#888') + '20', color: cat?.color || '#888' }}>
                        {cat?.emoji || '📌'}
                      </div>
                      <div className="min-w-0">
                        <p className="cp-h3 truncate">{e.vendor}</p>
                        <p className="cp-meta truncate">
                          <span className="font-mono">{e.date}</span> · {e.category}
                          {e.description && ` · ${e.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="cp-row" style={{ flexShrink: 0 }}>
                      <span className="font-mono text-fg">{fmtJpy(e.amountIncl)}</span>
                      {e.source === 'ocr' && <span className="cp-pill" style={{ color: persona.accentColor, borderColor: persona.accentColor + '50' }}>OCR</span>}
                      <button onClick={() => handleRemove(e.id)} className="cp-btn cp-btn-ghost cp-btn-sm" aria-label="削除">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'summary' && (
            <div className="cp-stack">
              <div className="cp-card">
                <p className="cp-section-head">{summary.thisMonth} の経費合計</p>
                <p className="text-fg" style={{ fontSize: '1.6rem', fontWeight: 600, fontFamily: 'monospace' }}>
                  {fmtJpy(summary.total)}
                </p>
                <p className="cp-meta">{summary.count}件 · この人格の今月分</p>
              </div>

              {summary.ranked.length > 0 && (
                <div className="cp-card-section cp-stack-sm">
                  <p className="cp-h3">科目別</p>
                  {summary.ranked.map(([cat, amt]) => {
                    const meta = EXPENSE_CATEGORIES.find(c => c.value === cat);
                    const pct = summary.total > 0 ? (amt / summary.total) * 100 : 0;
                    return (
                      <div key={cat} className="cp-stack-sm" style={{ gap: 4 }}>
                        <div className="cp-row-between">
                          <span className="text-fg">
                            <span className="mr-1">{meta?.emoji}</span>{cat}
                          </span>
                          <span className="font-mono cp-meta">
                            {fmtJpy(amt)} <span className="cp-tiny">{pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta?.color || '#888' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
    </>
  );
}
