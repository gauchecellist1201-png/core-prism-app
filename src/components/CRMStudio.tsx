// ============================================================
// CRMStudio — 顧客管理 (パイプライン kanban + AI 次アクション + 履歴 + AgentTaskQueue 連携)
//
// アップグレード点:
//  1. ドラッグ&ドロップでステージ遷移 (デスクトップ HTML5 DnD)
//  2. 各カードに AI が「次に何をすべきか」を 1 行で提案
//  3. 詳細モーダルに時系列タイムライン (活動 + ステージ遷移)
//  4. 「この顧客に提案文を書く」ボタンで CSO/CMO に propose
//  5. AILoadingState / ApiErrorCard 統一
//  6. モバイル対応 — kanban はスワイプリスト + ステージフィルター
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { CRMDeal, CRMStage } from '../types/crm';
import { STAGE_META, STAGE_ORDER } from '../types/crm';
import { useCRM } from '../hooks/useCRM';
import EmptyState from './EmptyState';
import { StudioIntro } from './StudioIntro';
import { useInvoices } from '../hooks/useInvoices';
import { fmtJpy, computeTotals } from '../lib/invoiceCalc';
import type { BusinessDocument } from '../types/invoice';
import { confirmAction } from '../lib/confirmDialog';
import AILoadingState from './AILoadingState';
import ApiErrorCard from './ApiErrorCard';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { useCelebrate } from '../hooks/useCelebrate';
import { suggestNextAction, heuristicNextAction, priorityScore, daysSinceLastActivity } from '../lib/crmNextAction';

interface Props {
  persona: Persona;
  onClose: () => void;
}

type View = 'kanban' | 'list' | 'summary';

// ─── モバイル判定 (768px 未満) ────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

