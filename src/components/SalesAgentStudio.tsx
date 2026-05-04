import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { SalesLead, CompanyResearch } from '../types/salesAgent';
import { SALES_STAGE_LABELS } from '../types/salesAgent';
import { useSalesAgent } from '../hooks/useSalesAgent';
import { researchCompany, scoreLead, generateApproachEmail, predictSignals } from '../lib/salesAgent';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = 'dashboard' | 'research' | 'leads' | 'approach' | 'signals' | 'product';

export default function SalesAgentStudio({ persona, settings, onClose }: Props) {
  const sa = useSalesAgent();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const myCompanies = useMemo(() => sa.getCompaniesForPersona(persona.id), [sa.companies, persona.id]);
  const myLeads     = useMemo(() => sa.getLeadsForPersona(persona.id), [sa.leads, persona.id]);
  const mySignals   = useMemo(() => sa.getSignalsForPersona(persona.id), [sa.signals, persona.id]);
  const ownProduct  = sa.getOwnProduct(persona.id);

  // ─── リサーチタブ ─────────
  const [researchInput, setResearchInput] = useState({ name: '', url: '', extra: '' });
  const [latestResearch, setLatestResearch] = useState<CompanyResearch | null>(null);

  const handleResearch = useCallback(async () => {
    if (!researchInput.name.trim()) { setError('企業名を入力してください'); return; }
    setBusy('research'); setError(null);
    try {
      const result = await researchCompany({
        settings, persona,
        companyName: researchInput.name,
        url: researchInput.url || undefined,
        ownProduct,
        publicInfo: researchInput.extra || undefined,
      });
      const saved = sa.addCompany(persona.id, result);
      setLatestResearch(saved);
      setResearchInput({ name: '', url: '', extra: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }, [researchInput, settings, persona, ownProduct, sa]);

  // ─── リードタブ ──────────
  const [newLead, setNewLead] = useState({ companyName: '', contactName: '', contactRole: '', email: '', notes: '' });
  const handleAddLead = useCallback(async () => {
    if (!newLead.companyName.trim()) { setError('企業名を入れてください'); return; }
    setBusy('lead'); setError(null);
    try {
      const company = myCompanies.find(c => c.companyName === newLead.companyName);
      const { score, scoreReason } = await scoreLead({
        settings, lead: { ...newLead }, ownProduct, research: company,
      });
      sa.addLead(persona.id, {
        ...newLead,
        companyId: company?.id,
        score, scoreReason,
        stage: 'new',
      });
      setNewLead({ companyName: '', contactName: '', contactRole: '', email: '', notes: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }, [newLead, settings, myCompanies, ownProduct, sa, persona.id]);

  // ─── アプローチタブ ────
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [approachTone, setApproachTone] = useState('丁寧で温かい');
  const [approachGoal, setApproachGoal] = useState('20分のオンライン面談の打診');
  const handleGenerateEmail = useCallback(async () => {
    if (!selectedLeadId) { setError('リードを選んでください'); return; }
    const lead = myLeads.find(l => l.id === selectedLeadId);
    if (!lead) return;
    const company = lead.companyId ? myCompanies.find(c => c.id === lead.companyId) : undefined;
    setBusy('approach'); setError(null);
    try {
      const draft = await generateApproachEmail({
        settings, persona, lead, research: company, ownProduct,
        goal: approachGoal, tone: approachTone,
      });
      sa.addApproach(draft);
      sa.updateLead(lead.id, { stage: 'approached' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }, [selectedLeadId, myLeads, myCompanies, settings, persona, ownProduct, approachGoal, approachTone, sa]);

  // ─── シグナルタブ ─────
  const handlePredictSignals = useCallback(async () => {
    if (myCompanies.length === 0) { setError('企業を1社以上リサーチしてからシグナル予測を実行できます'); return; }
    setBusy('signals'); setError(null);
    try {
      const list = await predictSignals({
        settings, persona,
        companies: myCompanies.map(c => ({ name: c.companyName, url: c.url, industry: c.industry })),
        ownProduct,
      });
      sa.upsertSignals(persona.id, list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }, [myCompanies, settings, persona, ownProduct, sa]);

  // ─── 商材タブ ────────
  const [productDraft, setProductDraft] = useState(ownProduct);
  const saveProduct = () => { sa.setOwnProduct(persona.id, productDraft); };

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1100px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>🎯</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">商談 AI エージェント</p>
              <p className="cp-meta truncate">{persona.name} · リサーチ → リスト → アプローチ → シグナル を AI が代行</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        <div className="cp-modal-tabs">
          {([
            { id: 'dashboard', label: '🏠 ホーム' },
            { id: 'research',  label: `🔍 リサーチ (${myCompanies.length})` },
            { id: 'leads',     label: `📋 リード (${myLeads.length})` },
            { id: 'approach',  label: '📨 アプローチ' },
            { id: 'signals',   label: `⚡ シグナル (${mySignals.filter(s => !s.read).length})` },
            { id: 'product',   label: '🎁 自社の商材' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
              className="cp-modal-tab" data-active={tab === t.id}
              style={{ color: tab === t.id ? persona.accentColor : undefined }}>{t.label}</button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          {error && (
            <div className="rounded-md p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>{error}</div>
          )}

          {tab === 'dashboard' && (
            <>
              <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                  { label: '企業リサーチ', value: myCompanies.length, color: persona.accentColor },
                  { label: 'リード', value: myLeads.length, color: '#5BA8FF' },
                  { label: '進行中商談', value: myLeads.filter(l => l.stage === 'meeting-set' || l.stage === 'replied').length, color: '#FFA94D' },
                  { label: '未読シグナル', value: mySignals.filter(s => !s.read).length, color: '#FF6FB5' },
                ].map(s => (
                  <div key={s.label} className="cp-card text-center">
                    <p className="cp-tiny">{s.label}</p>
                    <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 600, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* スコア上位リード */}
              <div className="cp-card-section">
                <p className="cp-h3 mb-2">🔥 スコアが高いリード TOP 5</p>
                {myLeads.length === 0 ? (
                  <p className="cp-meta">リードがまだ登録されていません</p>
                ) : (
                  <div className="cp-stack-sm">
                    {myLeads.sort((a, b) => b.score - a.score).slice(0, 5).map(l => (
                      <div key={l.id} className="cp-card cp-row-between">
                        <div className="min-w-0">
                          <p className="cp-h3 truncate">{l.companyName}</p>
                          <p className="cp-meta truncate">{l.contactName || '担当者未設定'} · {SALES_STAGE_LABELS[l.stage].label}</p>
                        </div>
                        <div className="cp-row" style={{ flexShrink: 0 }}>
                          <span className="cp-pill" style={{ color: l.score >= 70 ? '#10B981' : l.score >= 50 ? '#F59E0B' : '#9088A8' }}>
                            {l.score}/100
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 最新シグナル */}
              {mySignals.length > 0 && (
                <div className="cp-card-section">
                  <p className="cp-h3 mb-2">⚡ 最近のシグナル</p>
                  <div className="cp-stack-sm">
                    {mySignals.slice(0, 4).map(s => (
                      <div key={s.id} className="cp-card">
                        <div className="cp-row-between">
                          <span className="cp-h3">{s.companyName}</span>
                          <span className="cp-pill" style={{ color: s.severity === 'high' ? '#F87171' : s.severity === 'medium' ? '#FBBF24' : '#9088A8' }}>
                            {s.signalType}
                          </span>
                        </div>
                        <p className="cp-body mt-1">{s.description}</p>
                        {s.suggestedAction && <p className="cp-meta mt-1" style={{ color: persona.accentColor }}>→ {s.suggestedAction}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'research' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <p className="cp-h3">🔍 企業を AI でリサーチ</p>
                <p className="cp-meta">企業名と URL を入れるだけで、業界・課題予測・売り込み角度を AI が構造化します。</p>
                <input value={researchInput.name} onChange={e => setResearchInput({...researchInput, name: e.target.value})}
                  placeholder="例: 株式会社サンプル" className="cp-input" />
                <input value={researchInput.url} onChange={e => setResearchInput({...researchInput, url: e.target.value})}
                  placeholder="URL (任意)" className="cp-input" />
                <textarea value={researchInput.extra} onChange={e => setResearchInput({...researchInput, extra: e.target.value})}
                  placeholder="参考情報を貼り付け (任意・プレスリリース・IR等)" rows={3} className="cp-textarea" />
                <button onClick={handleResearch} disabled={busy === 'research'}
                  className="cp-btn cp-btn-primary" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy === 'research' ? '🧠 リサーチ中…' : '✨ AI で調査開始'}
                </button>
              </div>

              {latestResearch && (
                <div className="cp-card-section cp-stack-sm">
                  <p className="cp-h3">📑 {latestResearch.companyName}</p>
                  {latestResearch.industry && <p className="cp-meta">{latestResearch.industry} · {latestResearch.revenueEstimate} · {latestResearch.employeeCount}</p>}
                  {latestResearch.overview && <p className="cp-body">{latestResearch.overview}</p>}
                  {latestResearch.pitchAngle && (
                    <div className="cp-card" style={{ background: persona.accentColorLight, borderColor: persona.accentColor }}>
                      <p className="cp-tiny">🎯 売り込み角度</p>
                      <p className="cp-body" style={{ color: persona.accentColor }}>{latestResearch.pitchAngle}</p>
                    </div>
                  )}
                  {(latestResearch.predictedChallenges || []).length > 0 && (
                    <div>
                      <p className="cp-tiny">想定される課題</p>
                      {latestResearch.predictedChallenges!.map((c, i) => <p key={i} className="cp-body">・{c}</p>)}
                    </div>
                  )}
                  {(latestResearch.recommendedSteps || []).length > 0 && (
                    <div>
                      <p className="cp-tiny">推奨アプローチ</p>
                      {latestResearch.recommendedSteps!.map((s, i) => <p key={i} className="cp-body">{i + 1}. {s}</p>)}
                    </div>
                  )}
                </div>
              )}

              {myCompanies.length > 0 && (
                <div>
                  <p className="cp-section-head">過去のリサーチ ({myCompanies.length} 社)</p>
                  <div className="cp-stack-sm">
                    {myCompanies.map(c => (
                      <button key={c.id} onClick={() => setLatestResearch(c)}
                        className="cp-card text-left w-full cp-row-between hover:opacity-80">
                        <div className="min-w-0">
                          <p className="cp-h3 truncate">{c.companyName}</p>
                          <p className="cp-meta truncate">{c.industry} · {c.pitchAngle?.slice(0, 50)}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('削除?')) sa.removeCompany(c.id); }}
                          className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'leads' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <p className="cp-h3">📋 リードを追加 (AI が自動スコアリング)</p>
                <div className="cp-grid-2">
                  <input placeholder="企業名 *" value={newLead.companyName} onChange={e => setNewLead({...newLead, companyName: e.target.value})} className="cp-input" />
                  <input placeholder="担当者名" value={newLead.contactName} onChange={e => setNewLead({...newLead, contactName: e.target.value})} className="cp-input" />
                  <input placeholder="役職" value={newLead.contactRole} onChange={e => setNewLead({...newLead, contactRole: e.target.value})} className="cp-input" />
                  <input placeholder="メール" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="cp-input" />
                </div>
                <textarea placeholder="メモ" rows={2} value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} className="cp-textarea" />
                <button onClick={handleAddLead} disabled={busy === 'lead'}
                  className="cp-btn cp-btn-primary" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy === 'lead' ? '🧠 スコア計算中…' : '＋ リード追加 + AI 採点'}
                </button>
              </div>

              <div className="cp-stack-sm">
                {myLeads.length === 0 ? (
                  <div className="cp-empty"><p className="cp-empty-icon">📭</p><p>リードがまだありません</p></div>
                ) : myLeads.map(l => {
                  const stage = SALES_STAGE_LABELS[l.stage];
                  return (
                    <div key={l.id} className="cp-card cp-row-between">
                      <div className="min-w-0 cp-row" style={{ gap: 10 }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: stage.color + '20', color: stage.color }}>{stage.emoji}</div>
                        <div className="min-w-0">
                          <p className="cp-h3 truncate">{l.companyName}</p>
                          <p className="cp-meta truncate">{l.contactName || '未設定'} {l.contactRole && `· ${l.contactRole}`}</p>
                          {l.scoreReason && <p className="cp-tiny" style={{ textTransform: 'none' }}>{l.scoreReason}</p>}
                        </div>
                      </div>
                      <div className="cp-row" style={{ flexShrink: 0 }}>
                        <span className="cp-pill" style={{ color: l.score >= 70 ? '#10B981' : l.score >= 50 ? '#F59E0B' : '#9088A8', fontWeight: 600 }}>
                          {l.score}/100
                        </span>
                        <select value={l.stage} onChange={e => sa.updateLead(l.id, { stage: e.target.value as SalesLead['stage'] })} className="cp-select" style={{ width: 120 }}>
                          {Object.entries(SALES_STAGE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                          ))}
                        </select>
                        <button onClick={() => sa.removeLead(l.id)} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'approach' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <p className="cp-h3">📨 個別パーソナライズメールを生成</p>
                <select value={selectedLeadId || ''} onChange={e => setSelectedLeadId(e.target.value)} className="cp-select">
                  <option value="">リードを選択...</option>
                  {myLeads.map(l => (
                    <option key={l.id} value={l.id}>{l.companyName} / {l.contactName || '担当者未設定'} (スコア {l.score})</option>
                  ))}
                </select>
                <div className="cp-grid-2">
                  <input value={approachTone} onChange={e => setApproachTone(e.target.value)} placeholder="トーン" className="cp-input" />
                  <input value={approachGoal} onChange={e => setApproachGoal(e.target.value)} placeholder="ゴール" className="cp-input" />
                </div>
                <button onClick={handleGenerateEmail} disabled={busy === 'approach' || !selectedLeadId}
                  className="cp-btn cp-btn-primary" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy === 'approach' ? '🧠 作成中…' : '✨ AI でメール下書き作成'}
                </button>
              </div>

              <div className="cp-stack-sm">
                {sa.approaches.length === 0 ? (
                  <div className="cp-empty"><p className="cp-empty-icon">📨</p><p>下書きがまだありません</p></div>
                ) : sa.approaches.slice(0, 10).map(a => {
                  const lead = myLeads.find(l => l.id === a.leadId);
                  if (!lead) return null;
                  return (
                    <div key={a.id} className="cp-card cp-stack-sm">
                      <div className="cp-row-between">
                        <span className="cp-h3 truncate">{lead.companyName} / {lead.contactName || '担当者様'}</span>
                        <span className="cp-pill" style={{ color: (a.hitProbability || 0) >= 60 ? '#10B981' : '#9088A8' }}>反応率 {a.hitProbability}%</span>
                      </div>
                      <p className="cp-meta">件名: {a.subject}</p>
                      <pre className="cp-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{a.body}</pre>
                      <div className="cp-row" style={{ gap: 6 }}>
                        <button onClick={() => navigator.clipboard.writeText(`${a.subject}\n\n${a.body}`)} className="cp-btn cp-btn-sm">📋 コピー</button>
                        <button onClick={() => sa.updateApproach(a.id, { status: 'sent' })} className="cp-btn cp-btn-sm">送信済にする</button>
                        <button onClick={() => sa.removeApproach(a.id)} className="cp-btn cp-btn-ghost cp-btn-sm">削除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'signals' && (
            <>
              <div className="cp-card-section cp-row-between">
                <div>
                  <p className="cp-h3">⚡ 売れるタイミングを AI が予測</p>
                  <p className="cp-meta">登録企業の業界傾向から「今、動きがあるかも」を推定します</p>
                </div>
                <button onClick={handlePredictSignals} disabled={busy === 'signals' || myCompanies.length === 0}
                  className="cp-btn cp-btn-primary" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy === 'signals' ? '🧠 予測中…' : '🔮 シグナル予測'}
                </button>
              </div>

              <div className="cp-stack-sm">
                {mySignals.length === 0 ? (
                  <div className="cp-empty"><p className="cp-empty-icon">⚡</p><p>シグナルがまだありません</p><p className="cp-meta">先にリサーチタブで企業を登録してから「シグナル予測」を実行してください</p></div>
                ) : mySignals.map(s => (
                  <div key={s.id} className="cp-card cp-stack-sm" style={{ opacity: s.read ? 0.6 : 1 }}>
                    <div className="cp-row-between">
                      <div className="cp-row" style={{ gap: 6 }}>
                        <span className="cp-h3">{s.companyName}</span>
                        <span className="cp-pill" style={{
                          color: s.severity === 'high' ? '#F87171' : s.severity === 'medium' ? '#FBBF24' : '#9088A8',
                          borderColor: s.severity === 'high' ? '#F87171' : s.severity === 'medium' ? '#FBBF24' : '#9088A8',
                        }}>{s.signalType}</span>
                      </div>
                      <div className="cp-row" style={{ gap: 4 }}>
                        {!s.read && <button onClick={() => sa.markSignalRead(s.id)} className="cp-btn cp-btn-sm">既読</button>}
                        <button onClick={() => sa.removeSignal(s.id)} className="cp-btn cp-btn-ghost cp-btn-sm">×</button>
                      </div>
                    </div>
                    <p className="cp-body">{s.description}</p>
                    {s.suggestedAction && <p className="cp-meta" style={{ color: persona.accentColor }}>→ 次の一手: {s.suggestedAction}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'product' && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">🎁 自社の商材を登録</p>
              <p className="cp-meta">この情報を使って AI が「相手企業との相性」「売り込み角度」を考えます。詳しく書くほど精度が上がります。</p>
              <textarea value={productDraft} onChange={e => setProductDraft(e.target.value)}
                placeholder={`例:\n弊社の商材: 飲食店向け予約管理 SaaS\n価格: 月¥9,800〜\nコア機能: 予約一元管理 / 顧客LTV分析 / LINE自動配信\nターゲット: 月50万円以上の売上がある飲食店\n強み: 月の客単価が3,500円以上の店で、リピート率を平均15%向上した実績`}
                rows={10} className="cp-textarea" />
              <button onClick={saveProduct} className="cp-btn cp-btn-primary" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                保存
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
