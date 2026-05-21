import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { CRMDeal, CRMStage } from '../types/crm';
import { STAGE_META, STAGE_ORDER } from '../types/crm';
import { useCRM } from '../hooks/useCRM';
import SampleDataCTA from './SampleDataCTA';
import { StudioIntro } from './StudioIntro';
import { useInvoices } from '../hooks/useInvoices';
import { fmtJpy, computeTotals } from '../lib/invoiceCalc';
import type { BusinessDocument } from '../types/invoice';
import { confirmAction } from '../lib/confirmDialog';

interface Props {
  persona: Persona;
  onClose: () => void;
}

type View = 'kanban' | 'list' | 'summary';

export default function CRMStudio({ persona, onClose }: Props) {
  const crm = useCRM();
  const dealsAll = useMemo(() => crm.getForPersona(persona.id), [crm.deals, persona.id]);
  const [view, setView] = useState<View>('kanban');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => dealsAll.find(d => d.id === editingId) || null, [dealsAll, editingId]);

  const summary = useMemo(() => {
    const open = dealsAll.filter(d => d.stage !== 'won' && d.stage !== 'lost');
    const won = dealsAll.filter(d => d.stage === 'won');
    const lost = dealsAll.filter(d => d.stage === 'lost');
    const pipelineValue = open.reduce((s, d) => s + (d.amount || 0), 0);
    const weightedValue = open.reduce((s, d) => s + ((d.amount || 0) * (d.probability ?? 30) / 100), 0);
    const wonValue = won.reduce((s, d) => s + (d.amount || 0), 0);
    return { open: open.length, won: won.length, lost: lost.length, pipelineValue, weightedValue, wonValue };
  }, [dealsAll]);

  const handleNewDeal = (stage: CRMStage = 'lead') => {
    const d = crm.createDeal(persona.id, { title: '新規案件', stage });
    setEditingId(d.id);
  };

  const dealsByStage = useMemo(() => {
    const map: Record<CRMStage, CRMDeal[]> = {
      lead: [], qualified: [], proposal: [], negotiation: [], won: [], lost: [],
    };
    for (const d of dealsAll) map[d.stage].push(d);
    return map;
  }, [dealsAll]);

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1200px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>🤝</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">CRM パイプライン</p>
              <p className="cp-meta truncate">{persona.name} · 案件のステージ管理 + 活動履歴</p>
            </div>
          </div>
          <div className="cp-row">
            <button onClick={() => handleNewDeal()} className="cp-btn cp-btn-primary cp-btn-sm"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}>＋ 案件追加</button>
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
          </div>
        </div>

        <div className="cp-modal-tabs">
          {([
            { id: 'kanban' as View, label: '🗂 カンバン' },
            { id: 'list' as View,   label: `📋 リスト (${dealsAll.length})` },
            { id: 'summary' as View,label: '📊 サマリ' },
          ]).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="cp-modal-tab" data-active={view === t.id}
              style={{ color: view === t.id ? persona.accentColor : undefined }}
            >{t.label}</button>
          ))}
        </div>

        <div className="cp-modal-body">
          <StudioIntro
            id="crm"
            accent={persona.accentColor}
            emoji="🤝"
            what="商談がいま どこまで進んでいるか を一覧で見える画面です。"
            tryThis="右上の「＋ 案件追加」で、追いかけたい商談を 1 件登録します。"
            example="「A社サイト制作」を“提案中”に置く → 受注できたら“受注”の列へドラッグ。"
          />
          {view === 'kanban' && (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '500px' }}>
              {STAGE_ORDER.map(stage => {
                const meta = STAGE_META[stage];
                const dealsHere = dealsByStage[stage];
                return (
                  <div key={stage} className="flex-shrink-0" style={{ width: '240px' }}>
                    <div className="cp-row-between mb-2">
                      <div className="cp-row" style={{ gap: 6 }}>
                        <span className="text-base">{meta.emoji}</span>
                        <span className="cp-h3" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="cp-meta">{dealsHere.length}</span>
                      </div>
                      {stage === 'lead' && (
                        <button onClick={() => handleNewDeal('lead')} className="cp-btn cp-btn-ghost cp-btn-sm" title="この列に追加">＋</button>
                      )}
                    </div>
                    <div className="rounded-lg p-2 cp-stack-sm" style={{ background: meta.color + '0F', border: `1px dashed ${meta.color}40`, minHeight: '420px' }}>
                      {dealsHere.length === 0 && (
                        <p className="cp-tiny text-center py-6">{meta.label}なし</p>
                      )}
                      {dealsHere.map(d => (
                        <button key={d.id} onClick={() => setEditingId(d.id)}
                          className="cp-card text-left w-full transition-all hover:scale-[1.01]"
                          style={{ borderColor: meta.color + '50', background: 'var(--surface)' }}>
                          <p className="cp-h3 truncate">{d.title}</p>
                          {d.contact?.name && <p className="cp-meta truncate">{d.contact.name}{d.contact.company && ` · ${d.contact.company}`}</p>}
                          <div className="cp-row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
                            {d.amount && <span className="cp-pill" style={{ color: meta.color, borderColor: meta.color + '40' }}>{fmtJpy(d.amount)}</span>}
                            {d.probability != null && d.stage !== 'won' && d.stage !== 'lost' && (
                              <span className="cp-pill">{d.probability}%</span>
                            )}
                            {d.expectedCloseDate && <span className="cp-tiny" style={{ textTransform: 'none' }}>{d.expectedCloseDate}</span>}
                          </div>
                          {d.activities.length > 0 && (
                            <p className="cp-tiny mt-1" style={{ textTransform: 'none' }}>{d.activities.length}件の活動</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'list' && (
            <div className="cp-stack-sm">
              {dealsAll.length === 0 ? (
                <div className="cp-empty">
                  <p className="cp-empty-icon">📭</p>
                  <p>案件がまだありません</p>
                  <SampleDataCTA accent={persona.accentColor} hint="サンプル案件が入り、商談の流れをすぐ試せます" />
                </div>
              ) : dealsAll.map(d => {
                const meta = STAGE_META[d.stage];
                return (
                  <button key={d.id} onClick={() => setEditingId(d.id)}
                    className="cp-card text-left w-full cp-row-between">
                    <div className="cp-row min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: meta.color + '20', color: meta.color }}>{meta.emoji}</div>
                      <div className="min-w-0">
                        <p className="cp-h3 truncate">{d.title}</p>
                        <p className="cp-meta truncate">
                          {d.contact?.name || '連絡先未設定'}
                          {d.contact?.company && ` · ${d.contact.company}`}
                        </p>
                      </div>
                    </div>
                    <div className="cp-row flex-shrink-0">
                      <span className="cp-pill" style={{ color: meta.color, borderColor: meta.color + '50' }}>{meta.label}</span>
                      {d.amount && <span className="font-mono cp-meta">{fmtJpy(d.amount)}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {view === 'summary' && (
            <div className="cp-stack">
              <div className="cp-grid-2">
                <div className="cp-card">
                  <p className="cp-section-head">パイプライン総額</p>
                  <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {fmtJpy(summary.pipelineValue)}
                  </p>
                  <p className="cp-meta">{summary.open}件の進行中案件</p>
                </div>
                <div className="cp-card">
                  <p className="cp-section-head">確度加重 (Weighted)</p>
                  <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'monospace', color: persona.accentColor }}>
                    {fmtJpy(summary.weightedValue)}
                  </p>
                  <p className="cp-meta">確度を加味した期待値</p>
                </div>
                <div className="cp-card">
                  <p className="cp-section-head">受注済み</p>
                  <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'monospace', color: '#4ADE80' }}>
                    {fmtJpy(summary.wonValue)}
                  </p>
                  <p className="cp-meta">{summary.won}件 受注</p>
                </div>
                <div className="cp-card">
                  <p className="cp-section-head">勝率</p>
                  <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                    {summary.won + summary.lost === 0 ? '—' : `${Math.round(summary.won / (summary.won + summary.lost) * 100)}%`}
                  </p>
                  <p className="cp-meta">{summary.won + summary.lost}件のクローズ案件中</p>
                </div>
              </div>

              {/* ステージ別件数 */}
              <div className="cp-card-section cp-stack-sm">
                <p className="cp-h3">ステージ別件数</p>
                {STAGE_ORDER.map(stage => {
                  const meta = STAGE_META[stage];
                  const count = dealsByStage[stage].length;
                  const pct = dealsAll.length > 0 ? (count / dealsAll.length) * 100 : 0;
                  return (
                    <div key={stage}>
                      <div className="cp-row-between" style={{ gap: 8 }}>
                        <span className="text-fg"><span className="mr-1">{meta.emoji}</span>{meta.label}</span>
                        <span className="cp-meta font-mono">{count}件 <span className="cp-tiny">{pct.toFixed(0)}%</span></span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 案件編集モーダル */}
      <AnimatePresence>
        {editing && (
          <DealEditorWithDocs key={editing.id}
            persona={persona} deal={editing}
            onClose={() => setEditingId(null)}
            onUpdate={(patch) => crm.updateDeal(editing.id, patch)}
            onDelete={async () => { if (await confirmAction({ title: 'この案件を削除しますか?', tone: 'danger' })) { crm.removeDeal(editing.id); setEditingId(null); } }}
            onAddActivity={(a) => crm.addActivity(editing.id, a)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const DOC_KIND_LABEL: Record<string, string> = { estimate: '📋 見積書', order: '📦 発注書', delivery: '🚚 納品書', invoice: '🧾 請求書' };
const DOC_STATUS_LABEL: Record<string, string> = { draft: '下書き', sent: '送付済', approved: '承認済', delivered: '納品済', paid: '支払済', cancelled: '取消' };

function DealEditorWithDocs(props: {
  persona: Persona;
  deal: CRMDeal;
  onClose: () => void;
  onUpdate: (patch: Partial<CRMDeal>) => void;
  onDelete: () => void;
  onAddActivity: (a: { date: string; type: 'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice'; summary: string }) => void;
}) {
  const inv = useInvoices();
  const relatedDocs = useMemo(() => inv.getDocumentsForDeal(props.deal.id), [inv.documents, props.deal.id]);
  return <DealEditor {...props} relatedDocs={relatedDocs} />;
}

function DealEditor({ persona, deal, onClose, onUpdate, onDelete, onAddActivity, relatedDocs }: {
  persona: Persona;
  deal: CRMDeal;
  onClose: () => void;
  onUpdate: (patch: Partial<CRMDeal>) => void;
  onDelete: () => void;
  onAddActivity: (a: { date: string; type: 'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice'; summary: string }) => void;
  relatedDocs?: BusinessDocument[];
}) {
  const [actType, setActType] = useState<'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice'>('note');
  const [actSummary, setActSummary] = useState('');

  const ACT_LABEL: Record<string, string> = {
    meeting: '🤝 商談', email: '📧 メール', call: '📞 電話',
    note: '📝 メモ', proposal: '📋 提案', invoice: '🧾 請求',
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '600px' }}
        initial={{ scale: 0.97 }} animate={{ scale: 1 }} exit={{ scale: 0.97 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <p className="cp-h2">案件詳細</p>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>
        <div className="cp-modal-body cp-stack">
          <div>
            <label className="cp-label">案件名</label>
            <input value={deal.title} onChange={e => onUpdate({ title: e.target.value })} className="cp-input" />
          </div>

          <div className="cp-grid-2">
            <div>
              <label className="cp-label">ステージ</label>
              <select value={deal.stage} onChange={e => onUpdate({ stage: e.target.value as CRMStage })} className="cp-select">
                {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_META[s].emoji} {STAGE_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="cp-label">想定金額 (円)</label>
              <input type="number" value={deal.amount || 0} onChange={e => onUpdate({ amount: Number(e.target.value) })} className="cp-input" />
            </div>
            <div>
              <label className="cp-label">受注確度 ({deal.probability ?? 30}%)</label>
              <input type="range" min={0} max={100} step={5}
                value={deal.probability ?? 30}
                onChange={e => onUpdate({ probability: Number(e.target.value) })}
                style={{ width: '100%', accentColor: persona.accentColor }} />
            </div>
            <div>
              <label className="cp-label">想定クローズ日</label>
              <input type="date" value={deal.expectedCloseDate || ''} onChange={e => onUpdate({ expectedCloseDate: e.target.value })} className="cp-input" />
            </div>
          </div>

          {/* 連絡先 */}
          <div className="cp-card-section cp-stack-sm">
            <p className="cp-h3">連絡先</p>
            <div className="cp-grid-2">
              <input placeholder="氏名" value={deal.contact?.name || ''}
                onChange={e => onUpdate({ contact: { ...(deal.contact || { id: '' }), name: e.target.value } })}
                className="cp-input" />
              <input placeholder="会社名" value={deal.contact?.company || ''}
                onChange={e => onUpdate({ contact: { ...(deal.contact || { id: '', name: '' }), company: e.target.value } })}
                className="cp-input" />
              <input placeholder="役職" value={deal.contact?.title || ''}
                onChange={e => onUpdate({ contact: { ...(deal.contact || { id: '', name: '' }), title: e.target.value } })}
                className="cp-input" />
              <input placeholder="メール" value={deal.contact?.email || ''}
                onChange={e => onUpdate({ contact: { ...(deal.contact || { id: '', name: '' }), email: e.target.value } })}
                className="cp-input" />
            </div>
          </div>

          <div>
            <label className="cp-label">案件メモ</label>
            <textarea value={deal.description || ''} onChange={e => onUpdate({ description: e.target.value })} className="cp-textarea" rows={3} />
          </div>

          {/* 活動履歴 */}
          <div className="cp-card-section cp-stack-sm">
            <p className="cp-h3">活動履歴 ({deal.activities.length})</p>
            <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {(['meeting', 'email', 'call', 'note', 'proposal', 'invoice'] as const).map(t => (
                <button key={t} onClick={() => setActType(t)}
                  className="cp-btn cp-btn-sm"
                  style={actType === t ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' } : {}}>
                  {ACT_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="cp-row">
              <input value={actSummary} onChange={e => setActSummary(e.target.value)}
                placeholder="例: 価格について最終調整。来週水曜にクローズ予定" className="cp-input" />
              <button onClick={() => {
                if (!actSummary.trim()) return;
                onAddActivity({ date: new Date().toISOString().slice(0, 10), type: actType, summary: actSummary });
                setActSummary('');
              }} className="cp-btn cp-btn-primary"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}>追加</button>
            </div>
            <div className="cp-stack-sm mt-2">
              {deal.activities.slice(0, 8).map(a => (
                <div key={a.id} className="cp-row" style={{ alignItems: 'flex-start' }}>
                  <span className="cp-meta font-mono flex-shrink-0">{a.date}</span>
                  <span className="cp-pill flex-shrink-0">{ACT_LABEL[a.type]}</span>
                  <span className="cp-body flex-1">{a.summary}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 関連文書 */}
          {relatedDocs && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">関連文書 ({relatedDocs.length})</p>
              {relatedDocs.length === 0 ? (
                <p className="cp-tiny text-center py-2">書類スタジオで案件を紐付けると表示されます</p>
              ) : (
                relatedDocs.map(doc => {
                  const tot = computeTotals(doc.lines);
                  return (
                    <div key={doc.id} className="cp-row-between">
                      <div className="cp-row min-w-0">
                        <span className="cp-pill flex-shrink-0">{DOC_KIND_LABEL[doc.kind]}</span>
                        <span className="cp-body truncate">{doc.subject}</span>
                      </div>
                      <div className="cp-row flex-shrink-0">
                        <span className="cp-meta">{DOC_STATUS_LABEL[doc.status]}</span>
                        <span className="font-mono cp-meta">{fmtJpy(tot.total)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="cp-row-between pt-2">
            <button onClick={onDelete} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ color: '#f87171' }}>削除</button>
            <button onClick={onClose} className="cp-btn cp-btn-primary"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}>完了</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
