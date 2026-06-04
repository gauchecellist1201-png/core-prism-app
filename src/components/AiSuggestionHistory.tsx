// ============================================================
// AiSuggestionHistory — 7 日分の AI 提案 履歴 モーダル
//
// オーナー指示 (2026-06-04 第 31 波 DDDDD):
//   各 CXO が出した提案を 時系列に並べ、「採用 / 却下 / 保留」を
//   ワンタップで記録 (localStorage)。7 日 採用率を Insights として表示。
//
// データソース: src/lib/aiSuggestionLog.ts
//   - 他コンポーネント (AgentTeamMonitor 等) は logSuggestion() で記録
//   - 本モーダルは setStatus() で 採用 / 却下 / 保留 を切替
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, Check, X as XIcon, Pause, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import {
  listSuggestions,
  setStatus,
  statsForLastDays,
  removeSuggestion,
  type SuggestionEntry,
  type SuggestionStatus,
} from '../lib/aiSuggestionLog';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_META: Record<SuggestionStatus, { label: string; color: string; bg: string; emoji: string }> = {
  pending:  { label: '保留中',  color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', emoji: '⌛' },
  adopted:  { label: '採用',    color: '#34D399', bg: 'rgba(52,211,153,0.18)',  emoji: '✅' },
  rejected: { label: '却下',    color: '#F87171', bg: 'rgba(248,113,113,0.18)', emoji: '❌' },
  held:     { label: '保留',    color: '#FBBF24', bg: 'rgba(251,191,36,0.18)',  emoji: '⏸' },
};

export default function AiSuggestionHistory({ open, onClose }: Props) {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<'all' | SuggestionStatus>('all');

  // localStorage 変更を購読
  useEffect(() => {
    const onUp = () => setTick((t) => t + 1);
    window.addEventListener('core:ai-suggestion-updated', onUp);
    return () => window.removeEventListener('core:ai-suggestion-updated', onUp);
  }, []);

  // 全件取得 → 7 日 でクリップ + フィルタ
  const items: SuggestionEntry[] = useMemo(() => {
    void tick;
    const all = listSuggestions();
    const since = Date.now() - 7 * 86400_000;
    const recent = all.filter((s) => s.ts >= since);
    if (filter === 'all') return recent;
    return recent.filter((s) => s.status === filter);
  }, [tick, filter]);

  const stats = useMemo(() => {
    void tick;
    return statsForLastDays(7);
  }, [tick]);

  const onChange = (id: string, status: SuggestionStatus) => {
    setStatus(id, status);
    setTick((t) => t + 1);
  };
  const onRemove = (id: string) => {
    if (confirm('この提案を削除しますか?')) {
      removeSuggestion(id);
      setTick((t) => t + 1);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 110,
            background: 'rgba(0,0,12,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: 'rgba(15,14,27,0.98)',
              border: '1px solid rgba(99,102,241,0.45)',
              borderRadius: 20,
              color: '#fff',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(99,102,241,0.16), transparent)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366F1, #A855F7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}><History size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#A855F7', fontWeight: 800 }}>AI SUGGESTIONS · 7 DAYS</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>提案 履歴 と 採用率</div>
              </div>
              <button onClick={onClose} aria-label="閉じる" style={{
                width: 30, height: 30, borderRadius: 15,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}><X size={14} /></button>
            </div>

            {/* Insights */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10,
            }}>
              <Kpi label="採用率" value={`${stats.adoptionRate}%`} color="#34D399" icon={<TrendingUp size={12} />} />
              <Kpi label="採用" value={String(stats.adopted)} color="#34D399" />
              <Kpi label="却下" value={String(stats.rejected)} color="#F87171" />
              <Kpi label="保留" value={String(stats.held)} color="#FBBF24" />
              <Kpi label="未判定" value={String(stats.pending)} color="#94A3B8" />
              <Kpi label="合計" value={String(stats.total)} color="#A855F7" />
            </div>

            {/* CXO 別 採用率 (上位 5) */}
            {stats.byCxo.length > 0 && (
              <div style={{
                padding: '8px 20px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 6 }}>CXO 別 採用率 (上位 5)</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats.byCxo.slice(0, 5).map((c) => (
                    <div key={c.key} title={`${c.adopted}/${c.count}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: 12,
                    }}>
                      <span>{c.emoji}</span>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{c.name}</span>
                      <span style={{ color: '#34D399', fontWeight: 800, marginLeft: 4 }}>{c.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter chips */}
            <div style={{
              padding: '10px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
            }}>
              {(['all', 'pending', 'adopted', 'rejected', 'held'] as const).map((f) => {
                const isActive = filter === f;
                const lbl = f === 'all' ? '全部' : STATUS_META[f].label;
                const color = f === 'all' ? '#A855F7' : STATUS_META[f].color;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '5px 12px', borderRadius: 999,
                      border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                      background: isActive ? `${color}22` : 'transparent',
                      color: isActive ? color : 'rgba(255,255,255,0.7)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >{lbl}</button>
                );
              })}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {items.length} 件 表示中
              </span>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 14px' }}>
              {items.length === 0 ? (
                <div style={{ padding: '36px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
                  まだ 直近 7 日 に 提案がありません。<br />
                  ダッシュボードで AI 役員 から 提案を受け取ると ここに自動で並びます。
                </div>
              ) : (
                items.map((s) => {
                  const meta = STATUS_META[s.status];
                  return (
                    <div key={s.id} style={{
                      margin: '6px 4px',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${meta.color}22`,
                      borderLeft: `3px solid ${meta.color}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ fontSize: 18, flexShrink: 0 }}>{s.cxoEmoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: '0.05em' }}>
                              {s.cxoName}
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>·</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{ago(s.ts)}</span>
                            <span style={{
                              marginLeft: 'auto',
                              fontSize: 10, padding: '2px 8px', borderRadius: 999,
                              background: meta.bg, color: meta.color, fontWeight: 800,
                            }}>{meta.emoji} {meta.label}</span>
                          </div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: 4, lineHeight: 1.4 }}>{s.title}</div>
                          {s.detail && (
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.6 }}>
                              {s.detail}
                            </div>
                          )}
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                            <ActionBtn label="採用" icon={<Check size={11} />} color="#34D399"
                              active={s.status === 'adopted'} onClick={() => onChange(s.id, 'adopted')} />
                            <ActionBtn label="却下" icon={<XIcon size={11} />} color="#F87171"
                              active={s.status === 'rejected'} onClick={() => onChange(s.id, 'rejected')} />
                            <ActionBtn label="保留" icon={<Pause size={11} />} color="#FBBF24"
                              active={s.status === 'held'} onClick={() => onChange(s.id, 'held')} />
                            <ActionBtn label="未判定" icon={<RefreshCw size={11} />} color="#94A3B8"
                              active={s.status === 'pending'} onClick={() => onChange(s.id, 'pending')} />
                            <button onClick={() => onRemove(s.id)} title="削除" style={{
                              marginLeft: 'auto', padding: '4px 8px',
                              borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                              background: 'transparent', color: 'rgba(255,255,255,0.4)',
                              cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                            }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 18px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              fontSize: 11, color: 'rgba(255,255,255,0.5)',
            }}>
              提案は <code style={{ color: 'rgba(255,255,255,0.7)' }}>localStorage</code> に保存 (端末ローカル)。
              直近 7 日 のみ表示。最大 200 件で古い物から自動削除。
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{
        fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>{icon} {label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, icon, color, active, onClick }: { label: string; icon: React.ReactNode; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 8,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'rgba(255,255,255,0.65)',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >{icon} {label}</button>
  );
}

function ago(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min} 分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 時間前`;
  const d = Math.floor(h / 24);
  return `${d} 日前`;
}
