// ============================================================
// OwnerBriefModal — オーナー専用 「今日 やるべき 3 件」 モーダル
//
// オーナー指示 (2026-06-04 第 45 波 TTTTTT):
//   /api/master/owner-brief を 叩いて 即時 表示。
//   MasterEntry の ボタン から 1 タップで開く。
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RefreshCw, AlertCircle, Target } from 'lucide-react';

interface Kpi {
  revenueToday: number;
  mrr: number;
  churnPct: number;
  onboardCompletionPct: number;
  errors24h: number;
}
interface Todo { title: string; why: string; action: string; cxo?: string; }
interface Resp { ok: boolean; asOf: string; kpi: Kpi; todos: Todo[]; source: string; note?: string; }

interface Props {
  open: boolean;
  onClose: () => void;
}

function yen(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

export default function OwnerBriefModal({ open, onClose }: Props) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setErr(null);
    const key = (typeof window !== 'undefined' && localStorage.getItem('core_master_key')) || 'GAUCHE2026';
    fetch('/api/master/owner-brief', { headers: { 'x-master-key': key } })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          throw new Error(t || `HTTP ${r.status}`);
        }
        return r.json() as Promise<Resp>;
      })
      .then(setData)
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (open && !data) load(); /* eslint-disable-next-line */ }, [open]);

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
            background: 'rgba(0,0,12,0.7)',
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
              width: 'min(620px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: 'rgba(15,14,27,0.98)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: 20,
              color: '#fff',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.14), rgba(249,115,22,0.10))',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, #FBBF24, #F97316)',
                color: '#1a0a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 22,
              }}>☀️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#FBBF24', fontWeight: 800 }}>OWNER BRIEF</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>今日 やるべき 3 件</div>
                {data && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                    {data.source === 'ai' ? '🤖 AI 要約' : '📋 ルール fallback'} · {new Date(data.asOf).toLocaleString('ja-JP')}
                  </div>
                )}
              </div>
              <button onClick={load} disabled={loading} title="再取得" style={{
                width: 32, height: 32, borderRadius: 16,
                background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /></button>
              <button onClick={onClose} aria-label="閉じる" style={{
                width: 30, height: 30, borderRadius: 15,
                background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}><X size={14} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {err && (
                <div style={{
                  padding: 12, borderRadius: 10,
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                  color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 14,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertCircle size={14} /> 取得失敗: {err}
                </div>
              )}

              {data && (
                <>
                  {/* KPI 5 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8,
                    marginBottom: 18,
                  }}>
                    <Kpi label="今日 売上" value={yen(data.kpi.revenueToday)} color="#34D399" />
                    <Kpi label="MRR" value={yen(data.kpi.mrr)} color="#22D3EE" />
                    <Kpi label="解約率" value={`${data.kpi.churnPct}%`} color={data.kpi.churnPct > 5 ? '#F87171' : '#34D399'} />
                    <Kpi label="オンボ完了" value={`${data.kpi.onboardCompletionPct}%`} color={data.kpi.onboardCompletionPct < 60 ? '#FBBF24' : '#34D399'} />
                    <Kpi label="エラー" value={String(data.kpi.errors24h)} color={data.kpi.errors24h > 10 ? '#F87171' : '#94A3B8'} />
                  </div>

                  {/* Todos */}
                  <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 800, marginBottom: 8 }}>
                    今日 30 分以内 に やる
                  </div>
                  {data.todos.length === 0 && (
                    <div style={{ padding: 14, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                      🎉 とくに 急ぎは ありません — のんびり 行きましょう。
                    </div>
                  )}
                  {data.todos.map((t, i) => (
                    <div key={i} style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(251,191,36,0.25)',
                      marginBottom: 10,
                      borderLeft: '3px solid #FBBF24',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#FBBF24', fontWeight: 800, letterSpacing: '0.18em' }}>#{i + 1}</span>
                        {t.cxo && (
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 999,
                            background: 'rgba(167,139,250,0.18)', color: '#A78BFA', fontWeight: 800,
                          }}>{t.cxo}</span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '4px 0 4px', lineHeight: 1.4 }}>
                        {t.title}
                      </h3>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                        <strong style={{ color: 'rgba(255,255,255,0.85)' }}>なぜ:</strong> {t.why}
                      </div>
                      <div style={{
                        marginTop: 8,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(251,191,36,0.08)',
                        color: '#fde68a',
                        fontSize: '0.82rem', lineHeight: 1.7,
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                      }}>
                        <Target size={12} style={{ flexShrink: 0, marginTop: 4 }} />
                        <span><strong>アクション:</strong> {t.action}</span>
                      </div>
                    </div>
                  ))}

                  {data.note && (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                      ⓘ {data.note}
                    </div>
                  )}
                </>
              )}

              {!data && !err && loading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: '0.86rem' }}>
                  <Sparkles size={20} style={{ animation: 'spin 2s linear infinite', marginBottom: 6 }} /><br />
                  KPI を 取得 + AI 要約 中…
                </div>
              )}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 3 }}>{value}</div>
    </div>
  );
}