export default function CRMStudio({ persona, onClose }: Props) {
  const crm = useCRM();
  const queue = useAgentTaskQueue();
  const { celebrate, CelebratePortal } = useCelebrate();
  // 受注 (won) に進ませた瞬間だけ祝う共通ヘルパ
  const moveStageWithCelebrate = useCallback((id: string, nextStage: CRMStage) => {
    const prev = crm.deals.find(d => d.id === id);
    crm.moveStage(id, nextStage);
    if (nextStage === 'won' && prev && prev.stage !== 'won') {
      celebrate({ message: '受注おめでとうございます！', level: 'big' });
    }
  }, [crm, celebrate]);
  const dealsAll = useMemo(() => crm.getForPersona(persona.id), [crm.deals, persona.id]);
  const [view, setView] = useState<View>('kanban');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => dealsAll.find(d => d.id === editingId) || null, [dealsAll, editingId]);
  const [mobileStageFilter, setMobileStageFilter] = useState<CRMStage | 'all'>('all');
  const [dragOverStage, setDragOverStage] = useState<CRMStage | null>(null);
  const isMobile = useIsMobile();
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [proposeBusyId, setProposeBusyId] = useState<string | null>(null);

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
    // 優先度の高いものを上に
    for (const s of STAGE_ORDER) {
      map[s].sort((a, b) => priorityScore(b) - priorityScore(a));
    }
    return map;
  }, [dealsAll]);

  // ─── DnD ハンドラ ─────────────────────────────────────
  const onDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/deal-id', dealId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, stage: CRMStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };
  const onDragLeave = () => setDragOverStage(null);
  const onDrop = (e: React.DragEvent, stage: CRMStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/deal-id');
    setDragOverStage(null);
    if (!id) return;
    const deal = dealsAll.find(d => d.id === id);
    if (!deal || deal.stage === stage) return;
    moveStageWithCelebrate(id, stage);
    // ステージ遷移を自動で活動履歴に追記
    crm.addActivity(id, {
      date: new Date().toISOString().slice(0, 10),
      type: 'note',
      summary: `ステージ変更: ${STAGE_META[deal.stage].label} → ${STAGE_META[stage].label}`,
    });
  };

  // ─── AgentTaskQueue 連携 ─────────────────────────────
  const proposeOutreach = useCallback((deal: CRMDeal, kind: 'proposal' | 'followup') => {
    setProposeBusyId(deal.id);
    try {
      const contactLabel = deal.contact?.name
        ? `${deal.contact.name}${deal.contact.company ? ` (${deal.contact.company})` : ''}`
        : '担当者';
      if (kind === 'proposal') {
        queue.propose({
          title: `[CRM] ${deal.title} に提案文を書く`,
          summary: `${contactLabel} 向けの提案メール / メッセージを CSO と CMO が共同で初稿まで仕上げます。ステージ: ${STAGE_META[deal.stage].label} / 想定金額: ${deal.amount ? fmtJpy(deal.amount) : '未設定'}`,
          why: `この案件は${STAGE_META[deal.stage].label}。提案の一手を打つと前に進みます。`,
          expected: `提案文 1 通 (件名 + 本文 + 次の打ち合わせ提案)`,
          dueDays: 3,
          steps: [
            { cxo: 'CSO', label: `${contactLabel} の状況と痛みポイントを整理` },
            { cxo: 'CMO', label: '提案メールの件名 / 本文 / CTA を 1 通仕上げる' },
            { cxo: 'CSO', label: '送付前の最終チェックと次アクション設計' },
          ],
        });
      } else {
        const days = daysSinceLastActivity(deal) ?? 0;
        queue.propose({
          title: `[CRM] ${deal.title} へリマインダー送付`,
          summary: `${contactLabel} に ${days} 日連絡なし。CMO がやさしいフォローアップ文を 1 通作ります。`,
          why: `関係を温め直し、案件を停滞から救う一手です。`,
          expected: `フォローアップ メッセージ (短く、押し売りなし)`,
          dueDays: 2,
          steps: [
            { cxo: 'CSO', label: '相手の状況を踏まえた切り口を 1 つ決める' },
            { cxo: 'CMO', label: '60-120 字のリマインダー文を作成' },
          ],
        });
      }
    } catch (e: any) {
      setGlobalErr(e?.message || 'AI 会社へのタスク登録に失敗しました');
    } finally {
      setTimeout(() => setProposeBusyId(null), 800);
    }
  }, [queue]);

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
              <p className="cp-meta truncate">{persona.name} · ドラッグで遷移 · AI が次の一手を提案</p>
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
            { id: 'kanban' as View, label: isMobile ? '🗂 一覧' : '🗂 カンバン' },
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
          <ApiErrorCard error={globalErr} onRetry={() => setGlobalErr(null)} />
          <StudioIntro
            id="crm"
            accent={persona.accentColor}
            emoji="🤝"
            what="商談がいま どこまで進んでいるか を一覧で見える画面です。"
            tryThis="右上の「＋ 案件追加」で、追いかけたい商談を 1 件登録します。"
            example="「A社サイト制作」を“提案中”に置く → 受注できたら“受注”の列へドラッグ。AI が次の一手も提案します。"
            sampleLabel="出来上がりイメージ"
            samplePreview={
              <div
                style={{
                  width: 150,
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 6,
                  padding: '8px 9px',
                  fontSize: 8,
                  lineHeight: 1.4,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  borderLeft: `3px solid ${persona.accentColor}`,
                }}
                aria-label="顧客カードのサンプル"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <strong style={{ fontSize: 9 }}>A社サイト制作</strong>
                  <span
                    style={{
                      fontSize: 6,
                      color: persona.accentColor,
                      border: `1px solid ${persona.accentColor}55`,
                      borderRadius: 8,
                      padding: '1px 4px',
                      letterSpacing: '0.04em',
                    }}
                  >提案中</span>
                </div>
                <div style={{ opacity: 0.75, marginBottom: 4 }}>田中 様 · 株式会社サンプル</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ opacity: 0.7, fontSize: 7 }}>想定 / 確度</span>
                  <strong style={{ color: persona.accentColor, fontSize: 10 }}>¥330,000 · 60%</strong>
                </div>
                <div style={{ marginTop: 4, paddingTop: 3, borderTop: '1px dashed #e2e8f0', fontSize: 6, color: '#5b21b6' }}>
                  💡 3 日連絡なし → リマインダーが効きます
                </div>
              </div>
            }
          />
          {view === 'kanban' && (
            <>
              {/* モバイル: ステージフィルター chips */}
              {isMobile && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8, WebkitOverflowScrolling: 'touch' }}>
                  <button onClick={() => setMobileStageFilter('all')}
                    className="cp-pill"
                    style={{
                      flexShrink: 0,
                      background: mobileStageFilter === 'all' ? persona.accentColor : 'transparent',
                      color: mobileStageFilter === 'all' ? '#0a0a0f' : undefined,
                      borderColor: mobileStageFilter === 'all' ? persona.accentColor : undefined,
                      cursor: 'pointer',
                    }}
                  >全て ({dealsAll.length})</button>
                  {STAGE_ORDER.map(s => {
                    const meta = STAGE_META[s];
                    const n = dealsByStage[s].length;
                    const on = mobileStageFilter === s;
                    return (
                      <button key={s} onClick={() => setMobileStageFilter(s)}
                        className="cp-pill"
                        style={{
                          flexShrink: 0,
                          background: on ? meta.color : 'transparent',
                          color: on ? '#0a0a0f' : meta.color,
                          borderColor: meta.color + '70',
                          cursor: 'pointer',
                        }}
                      >{meta.emoji} {meta.label} ({n})</button>
                    );
                  })}
                </div>
              )}

              {isMobile ? (
                /* モバイル: 縦スクロールのリスト (フィルター適用) */
                <div className="cp-stack-sm">
                  {(mobileStageFilter === 'all' ? STAGE_ORDER : [mobileStageFilter]).map(stage => {
                    const dealsHere = dealsByStage[stage];
                    if (dealsHere.length === 0) return null;
                    const meta = STAGE_META[stage];
                    return (
                      <div key={stage}>
                        <div className="cp-row" style={{ gap: 6, marginBottom: 4 }}>
                          <span>{meta.emoji}</span>
                          <span className="cp-h3" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="cp-meta">{dealsHere.length}</span>
                        </div>
                        <div className="cp-stack-sm">
                          {dealsHere.map(d => (
                            <DealCard key={d.id} deal={d} accent={persona.accentColor}
                              onOpen={() => setEditingId(d.id)}
                              onMove={(s) => moveStageWithCelebrate(d.id, s)}
                              onPropose={(k) => proposeOutreach(d, k)}
                              proposing={proposeBusyId === d.id}
                              compact={false}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {dealsAll.length === 0 && (
                    <EmptyState
                      icon="🤝"
                      title="まだ商談はありません"
                      description={'名前と会社を入れるだけで、AI が「次の一手」を毎日提案します。\nメール返信案や見積もり試算も、案件カードから 1 タップで動きます。'}
                      ctaLabel="最初の案件を作る"
                      onCta={() => handleNewDeal('lead')}
                      accent={persona.accentColor}
                      preview="🌱 山田太郎 (株式会社サンプル)　→ 提案中　次の一手: 木曜にラフ案を送る"
                    />
                  )}
                </div>
              ) : (
                /* デスクトップ: kanban + DnD */
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '500px' }}>
                  {STAGE_ORDER.map(stage => {
                    const meta = STAGE_META[stage];
                    const dealsHere = dealsByStage[stage];
                    const isDragTarget = dragOverStage === stage;
                    return (
                      <div key={stage} className="flex-shrink-0" style={{ width: '260px' }}
                        onDragOver={(e) => onDragOver(e, stage)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, stage)}
                      >
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
                        <div className="rounded-lg p-2 cp-stack-sm transition-all"
                          style={{
                            background: isDragTarget ? meta.color + '25' : meta.color + '0F',
                            border: `${isDragTarget ? '2px solid' : '1px dashed'} ${meta.color}${isDragTarget ? 'CC' : '40'}`,
                            minHeight: '420px',
                          }}>
                          {dealsHere.length === 0 && (
                            <p className="cp-tiny text-center py-6">
                              {isDragTarget ? '↓ ここにドロップ' : `${meta.label}なし`}
                            </p>
                          )}
                          {dealsHere.map(d => (
                            <div key={d.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, d.id)}
                            >
                              <DealCard deal={d} accent={persona.accentColor}
                                onOpen={() => setEditingId(d.id)}
                                onMove={(s) => moveStageWithCelebrate(d.id, s)}
                                onPropose={(k) => proposeOutreach(d, k)}
                                proposing={proposeBusyId === d.id}
                                compact={true}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === 'list' && (
            <div className="cp-stack-sm">
              {dealsAll.length === 0 ? (
                <EmptyState
                  icon="🤝"
                  title="まだ商談はありません"
                  description={'名前と会社を入れるだけで、AI が「次の一手」を毎日提案します。\nメール返信案や見積もり試算も、案件カードから 1 タップで動きます。'}
                  ctaLabel="最初の案件を作る"
                  onCta={() => handleNewDeal('lead')}
                  accent={persona.accentColor}
                  preview="🌱 山田太郎 (株式会社サンプル)　→ 提案中　次の一手: 木曜にラフ案を送る"
                />
              ) : [...dealsAll].sort((a, b) => priorityScore(b) - priorityScore(a)).map(d => {
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
            onUpdate={(patch) => {
              const prevStage = editing.stage;
              crm.updateDeal(editing.id, patch);
              if (patch.stage === 'won' && prevStage !== 'won') {
                celebrate({ message: '受注おめでとうございます！', level: 'big' });
              }
            }}
            onDelete={async () => { if (await confirmAction({ title: 'この案件を削除しますか?', tone: 'danger' })) { crm.removeDeal(editing.id); setEditingId(null); } }}
            onAddActivity={(a) => crm.addActivity(editing.id, a)}
            onPropose={(kind) => proposeOutreach(editing, kind)}
            proposing={proposeBusyId === editing.id}
          />
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}

// ─── 案件カード (kanban / モバイルリスト共通) ───────────────
function DealCard({ deal, accent, onOpen, onMove, onPropose, proposing, compact }: {
  deal: CRMDeal;
  accent: string;
  onOpen: () => void;
  onMove: (s: CRMStage) => void;
  onPropose: (kind: 'proposal' | 'followup') => void;
  proposing: boolean;
  compact: boolean;
}) {
  const meta = STAGE_META[deal.stage];
  const [nextAction, setNextAction] = useState<string>(() => heuristicNextAction(deal));
  const [loadingAI, setLoadingAI] = useState(false);
  const requestedRef = useRef(false);
  const isOpen = deal.stage !== 'won' && deal.stage !== 'lost';

  // 初回マウントから 600ms 遅延で AI を呼ぶ (画面表示直後の負荷を分散)
  useEffect(() => {
    if (!isOpen) return;
    if (requestedRef.current) return;
    requestedRef.current = true;
    const t = window.setTimeout(async () => {
      setLoadingAI(true);
      try {
        const txt = await suggestNextAction(deal);
        setNextAction(txt);
      } catch { /* heuristic を維持 */ }
      finally { setLoadingAI(false); }
    }, 600 + Math.random() * 800);
    return () => window.clearTimeout(t);
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = daysSinceLastActivity(deal);
  const stale = days != null && days >= 7;

  return (
    <div className="cp-card text-left w-full"
      style={{ borderColor: meta.color + '50', background: 'var(--surface)', cursor: 'grab', padding: compact ? 10 : 12 }}>
      <button onClick={onOpen} className="w-full text-left" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}>
        <p className="cp-h3 truncate">{deal.title}</p>
        {deal.contact?.name && (
          <p className="cp-meta truncate">{deal.contact.name}{deal.contact.company && ` · ${deal.contact.company}`}</p>
        )}
        <div className="cp-row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
          {deal.amount != null && deal.amount > 0 && <span className="cp-pill" style={{ color: meta.color, borderColor: meta.color + '40' }}>{fmtJpy(deal.amount)}</span>}
          {deal.probability != null && isOpen && (
            <span className="cp-pill">{deal.probability}%</span>
          )}
          {deal.expectedCloseDate && <span className="cp-tiny" style={{ textTransform: 'none' }}>～{deal.expectedCloseDate}</span>}
          {stale && (
            <span className="cp-pill" style={{ color: '#FFA94D', borderColor: '#FFA94D55' }}>📌 {days}日 連絡なし</span>
          )}
        </div>
      </button>

      {/* AI 次アクション */}
      {isOpen && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px dashed ' + meta.color + '30',
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <span style={{ fontSize: 12, lineHeight: 1.4 }}>💡</span>
          <p className="cp-tiny" style={{ flex: 1, textTransform: 'none', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {loadingAI ? (
              <span style={{ opacity: 0.6 }}>AI が次の一手を考え中…</span>
            ) : nextAction}
          </p>
        </div>
      )}

      {/* AgentTaskQueue へ propose ボタン */}
      {isOpen && (
        <div className="cp-row mt-2" style={{ gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onPropose('proposal'); }}
            disabled={proposing}
            className="cp-btn cp-btn-sm"
            style={{
              fontSize: 10.5, padding: '4px 8px',
              background: proposing ? 'transparent' : accent + '15',
              color: accent,
              borderColor: accent + '40',
              flex: 1,
            }}
            title="CSO/CMO に提案文を書かせる"
          >
            {proposing ? '送信中…' : '✍️ 提案文を書く'}
          </button>
          {stale && (
            <button
              onClick={(e) => { e.stopPropagation(); onPropose('followup'); }}
              disabled={proposing}
              className="cp-btn cp-btn-sm"
              style={{
                fontSize: 10.5, padding: '4px 8px',
                background: '#FFA94D15', color: '#FFA94D', borderColor: '#FFA94D40',
                flex: 1,
              }}
            >
              {proposing ? '…' : '📮 リマインダー'}
            </button>
          )}
        </div>
      )}

      {/* モバイル: ステージ変更 (DnD 代替) */}
      {!compact && (
        <div className="cp-row mt-2" style={{ gap: 4, flexWrap: 'wrap' }}>
          <span className="cp-tiny" style={{ marginRight: 4 }}>移動:</span>
          {STAGE_ORDER.filter(s => s !== deal.stage).map(s => {
            const sm = STAGE_META[s];
            return (
              <button key={s}
                onClick={(e) => { e.stopPropagation(); onMove(s); }}
                className="cp-pill"
                style={{ fontSize: 9, padding: '2px 6px', cursor: 'pointer', color: sm.color, borderColor: sm.color + '40' }}
                title={`${sm.label}に移動`}
              >{sm.emoji}</button>
            );
          })}
        </div>
      )}
    </div>
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
  onPropose: (kind: 'proposal' | 'followup') => void;
  proposing: boolean;
}) {
  const inv = useInvoices();
  const relatedDocs = useMemo(() => inv.getDocumentsForDeal(props.deal.id), [inv.documents, props.deal.id]);
  return <DealEditor {...props} relatedDocs={relatedDocs} />;
}

function DealEditor({ persona, deal, onClose, onUpdate, onDelete, onAddActivity, onPropose, proposing, relatedDocs }: {
  persona: Persona;
  deal: CRMDeal;
  onClose: () => void;
  onUpdate: (patch: Partial<CRMDeal>) => void;
  onDelete: () => void;
  onAddActivity: (a: { date: string; type: 'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice'; summary: string }) => void;
  onPropose: (kind: 'proposal' | 'followup') => void;
  proposing: boolean;
  relatedDocs?: BusinessDocument[];
}) {
  const [actType, setActType] = useState<'meeting' | 'email' | 'call' | 'note' | 'proposal' | 'invoice'>('note');
  const [actSummary, setActSummary] = useState('');
  const [refreshingAI, setRefreshingAI] = useState(false);
  const [aiNext, setAiNext] = useState<string>(() => heuristicNextAction(deal));
  const [aiErr, setAiErr] = useState<string | null>(null);

  // 編集モーダルを開いた瞬間に AI 次アクションも取り直す
  useEffect(() => {
    setAiNext(heuristicNextAction(deal));
    let cancel = false;
    (async () => {
      try {
        const t = await suggestNextAction(deal);
        if (!cancel) setAiNext(t);
      } catch (e: any) {
        if (!cancel) setAiErr(e?.message || 'AI 失敗');
      }
    })();
    return () => { cancel = true; };
  }, [deal.id, deal.stage, deal.activities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAI = async () => {
    setRefreshingAI(true);
    setAiErr(null);
    try {
      const t = await suggestNextAction(deal, { force: true });
      setAiNext(t);
    } catch (e: any) {
      setAiErr(e?.message || 'AI 失敗');
    } finally {
      setRefreshingAI(false);
    }
  };

  const ACT_LABEL: Record<string, string> = {
    meeting: '🤝 商談', email: '📧 メール', call: '📞 電話',
    note: '📝 メモ', proposal: '📋 提案', invoice: '🧾 請求',
  };
  const ACT_COLOR: Record<string, string> = {
    meeting: '#5BA8FF', email: '#A78BFA', call: '#4ADE80',
    note: '#9088A8', proposal: '#FFA94D', invoice: '#F472B6',
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
        style={{ maxWidth: '640px' }}
        initial={{ scale: 0.97 }} animate={{ scale: 1 }} exit={{ scale: 0.97 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <p className="cp-h2">案件詳細</p>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>
        <div className="cp-modal-body cp-stack">
          {/* AI 次アクション + AgentTaskQueue 連携 */}
          <div className="cp-card-section" style={{ borderLeft: `3px solid ${persona.accentColor}`, background: persona.accentColor + '08' }}>
            <div className="cp-row-between" style={{ marginBottom: 6 }}>
              <p className="cp-section-head" style={{ color: persona.accentColor }}>💡 次の一手 (AI 提案)</p>
              <button onClick={refreshAI} disabled={refreshingAI} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ fontSize: 10 }}>
                {refreshingAI ? '考え中…' : '🔄 再生成'}
              </button>
            </div>
            <AILoadingState active={refreshingAI} label="次の一手を考えています" stages={['案件の状況を整理', '直近の活動を確認', '効く打ち手を 1 つ選定']} skeletonLines={2} hint="Claude Haiku が判断中" />
            {!refreshingAI && (
              <p className="cp-body" style={{ lineHeight: 1.55 }}>{aiNext}</p>
            )}
            <ApiErrorCard error={aiErr} onRetry={refreshAI} />
            <div className="cp-row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onPropose('proposal')} disabled={proposing} className="cp-btn cp-btn-sm"
                style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
                {proposing ? '送信中…' : '✍️ CSO/CMO に提案文を書かせる'}
              </button>
              <button onClick={() => onPropose('followup')} disabled={proposing} className="cp-btn cp-btn-sm">
                {proposing ? '…' : '📮 フォローアップ文を作る'}
              </button>
            </div>
          </div>

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

          {/* 活動入力 */}
          <div className="cp-card-section cp-stack-sm">
            <p className="cp-h3">活動を記録</p>
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
          </div>

          {/* 履歴タイムライン (時系列) */}
          <div className="cp-card-section cp-stack-sm">
            <p className="cp-h3">履歴タイムライン ({deal.activities.length})</p>
            {deal.activities.length === 0 ? (
              <p className="cp-tiny text-center py-3">まだ活動の記録がありません</p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 22 }}>
                {/* 縦線 */}
                <div style={{
                  position: 'absolute', left: 8, top: 6, bottom: 6,
                  width: 2, background: 'var(--surface-3)', borderRadius: 1,
                }} />
                {deal.activities.slice(0, 20).map((a) => {
                  const color = ACT_COLOR[a.type] || '#9088A8';
                  return (
                    <div key={a.id} style={{ position: 'relative', paddingBottom: 12 }}>
                      {/* ドット */}
                      <div style={{
                        position: 'absolute', left: -16, top: 4,
                        width: 12, height: 12, borderRadius: 6,
                        background: color, boxShadow: `0 0 0 3px var(--surface), 0 0 0 4px ${color}30`,
                      }} />
                      <div className="cp-row" style={{ gap: 6, marginBottom: 2 }}>
                        <span className="cp-meta font-mono">{a.date}</span>
                        <span className="cp-pill" style={{ color, borderColor: color + '50', fontSize: 9 }}>
                          {ACT_LABEL[a.type]}
                        </span>
                      </div>
                      <p className="cp-body" style={{ fontSize: 13, lineHeight: 1.5 }}>{a.summary}</p>
                    </div>
                  );
                })}
                {deal.activities.length > 20 && (
                  <p className="cp-tiny" style={{ textAlign: 'center', opacity: 0.6 }}>
                    残り {deal.activities.length - 20} 件は省略
                  </p>
                )}
              </div>
            )}
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
