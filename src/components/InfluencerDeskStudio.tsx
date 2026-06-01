// ============================================================
// インフルエンサーデスク — 案件 / 交渉 / 納期 / 報告 を一元管理
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type {
  InfluencerDeal, NegotiationType, MediaKit, Platform, ContentType, DealStage, PlatformMetrics,
} from '../types/influencerDeal';
import {
  DEAL_STAGE_META, PLATFORM_META, CONTENT_TYPE_META, NEGOTIATION_TYPE_META,
} from '../types/influencerDeal';
import { useInfluencerDesk } from '../hooks/useInfluencerDesk';
import { useCopyButton } from '../hooks/useCopyButton';
import { generateNegotiation, generateDraftCopy, evaluateOffer, generateBrandReport } from '../lib/influencerAgent';
import { confirmAction } from '../lib/confirmDialog';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = 'board' | 'negotiate' | 'schedule' | 'draft' | 'report' | 'kit';

export default function InfluencerDeskStudio({ persona, settings, onClose }: Props) {
  const desk = useInfluencerDesk();
  const negoCopy = useCopyButton();
  const draftCopy = useCopyButton();
  const reportCopy = useCopyButton();
  const [tab, setTab] = useState<Tab>('board');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const myDeals = useMemo(() => desk.getDealsForPersona(persona.id), [desk.deals, persona.id]);
  const mediaKit = desk.getMediaKit(persona.id);

  // ── 新規案件入力 ──────────────────────
  const [newDeal, setNewDeal] = useState<Partial<InfluencerDeal>>({
    brandName: '', agencyName: '', productName: '',
    platform: 'instagram', contentType: 'post',
    fee: 0, deliverables: '',
    draftDeadline: '', postDeadline: '', reportDeadline: '',
    stage: 'inquiry',
    contactName: '', contactEmail: '', notes: '', guidelines: '',
  });
  const handleAddDeal = useCallback(() => {
    if (!newDeal.brandName?.trim()) { setErr('ブランド名を入力してください'); return; }
    desk.addDeal(persona.id, {
      brandName: newDeal.brandName!,
      agencyName: newDeal.agencyName,
      productName: newDeal.productName,
      platform: (newDeal.platform || 'instagram') as Platform,
      contentType: (newDeal.contentType || 'post') as ContentType,
      fee: Number(newDeal.fee) || 0,
      usageFee: newDeal.usageFee ? Number(newDeal.usageFee) : undefined,
      deliverables: newDeal.deliverables || '',
      draftDeadline: newDeal.draftDeadline || undefined,
      postDeadline: newDeal.postDeadline || undefined,
      reportDeadline: newDeal.reportDeadline || undefined,
      stage: (newDeal.stage || 'inquiry') as DealStage,
      contactName: newDeal.contactName,
      contactEmail: newDeal.contactEmail,
      notes: newDeal.notes,
      guidelines: newDeal.guidelines,
    });
    setNewDeal({
      brandName: '', agencyName: '', productName: '',
      platform: 'instagram', contentType: 'post',
      fee: 0, deliverables: '',
      draftDeadline: '', postDeadline: '', reportDeadline: '',
      stage: 'inquiry',
    });
    setErr(null);
  }, [newDeal, desk, persona.id]);

  // ── 交渉文生成 ──────────────────────────
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [negoType, setNegoType] = useState<NegotiationType>('first-reply');
  const [targetFee, setTargetFee] = useState<string>('');
  const [customNote, setCustomNote] = useState('');
  const handleGenerateNego = useCallback(async () => {
    const deal = myDeals.find(d => d.id === selectedDealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await generateNegotiation({
        settings, persona, deal, mediaKit,
        type: negoType,
        targetFee: targetFee ? Number(targetFee) : undefined,
        customNote: customNote || undefined,
      });
      desk.addNego({ ...r, dealId: deal.id, status: 'draft' });
    } catch (e: any) {
      setErr(e.message || '交渉文の生成に失敗しました');
    } finally { setBusy(false); }
  }, [selectedDealId, negoType, targetFee, customNote, myDeals, settings, persona, mediaKit, desk]);

  // ── オファー評価 ──────────────────────
  const [evalResult, setEvalResult] = useState<{ verdict: string; fairFee: { min: number; max: number }; reason: string; counterScript?: string } | null>(null);
  const handleEvaluate = useCallback(async () => {
    const deal = myDeals.find(d => d.id === selectedDealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await evaluateOffer({ settings, deal, mediaKit });
      setEvalResult(r);
    } catch (e: any) {
      setErr(e.message || '評価に失敗しました');
    } finally { setBusy(false); }
  }, [selectedDealId, myDeals, settings, mediaKit]);

  // ── 投稿下書き生成 ──────────────────────
  const [draftDealId, setDraftDealId] = useState<string>('');
  const [toneNote, setToneNote] = useState('');
  const handleGenerateDraft = useCallback(async () => {
    const deal = myDeals.find(d => d.id === draftDealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await generateDraftCopy({ settings, persona, deal, mediaKit, toneNote: toneNote || undefined });
      const fullText = r.caption + '\n\n' + r.hashtags.join(' ') + '\n\n' + r.cta;
      desk.updateDeal(deal.id, { draftCopy: fullText, stage: deal.stage === 'inquiry' || deal.stage === 'negotiating' ? 'drafting' : deal.stage });
    } catch (e: any) {
      setErr(e.message || '下書き生成に失敗しました');
    } finally { setBusy(false); }
  }, [draftDealId, toneNote, myDeals, settings, persona, mediaKit, desk]);

  // ── レポート生成 ──────────────────────
  const [reportDealId, setReportDealId] = useState<string>('');
  const [reportMetrics, setReportMetrics] = useState<PlatformMetrics>({});
  const [reflection, setReflection] = useState('');
  const [reportOut, setReportOut] = useState<{ markdown: string; summary: string } | null>(null);
  const handleGenerateReport = useCallback(async () => {
    const deal = myDeals.find(d => d.id === reportDealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await generateBrandReport({
        settings, persona, deal, mediaKit,
        metrics: reportMetrics,
        reflection: reflection || undefined,
      });
      setReportOut(r);
      desk.updateDeal(deal.id, { metrics: reportMetrics, stage: 'reported' });
    } catch (e: any) {
      setErr(e.message || 'レポート生成に失敗しました');
    } finally { setBusy(false); }
  }, [reportDealId, reportMetrics, reflection, myDeals, settings, persona, mediaKit, desk]);

  // ── メディアキット編集 ──────────────────
  const [kitDraft, setKitDraft] = useState<MediaKit>(mediaKit || { personaId: persona.id });
  const saveKit = () => {
    desk.setMediaKit(persona.id, { ...kitDraft, personaId: persona.id });
  };

  // ── 納期スケジュール (今後7日以内 / 1ヶ月以内) ─
  const upcoming = useMemo(() => {
    const events: { dealId: string; brand: string; type: string; date: Date; daysLeft: number; stage: DealStage }[] = [];
    const now = new Date();
    const addEv = (d: InfluencerDeal, iso: string | undefined, type: string) => {
      if (!iso) return;
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return;
      const days = Math.ceil((dt.getTime() - now.getTime()) / 86400000);
      events.push({ dealId: d.id, brand: d.brandName, type, date: dt, daysLeft: days, stage: d.stage });
    };
    myDeals.forEach(d => {
      addEv(d, d.draftDeadline, '下書き提出');
      addEv(d, d.postDeadline, '本投稿');
      addEv(d, d.reportDeadline, 'レポート');
    });
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [myDeals]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,18,0.85)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal w-full max-w-[1400px] flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>★</div>
            <div className="min-w-0">
              <p className="cp-h3 truncate">インフルエンサー デスク</p>
              <p className="cp-meta truncate">{persona.name} · 案件 {myDeals.length} 件 · 直近納期 {upcoming.filter(e => e.daysLeft >= 0 && e.daysLeft <= 7).length} 件</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        {/* タブ */}
        <div className="flex gap-1 px-5 py-2 border-b border-edge overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {[
            { id: 'board' as Tab,     label: '🗂 案件ボード' },
            { id: 'schedule' as Tab,  label: '📅 納期スケジュール' },
            { id: 'negotiate' as Tab, label: '💬 交渉センター' },
            { id: 'draft' as Tab,     label: '✍ 投稿下書き' },
            { id: 'report' as Tab,    label: '📊 レポート' },
            { id: 'kit' as Tab,       label: '📇 メディアキット' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`cp-tab cp-tab-${tab === t.id ? 'on' : 'off'}`}
              style={{ color: tab === t.id ? persona.accentColor : undefined }}>
              {t.label}
            </button>
          ))}
        </div>

        {err && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <p className="text-red-300 text-xs">{err}</p>
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5">

          <StudioIntro
            id="influencer-desk"
            accent={persona.accentColor}
            emoji="★"
            what="ブランド案件の「依頼 → 交渉 → 投稿 → 報告」までを 1 画面で全部回す場所です。"
            tryThis="「+ 新規案件を追加」でブランド名と報酬を入れる → 💬 交渉センターで返信文を AI 生成。"
            example="案件 5 本 → 報酬合計・今週納期・交渉返信文・報告レポートまで全自動で並ぶ。"
            sampleLabel="出来上がる案件ボード"
            samplePreview={
              <div
                style={{
                  width: 160,
                  background: 'var(--surface-1)',
                  borderRadius: 6,
                  padding: '7px 8px',
                  fontSize: 7,
                  lineHeight: 1.4,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                  border: `1px solid ${persona.accentColor}30`,
                }}
                aria-label="案件ボードのサンプル"
              >
                {/* KPI 行 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 4 }}>
                  <div
                    style={{
                      background: `${persona.accentColor}14`,
                      borderRadius: 3,
                      padding: '3px 4px',
                      color: 'var(--fg)',
                    }}
                  >
                    <div style={{ fontSize: 5, opacity: 0.7 }}>進行中</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: persona.accentColor }}>5</div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(74,222,128,0.12)',
                      borderRadius: 3,
                      padding: '3px 4px',
                      color: 'var(--fg)',
                    }}
                  >
                    <div style={{ fontSize: 5, opacity: 0.7 }}>今月報酬</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#4ade80' }}>¥850K</div>
                  </div>
                </div>

                {/* 案件カード */}
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 3,
                    padding: '3px 4px',
                    marginBottom: 2,
                    color: 'var(--fg)',
                    borderLeft: `2px solid ${persona.accentColor}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 6.5 }}>SHISEIDO</span>
                    <span style={{ fontSize: 5, color: '#4ade80' }}>✓ 投稿済</span>
                  </div>
                  <div style={{ fontSize: 5, opacity: 0.7 }}>Reels · ¥220,000</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 3,
                    padding: '3px 4px',
                    marginBottom: 2,
                    color: 'var(--fg)',
                    borderLeft: '2px solid #FFA94D',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 6.5 }}>UNIQLO</span>
                    <span style={{ fontSize: 5, color: '#FFA94D' }}>⏰ 5/28 納期</span>
                  </div>
                  <div style={{ fontSize: 5, opacity: 0.7 }}>Post + Story · ¥180,000</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 3,
                    padding: '3px 4px',
                    color: 'var(--fg)',
                    borderLeft: '2px solid #60a5fa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 6.5 }}>NIKE</span>
                    <span style={{ fontSize: 5, color: '#60a5fa' }}>💬 交渉中</span>
                  </div>
                  <div style={{ fontSize: 5, opacity: 0.7 }}>Reels × 2 · ¥450,000</div>
                </div>
              </div>
            }
          />

          {/* 案件ボード */}
          {tab === 'board' && (
            <div className="space-y-4">
              {/* 統計 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '進行中', value: myDeals.filter(d => !['closed','declined','reported'].includes(d.stage)).length, c: persona.accentColor },
                  { label: '今週納期', value: upcoming.filter(e => e.daysLeft >= 0 && e.daysLeft <= 7).length, c: '#FFA94D' },
                  { label: '今月の総報酬', value: '¥' + myDeals.filter(d => ['posted','reported','closed'].includes(d.stage)).reduce((s, d) => s + (d.fee || 0), 0).toLocaleString(), c: '#4ADE80' },
                  { label: '完了', value: myDeals.filter(d => d.stage === 'closed').length, c: '#10B981' },
                ].map(s => (
                  <div key={s.label} className="cp-card">
                    <p className="cp-meta">{s.label}</p>
                    <p className="text-2xl font-bold" style={{ color: s.c }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* 新規案件入力 */}
              <details className="cp-card">
                <summary className="cursor-pointer cp-h4">+ 新規案件を追加</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input className="cp-input" placeholder="ブランド名 *" value={newDeal.brandName || ''} onChange={e => setNewDeal({ ...newDeal, brandName: e.target.value })} />
                  <input className="cp-input" placeholder="代理店名" value={newDeal.agencyName || ''} onChange={e => setNewDeal({ ...newDeal, agencyName: e.target.value })} />
                  <input className="cp-input" placeholder="商品/キャンペーン名" value={newDeal.productName || ''} onChange={e => setNewDeal({ ...newDeal, productName: e.target.value })} />
                  <input className="cp-input" placeholder="納品物 (例: フィード1本+ストーリー3本)" value={newDeal.deliverables || ''} onChange={e => setNewDeal({ ...newDeal, deliverables: e.target.value })} />
                  <select className="cp-input" value={newDeal.platform} onChange={e => setNewDeal({ ...newDeal, platform: e.target.value as Platform })}>
                    {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                  <select className="cp-input" value={newDeal.contentType} onChange={e => setNewDeal({ ...newDeal, contentType: e.target.value as ContentType })}>
                    {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input className="cp-input" type="number" placeholder="報酬 (税抜・円)" value={newDeal.fee || ''} onChange={e => setNewDeal({ ...newDeal, fee: Number(e.target.value) })} />
                  <input className="cp-input" type="number" placeholder="二次利用料 (任意)" value={newDeal.usageFee || ''} onChange={e => setNewDeal({ ...newDeal, usageFee: Number(e.target.value) })} />
                  <input className="cp-input" type="datetime-local" placeholder="下書き期限" value={newDeal.draftDeadline || ''} onChange={e => setNewDeal({ ...newDeal, draftDeadline: e.target.value })} />
                  <input className="cp-input" type="datetime-local" placeholder="本投稿期限" value={newDeal.postDeadline || ''} onChange={e => setNewDeal({ ...newDeal, postDeadline: e.target.value })} />
                  <input className="cp-input" type="datetime-local" placeholder="レポート期限" value={newDeal.reportDeadline || ''} onChange={e => setNewDeal({ ...newDeal, reportDeadline: e.target.value })} />
                  <input className="cp-input" placeholder="担当者名" value={newDeal.contactName || ''} onChange={e => setNewDeal({ ...newDeal, contactName: e.target.value })} />
                  <input className="cp-input" placeholder="担当者メール" value={newDeal.contactEmail || ''} onChange={e => setNewDeal({ ...newDeal, contactEmail: e.target.value })} />
                  <textarea className="cp-input md:col-span-2" rows={2} placeholder="ガイドライン (#PR必須・NGワード等)" value={newDeal.guidelines || ''} onChange={e => setNewDeal({ ...newDeal, guidelines: e.target.value })} />
                  <textarea className="cp-input md:col-span-2" rows={2} placeholder="メモ" value={newDeal.notes || ''} onChange={e => setNewDeal({ ...newDeal, notes: e.target.value })} />
                </div>
                <button onClick={handleAddDeal} className="cp-btn cp-btn-primary mt-3" style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  追加
                </button>
              </details>

              {/* 案件リスト (ステージ別) */}
              <div className="space-y-3">
                {myDeals.length === 0 && <p className="cp-meta text-center py-6">まだ案件はありません</p>}
                {myDeals.map(d => {
                  const meta = DEAL_STAGE_META[d.stage];
                  const pmeta = PLATFORM_META[d.platform];
                  return (
                    <div key={d.id} className="cp-card">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{pmeta.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="cp-h4 truncate">{d.brandName}</p>
                            {d.agencyName && <span className="cp-pill">{d.agencyName}</span>}
                            <span className="cp-pill" style={{ background: meta.color + '22', color: meta.color, fontSize: '0.7rem' }}>
                              {meta.emoji} {meta.label}
                            </span>
                          </div>
                          {d.productName && <p className="cp-meta truncate">{d.productName}</p>}
                          <div className="cp-meta mt-1">
                            {pmeta.label} / {CONTENT_TYPE_META[d.contentType]} / ¥{d.fee.toLocaleString()}
                            {d.usageFee ? ` (+ 二次利用 ¥${d.usageFee.toLocaleString()})` : ''}
                            {d.deliverables ? ` · ${d.deliverables}` : ''}
                          </div>
                          {(d.draftDeadline || d.postDeadline || d.reportDeadline) && (
                            <div className="flex gap-3 cp-meta mt-1 flex-wrap">
                              {d.draftDeadline && <span>📋 下書き {new Date(d.draftDeadline).toLocaleDateString('ja-JP')}</span>}
                              {d.postDeadline && <span>🚀 投稿 {new Date(d.postDeadline).toLocaleDateString('ja-JP')}</span>}
                              {d.reportDeadline && <span>📊 報告 {new Date(d.reportDeadline).toLocaleDateString('ja-JP')}</span>}
                            </div>
                          )}
                        </div>
                        <select className="cp-input cp-input-sm" value={d.stage} onChange={e => desk.updateDeal(d.id, { stage: e.target.value as DealStage })}>
                          {Object.entries(DEAL_STAGE_META).sort((a, b) => a[1].order - b[1].order).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                          ))}
                        </select>
                        <button onClick={async () => { if (await confirmAction({ title: 'この案件を削除しますか?', tone: 'danger' })) desk.removeDeal(d.id); }} className="cp-btn cp-btn-ghost cp-btn-sm">🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 納期スケジュール */}
          {tab === 'schedule' && (
            <div className="space-y-3">
              <p className="cp-h3">📅 直近の納期</p>
              {upcoming.length === 0 && <p className="cp-meta">登録された納期はありません</p>}
              {upcoming.map((ev, i) => {
                const danger = ev.daysLeft < 0 ? 'over' : ev.daysLeft <= 2 ? 'soon' : ev.daysLeft <= 7 ? 'week' : 'normal';
                const colors = { over: '#F87171', soon: '#FFA94D', week: '#FFC857', normal: persona.accentColor };
                return (
                  <div key={i} className="cp-card flex items-center gap-3">
                    <div className="text-center" style={{ minWidth: '4rem' }}>
                      <p className="text-2xl font-bold" style={{ color: colors[danger] }}>
                        {ev.daysLeft < 0 ? `${-ev.daysLeft}日超過` : ev.daysLeft === 0 ? '今日' : `${ev.daysLeft}日後`}
                      </p>
                      <p className="cp-meta">{ev.date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}</p>
                    </div>
                    <div className="flex-1">
                      <p className="cp-h4">{ev.brand} — {ev.type}</p>
                      <p className="cp-meta">{DEAL_STAGE_META[ev.stage].emoji} {DEAL_STAGE_META[ev.stage].label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 交渉センター */}
          {tab === 'negotiate' && (
            <div className="space-y-4">
              <div className="cp-card">
                <p className="cp-h4 mb-3">交渉メッセージ生成</p>
                <div className="space-y-2">
                  <select className="cp-input w-full" value={selectedDealId} onChange={e => setSelectedDealId(e.target.value)}>
                    <option value="">— 案件を選択 —</option>
                    {myDeals.map(d => <option key={d.id} value={d.id}>{d.brandName} ({DEAL_STAGE_META[d.stage].label})</option>)}
                  </select>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(NEGOTIATION_TYPE_META).map(([k, v]) => (
                      <button key={k} onClick={() => setNegoType(k as NegotiationType)}
                        className="cp-btn cp-btn-sm text-left p-2"
                        style={{
                          background: negoType === k ? persona.accentColor : 'transparent',
                          color: negoType === k ? '#0a0a0f' : undefined,
                          border: '1px solid var(--border)',
                          borderColor: negoType === k ? persona.accentColor : 'var(--border)',
                        }}>
                        <span className="text-base">{v.emoji}</span> {v.label}
                      </button>
                    ))}
                  </div>

                  {negoType === 'rate-counter' && (
                    <input className="cp-input w-full" type="number" placeholder="希望報酬 (税抜・円)"
                      value={targetFee} onChange={e => setTargetFee(e.target.value)} />
                  )}
                  <textarea className="cp-input w-full" rows={2}
                    placeholder="追加指示 (例: 修正回数2回まで明記したい)"
                    value={customNote} onChange={e => setCustomNote(e.target.value)} />

                  <div className="flex gap-2">
                    <button onClick={handleGenerateNego} disabled={busy || !selectedDealId}
                      className="cp-btn cp-btn-primary"
                      style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                      {busy ? '生成中…' : '✨ 交渉文を生成'}
                    </button>
                    <button onClick={handleEvaluate} disabled={busy || !selectedDealId} className="cp-btn cp-btn-secondary">
                      {busy ? '判定中…' : '💴 報酬の妥当性をチェック'}
                    </button>
                  </div>

                  {evalResult && (
                    <div className="cp-card mt-2" style={{ background: 'var(--surface-3)' }}>
                      <p className="cp-h4">
                        判定: <span style={{ color: evalResult.verdict === 'accept' ? '#4ADE80' : evalResult.verdict === 'counter' ? '#FFA94D' : '#F87171' }}>
                          {evalResult.verdict === 'accept' ? '受諾OK' : evalResult.verdict === 'counter' ? 'カウンター推奨' : '辞退推奨'}
                        </span>
                      </p>
                      <p className="cp-meta mt-1">妥当レンジ: ¥{evalResult.fairFee.min.toLocaleString()} 〜 ¥{evalResult.fairFee.max.toLocaleString()}</p>
                      <p className="cp-body mt-2 whitespace-pre-wrap">{evalResult.reason}</p>
                      {evalResult.counterScript && (
                        <p className="cp-body mt-2 italic" style={{ color: persona.accentColor }}>
                          → {evalResult.counterScript}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 過去の交渉文 */}
              <div className="space-y-2">
                <p className="cp-h4">📚 生成済み交渉文</p>
                {desk.negos.filter(n => myDeals.some(d => d.id === n.dealId)).slice(0, 20).map(n => {
                  const d = myDeals.find(dd => dd.id === n.dealId);
                  if (!d) return null;
                  const meta = NEGOTIATION_TYPE_META[n.type];
                  return (
                    <div key={n.id} className="cp-card">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="cp-h4">{meta.emoji} {meta.label} — {d.brandName}</p>
                        <div className="flex gap-2">
                          {n.successProbability !== undefined && <span className="cp-pill">成立予測 {n.successProbability}%</span>}
                          <button
                            onClick={() => negoCopy.copy((n.subject ? `件名: ${n.subject}\n\n` : '') + n.body, '交渉文')}
                            data-copied={negoCopy.copied}
                            className="cp-btn cp-btn-ghost cp-btn-sm cp-copy-btn"
                          >{negoCopy.copied ? '✓ コピーしました' : '📋 コピー'}</button>
                          <button onClick={() => desk.removeNego(n.id)} className="cp-btn cp-btn-ghost cp-btn-sm">🗑</button>
                        </div>
                      </div>
                      {n.subject && <p className="cp-meta mt-1">件名: {n.subject}</p>}
                      <pre className="cp-body whitespace-pre-wrap mt-2" style={{ fontFamily: 'inherit' }}>{n.body}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 投稿下書き */}
          {tab === 'draft' && (
            <div className="space-y-4">
              <div className="cp-card">
                <p className="cp-h4 mb-3">投稿下書きを AI 生成</p>
                <select className="cp-input w-full mb-2" value={draftDealId} onChange={e => setDraftDealId(e.target.value)}>
                  <option value="">— 案件を選択 —</option>
                  {myDeals.map(d => <option key={d.id} value={d.id}>{d.brandName} ({PLATFORM_META[d.platform].label} / {CONTENT_TYPE_META[d.contentType]})</option>)}
                </select>
                <input className="cp-input w-full mb-2" placeholder="トーン (例: 親しみやすく / クール / 詩的)" value={toneNote} onChange={e => setToneNote(e.target.value)} />
                <button onClick={handleGenerateDraft} disabled={busy || !draftDealId}
                  className="cp-btn cp-btn-primary"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy ? '生成中…' : '✨ 下書きを作る'}
                </button>
              </div>

              <div className="space-y-2">
                {myDeals.filter(d => d.draftCopy).map(d => (
                  <div key={d.id} className="cp-card">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="cp-h4">{PLATFORM_META[d.platform].emoji} {d.brandName}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => draftCopy.copy(d.draftCopy || '', '下書き')}
                          data-copied={draftCopy.copied}
                          className="cp-btn cp-btn-ghost cp-btn-sm cp-copy-btn"
                        >{draftCopy.copied ? '✓ コピーしました' : '📋 コピー'}</button>
                        <button onClick={() => desk.updateDeal(d.id, { stage: 'draft-submitted' })} className="cp-btn cp-btn-ghost cp-btn-sm">📤 提出済みにする</button>
                      </div>
                    </div>
                    <pre className="cp-body whitespace-pre-wrap mt-2" style={{ fontFamily: 'inherit' }}>{d.draftCopy}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* レポート */}
          {tab === 'report' && (
            <div className="space-y-4">
              <div className="cp-card">
                <p className="cp-h4 mb-3">投稿後レポート (ブランド納品用)</p>
                <select className="cp-input w-full mb-2" value={reportDealId} onChange={e => setReportDealId(e.target.value)}>
                  <option value="">— 案件を選択 —</option>
                  {myDeals.filter(d => ['posted','approved','reported','closed'].includes(d.stage)).map(d => <option key={d.id} value={d.id}>{d.brandName}</option>)}
                </select>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {[
                    ['reach', 'リーチ'], ['impressions', 'インプレッション'], ['engagementRate', 'ER (%)'],
                    ['likes', 'いいね'], ['comments', 'コメント'], ['saves', '保存'],
                    ['shares', 'シェア'], ['views', '再生数'], ['clicks', 'クリック'],
                  ].map(([k, label]) => (
                    <input key={k} className="cp-input" type="number" placeholder={label}
                      value={(reportMetrics as any)[k] || ''}
                      onChange={e => setReportMetrics({ ...reportMetrics, [k]: Number(e.target.value) || undefined })} />
                  ))}
                </div>
                <textarea className="cp-input w-full mt-2" rows={2} placeholder="自分の振り返り (任意)" value={reflection} onChange={e => setReflection(e.target.value)} />
                <button onClick={handleGenerateReport} disabled={busy || !reportDealId}
                  className="cp-btn cp-btn-primary mt-2"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  {busy ? '生成中…' : '✨ レポートを書く'}
                </button>
              </div>

              {reportOut && (
                <div className="cp-card">
                  <p className="cp-meta italic">サマリー: {reportOut.summary}</p>
                  <pre className="cp-body whitespace-pre-wrap mt-2" style={{ fontFamily: 'inherit' }}>{reportOut.markdown}</pre>
                  <button
                    onClick={() => reportCopy.copy(reportOut.markdown, 'レポート Markdown')}
                    data-copied={reportCopy.copied}
                    className="cp-btn cp-btn-secondary cp-btn-sm cp-copy-btn mt-2"
                  >{reportCopy.copied ? '✓ コピーしました' : '📋 Markdown をコピー'}</button>
                </div>
              )}
            </div>
          )}

          {/* メディアキット */}
          {tab === 'kit' && (
            <div className="space-y-3">
              <p className="cp-h3">📇 メディアキット</p>
              <p className="cp-meta">この情報は AI が交渉文・下書き・レポート生成時に常に参照します。</p>

              <div className="cp-card space-y-2">
                <input className="cp-input w-full" placeholder="表示名 (例: @user_name)"
                  value={kitDraft.handleName || ''} onChange={e => setKitDraft({ ...kitDraft, handleName: e.target.value })} />

                <p className="cp-h4 mt-2">フォロワー数</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['instagram','tiktok','youtube','x','threads','note'] as Platform[]).map(p => (
                    <input key={p} className="cp-input" type="number"
                      placeholder={`${PLATFORM_META[p].label}`}
                      value={kitDraft.followers?.[p] || ''}
                      onChange={e => setKitDraft({
                        ...kitDraft,
                        followers: { ...(kitDraft.followers || {}), [p]: Number(e.target.value) || undefined },
                      })} />
                  ))}
                </div>

                <p className="cp-h4 mt-2">平均エンゲージメント率 (%)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['instagram','tiktok','youtube','x'] as Platform[]).map(p => (
                    <input key={p} className="cp-input" type="number" step="0.1"
                      placeholder={`${PLATFORM_META[p].label}`}
                      value={kitDraft.avgEngagementRate?.[p] || ''}
                      onChange={e => setKitDraft({
                        ...kitDraft,
                        avgEngagementRate: { ...(kitDraft.avgEngagementRate || {}), [p]: Number(e.target.value) || undefined },
                      })} />
                  ))}
                </div>

                <input className="cp-input w-full" type="number" placeholder="月間平均リーチ"
                  value={kitDraft.monthlyReach || ''}
                  onChange={e => setKitDraft({ ...kitDraft, monthlyReach: Number(e.target.value) || undefined })} />

                <textarea className="cp-input w-full" rows={2} placeholder="主なオーディエンス層 (例: 25-34歳女性、東京、美容感度高)"
                  value={kitDraft.audienceProfile || ''} onChange={e => setKitDraft({ ...kitDraft, audienceProfile: e.target.value })} />

                <textarea className="cp-input w-full" rows={2} placeholder="希望報酬レンジ (例: フィード1本5万円〜・リール8万円〜)"
                  value={kitDraft.rateCard || ''} onChange={e => setKitDraft({ ...kitDraft, rateCard: e.target.value })} />

                <textarea className="cp-input w-full" rows={2} placeholder="ブランド観・NG事項 (例: 健康食品・タバコ系はNG / 過度な誇張表現はNG)"
                  value={kitDraft.brandValues || ''} onChange={e => setKitDraft({ ...kitDraft, brandValues: e.target.value })} />

                <textarea className="cp-input w-full" rows={3} placeholder="過去の代表案件 (3-5件)"
                  value={kitDraft.caseHistory || ''} onChange={e => setKitDraft({ ...kitDraft, caseHistory: e.target.value })} />

                <div className="flex gap-2">
                  <select className="cp-input" value={kitDraft.entity || 'individual'} onChange={e => setKitDraft({ ...kitDraft, entity: e.target.value as 'individual' | 'corporate' })}>
                    <option value="individual">個人事業主</option>
                    <option value="corporate">法人</option>
                  </select>
                  <input className="cp-input flex-1" placeholder="屋号・会社名 (請求書発行用)"
                    value={kitDraft.legalName || ''} onChange={e => setKitDraft({ ...kitDraft, legalName: e.target.value })} />
                </div>

                <button onClick={saveKit} className="cp-btn cp-btn-primary"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                  💾 メディアキットを保存
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
