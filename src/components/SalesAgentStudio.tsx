import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import { useSalesAgent } from '../hooks/useSalesAgent';
import { pickTodaysCompanies, type AiPick } from '../lib/salesAgentMatch';
import { todaySeed } from '../data/companies-jp';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Tab = 'today' | 'history' | 'product';

interface CachedPicks {
  seed: number;
  personaId: string;
  picks: AiPick[];
  approvedIds: string[];   // 採用済の companyId
  rejectedIds: string[];   // 却下済の companyId
}

const CACHE_KEY = 'core_sales_today_picks_v2';

function loadCache(): CachedPicks | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveCache(c: CachedPicks) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}

const SIZE_LABEL: Record<AiPick['size'], string> = {
  large: '大手',
  mid: '中堅',
  startup: 'スタートアップ',
};

export default function SalesAgentStudio({ persona, settings, onClose }: Props) {
  const sa = useSalesAgent();
  const [tab, setTab] = useState<Tab>('today');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pick' | 'edit' | null>(null);

  const ownProduct = sa.getOwnProduct(persona.id);
  const myLeads = useMemo(() => sa.getLeadsForPersona(persona.id), [sa.leads, persona.id]);

  // ─── 今日のピックアップ ─────────
  const [picks, setPicks] = useState<AiPick[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  // 起動時にキャッシュから復元 (同じ日 & 同じペルソナのみ)
  useEffect(() => {
    const cache = loadCache();
    const seed = todaySeed();
    if (cache && cache.seed === seed && cache.personaId === persona.id) {
      setPicks(cache.picks);
      setApprovedIds(cache.approvedIds || []);
      setRejectedIds(cache.rejectedIds || []);
    } else {
      setPicks([]);
      setApprovedIds([]);
      setRejectedIds([]);
    }
  }, [persona.id]);

  // 状態が変わったらキャッシュへ
  useEffect(() => {
    if (picks.length === 0) return;
    saveCache({
      seed: todaySeed(),
      personaId: persona.id,
      picks,
      approvedIds,
      rejectedIds,
    });
  }, [picks, approvedIds, rejectedIds, persona.id]);

  // ─── AI に「今日の 5 社」を選ばせる ──────────
  const runPick = useCallback(async (replace: boolean) => {
    if (!ownProduct?.trim()) {
      setTab('product');
      setError('まず自社の商材タブで「うちの商品・サービス」を登録してね');
      return;
    }
    setBusy('pick'); setError(null);
    try {
      const exclude = replace ? [...approvedIds, ...rejectedIds, ...picks.map(p => p.companyId)] : [...approvedIds, ...rejectedIds];
      const result = await pickTodaysCompanies({
        settings,
        persona,
        ownProduct,
        excludeIds: exclude,
      });
      if (replace) {
        setPicks(result);
      } else {
        setPicks(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [ownProduct, settings, persona, approvedIds, rejectedIds, picks]);

  // ─── 承認 → リード追加 + アプローチ下書き保存 ──────────
  const handleApprove = useCallback((pick: AiPick) => {
    // 重複防止: 同じ companyId が既に承認済なら何もしない
    if (approvedIds.includes(pick.companyId)) return;
    // 1) リード追加
    const lead = sa.addLead(persona.id, {
      companyName: pick.companyName,
      contactName: '担当者様',
      contactRole: '',
      notes: `AI ピックアップ: ${pick.reason}`,
      score: pick.matchScore,
      scoreReason: pick.reason,
      stage: 'approached',
      source: 'ai-pick',
    });
    // 2) アプローチ (メール下書き) 保存 → シャドー秘書がここから処理
    sa.addApproach({
      leadId: lead.id,
      type: 'email',
      subject: pick.emailSubject,
      body: pick.emailBody,
      tone: '先回り提案',
      hitProbability: pick.matchScore,
      status: 'draft',
      generatedAt: new Date().toISOString(),
    });
    setApprovedIds(prev => [...prev, pick.companyId]);
  }, [sa, persona.id, approvedIds]);

  const handleReject = useCallback((pick: AiPick) => {
    setRejectedIds(prev => [...prev, pick.companyId]);
  }, []);

  const startEdit = useCallback((pick: AiPick) => {
    setEditingId(pick.companyId);
    setEditDraft({ subject: pick.emailSubject, body: pick.emailBody });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    setPicks(prev => prev.map(p =>
      p.companyId === editingId
        ? { ...p, emailSubject: editDraft.subject.trim(), emailBody: editDraft.body.trim() }
        : p
    ));
    setEditingId(null);
  }, [editingId, editDraft]);

  // 表示用: 却下/承認したものは出さない
  const visiblePicks = useMemo(
    () => picks.filter(p => !approvedIds.includes(p.companyId) && !rejectedIds.includes(p.companyId)),
    [picks, approvedIds, rejectedIds]
  );

  // ─── 自社の商材タブ ──────
  const [productDraft, setProductDraft] = useState(ownProduct);
  useEffect(() => setProductDraft(ownProduct), [ownProduct]);
  const saveProduct = () => {
    sa.setOwnProduct(persona.id, productDraft);
    setError(null);
  };

  // ─── 履歴タブ: 採用済リードと送信履歴 ──────
  const approvedLeadCount = myLeads.filter(l => l.source === 'ai-pick').length;
  const draftCount = sa.approaches.filter(a => myLeads.some(l => l.id === a.leadId)).length;

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
              <p className="cp-meta truncate">AI が今日の 5 社を選び、提案文まで先回りで用意します</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        <div className="cp-modal-tabs">
          {([
            { id: 'today',   emoji: '✨', label: '今日の5社' },
            { id: 'history', emoji: '📂', label: `採用済 (${approvedLeadCount})` },
            { id: 'product', emoji: '🎁', label: '自社の商材' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
              className="cp-modal-tab" data-active={tab === t.id}
              style={{ color: tab === t.id ? persona.accentColor : undefined, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          {error && (
            <div className="rounded-md p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* ─── 今日のピックアップ ─── */}
          {tab === 'today' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div className="min-w-0">
                    <p className="cp-h3">✨ AI が選んだ 今日の 5 社</p>
                    <p className="cp-meta">
                      あなたの「自社の商材」をもとに、日本企業 {300}+ 社の中から AI が先回りで選びました。
                      気に入ったら ✓ 承認、違うなと思ったら ✗ 却下、文面を直したいときは ✏️ で。
                    </p>
                  </div>
                  <div className="cp-row" style={{ gap: 6, flexShrink: 0 }}>
                    <button onClick={() => runPick(false)} disabled={busy === 'pick'}
                      className="cp-btn cp-btn-primary"
                      style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                      {busy === 'pick'
                        ? '🧠 AI が選定中…'
                        : picks.length === 0 ? '✨ 今日の 5 社を選んでもらう' : '🔄 もう一度選び直す'}
                    </button>
                  </div>
                </div>
                {!ownProduct?.trim() && (
                  <p className="cp-tiny" style={{ color: '#FBBF24' }}>
                    まだ自社の商材が未登録です。「🎁 自社の商材」タブで一度だけ書いておくと、毎日 AI が自動で合う企業を探します。
                  </p>
                )}
              </div>

              {/* 5 社カード */}
              {visiblePicks.length === 0 && picks.length === 0 && (
                <div className="cp-empty">
                  <p className="cp-empty-icon">🎯</p>
                  <p>まだピックアップがありません</p>
                  <p className="cp-meta">右上の「✨ 今日の 5 社を選んでもらう」を押してね</p>
                </div>
              )}

              {visiblePicks.length === 0 && picks.length > 0 && (
                <div className="cp-empty">
                  <p className="cp-empty-icon">🎉</p>
                  <p>今日の 5 社、全部さばき終わりました</p>
                  <p className="cp-meta">「🔄 もう一度選び直す」で次の候補を出せます</p>
                </div>
              )}

              <AnimatePresence>
                {visiblePicks.map((p, idx) => {
                  const isEditing = editingId === p.companyId;
                  return (
                    <motion.div
                      key={p.companyId}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: -20 }}
                      transition={{ delay: idx * 0.06 }}
                      className="cp-card-section cp-stack-sm"
                      style={{ borderColor: persona.accentColor + '30' }}
                    >
                      {/* ヘッダー */}
                      <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div className="cp-row min-w-0" style={{ gap: 10 }}>
                          <div
                            className="rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              width: 44, height: 44,
                              background: `linear-gradient(135deg, ${persona.accentColor}33, ${persona.accentColor}11)`,
                              color: persona.accentColor,
                              fontWeight: 700,
                              fontSize: '1.1rem',
                              border: `1px solid ${persona.accentColor}44`,
                            }}
                          >
                            {p.companyName.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <p className="cp-h3 truncate">{p.companyName}</p>
                            <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <span className="cp-pill" style={{ borderColor: persona.accentColor, color: persona.accentColor }}>
                                {p.industry}
                              </span>
                              <span className="cp-pill">{SIZE_LABEL[p.size]}</span>
                              <span className="cp-pill">{p.region}</span>
                            </div>
                          </div>
                        </div>
                        <div className="cp-row" style={{ flexShrink: 0 }}>
                          <span className="cp-pill" style={{
                            color: p.matchScore >= 80 ? '#10B981' : p.matchScore >= 60 ? '#F59E0B' : '#9088A8',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                          }}>
                            合致度 {p.matchScore}
                          </span>
                        </div>
                      </div>

                      {/* 理由 */}
                      <div className="cp-card" style={{ background: persona.accentColorLight, borderColor: persona.accentColor + '55' }}>
                        <p className="cp-tiny" style={{ color: persona.accentColor }}>🤔 AI がこの企業を選んだ理由</p>
                        <p className="cp-body" style={{ color: 'var(--fg)' }}>{p.reason}</p>
                      </div>

                      {/* 提案文プレビュー / 編集 */}
                      {!isEditing ? (
                        <div className="cp-stack-sm">
                          <p className="cp-tiny">📧 提案文ドラフト</p>
                          <div className="cp-card">
                            <p className="cp-meta" style={{ marginBottom: 6 }}>件名: <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{p.emailSubject}</span></p>
                            <pre className="cp-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{p.emailBody}</pre>
                          </div>
                        </div>
                      ) : (
                        <div className="cp-stack-sm">
                          <p className="cp-tiny">✏️ 文面を直す</p>
                          <input value={editDraft.subject} onChange={e => setEditDraft({ ...editDraft, subject: e.target.value })}
                            placeholder="件名" className="cp-input" />
                          <textarea value={editDraft.body} onChange={e => setEditDraft({ ...editDraft, body: e.target.value })}
                            rows={8} className="cp-textarea" />
                          <div className="cp-row" style={{ gap: 6 }}>
                            <button onClick={saveEdit} className="cp-btn cp-btn-primary"
                              style={{ background: persona.accentColor, color: '#0a0a0f' }}>保存</button>
                            <button onClick={() => setEditingId(null)} className="cp-btn cp-btn-ghost">取消</button>
                          </div>
                        </div>
                      )}

                      {/* 操作 3 ボタン */}
                      {!isEditing && (
                        <div className="cp-row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => handleReject(p)}
                            className="cp-btn cp-btn-ghost cp-btn-sm">✗ 却下</button>
                          <button onClick={() => startEdit(p)}
                            className="cp-btn cp-btn-sm">✏️ 直す</button>
                          <button onClick={() => handleApprove(p)}
                            className="cp-btn cp-btn-primary cp-btn-sm"
                            style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                            ✓ 承認 → メール下書きを保存
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {/* ─── 採用済リード ─── */}
          {tab === 'history' && (
            <>
              <div className="cp-card-section">
                <p className="cp-h3">📂 採用済のリード</p>
                <p className="cp-meta">
                  「✓ 承認」したものはここに溜まります。メール下書きは {draftCount} 件保存中。
                  シャドー秘書 (毎朝の自動チェック) がこの一覧から優先度の高い相手に動きます。
                </p>
              </div>

              <div className="cp-stack-sm">
                {myLeads.length === 0 ? (
                  <div className="cp-empty">
                    <p className="cp-empty-icon">📭</p>
                    <p>まだ採用したリードはありません</p>
                    <p className="cp-meta">「✨ 今日のピックアップ」タブで AI が選んだ企業を承認すると、ここに追加されます</p>
                  </div>
                ) : myLeads.map(l => {
                  const drafts = sa.approaches.filter(a => a.leadId === l.id);
                  return (
                    <div key={l.id} className="cp-card cp-stack-sm">
                      <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div className="min-w-0">
                          <p className="cp-h3 truncate">{l.companyName}</p>
                          {l.scoreReason && (
                            <p className="cp-meta" style={{ textTransform: 'none' }}>{l.scoreReason}</p>
                          )}
                        </div>
                        <div className="cp-row" style={{ flexShrink: 0 }}>
                          <span className="cp-pill" style={{
                            color: l.score >= 80 ? '#10B981' : l.score >= 60 ? '#F59E0B' : '#9088A8',
                            fontWeight: 600,
                          }}>合致度 {l.score}</span>
                          <button onClick={() => sa.removeLead(l.id)} className="cp-btn cp-btn-ghost cp-btn-sm">削除</button>
                        </div>
                      </div>
                      {drafts.length > 0 && (
                        <div className="cp-stack-sm">
                          {drafts.slice(0, 1).map(a => (
                            <div key={a.id} className="cp-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <p className="cp-meta" style={{ marginBottom: 4 }}>件名: <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{a.subject}</span></p>
                              <pre className="cp-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.85rem' }}>{a.body}</pre>
                              <div className="cp-row" style={{ gap: 6, marginTop: 8 }}>
                                <button onClick={() => navigator.clipboard.writeText(`${a.subject}\n\n${a.body}`)}
                                  className="cp-btn cp-btn-sm">📋 コピー</button>
                                <button onClick={() => sa.updateApproach(a.id, { status: 'sent' })}
                                  className="cp-btn cp-btn-sm">送信済にする</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── 自社の商材 ─── */}
          {tab === 'product' && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">🎁 自社の商材を登録</p>
              <p className="cp-meta">
                この情報をもとに AI が「合う企業」を毎日先回りで選びます。
                何を売っていて、誰に向けて、どう刺さるかを 5〜10 行で。詳しいほど精度が上がります。
              </p>
              <textarea value={productDraft} onChange={e => setProductDraft(e.target.value)}
                placeholder={`例:\n弊社の商材: 飲食店向け予約管理 SaaS\n価格: 月¥9,800〜\nコア機能: 予約一元管理 / 顧客LTV分析 / LINE自動配信\nターゲット: 月50万円以上の売上がある飲食店\n強み: 月の客単価が3,500円以上の店で、リピート率を平均15%向上した実績`}
                rows={10} className="cp-textarea" />
              <button onClick={saveProduct} className="cp-btn cp-btn-primary"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                保存
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
