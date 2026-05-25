// ============================================================
// DailyReport — 今日の総括レポート モーダル
//
// オーナー指示 (2026-05-25 爆速モード):
//   「稼げるビジョン / 楽できるビジョンが浮かぶまで」
//   1 日の終わりに「今日 ◯◯ 円稼いだ / AI が ◯ 件やってくれた /
//   明日はこれをやる」が 1 枚で見えれば価値の手応えが残る。
//
// 中身:
//   1. ヘッダ (YYYY 年 MM 月 DD 日 (曜日) の総括)
//   2. 今日の数字 3 連 (緑: 売上 / 紫: AI 完了件数 / オレンジ: 取り戻した時間)
//   3. 今日 AI 会社がやった一覧 (タイムライン)
//   4. 今日完了した自分のタスク
//   5. 今日の動き (財務: 売上・経費・純)
//   6. 明日やるべき 3 つ (AI 提案 — coach.brief.actions から / fallback あり)
//   7. 共有ボタン (Markdown コピー / Twitter)
//
// 嘘禁止:
//   - 0 / null は「—」表示
//   - 計算式併記 (節約 27 分 × 3 件 × ¥3,000/h = ¥4,050)
// ============================================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { ExpenseEntry } from '../types/expense';
import type { AgentTask } from '../hooks/useAgentTaskQueue';
import { CXO_META } from '../hooks/useAgentTaskQueue';
import type { CoachBrief } from '../lib/coachScheduler';

interface DailyReportProps {
  open: boolean;
  onClose: () => void;
  persona: Persona;
  /** Stripe 実売上 (今月) */
  stripeThisMonth: { revenueJpy: number; expenseJpy: number; profitJpy: number; txnCount: number };
  stripeConnected: boolean;
  /** AI 会社のタスクキュー (全件) */
  agentTasks: AgentTask[];
  /** 経費 (このペルソナ分) */
  expenses: ExpenseEntry[];
  /** 既存のコーチブリーフ — 明日の 1 手提案に使う (任意) */
  coachBrief?: CoachBrief | null;
  /** AI 会社に任せるショートカット */
  onDelegate?: (prompt: string) => void;
}

// ────────────────────────────────────────────────────────────
// 共通ユーティリティ
// ────────────────────────────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === todayISO();
}

function formatJpy(n: number): string {
  if (!isFinite(n)) return '—';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function formatJpyOrDash(n: number): string {
  if (!n || !isFinite(n)) return '—';
  return formatJpy(n);
}

function todayJaLabel(): string {
  const d = new Date();
  const wk = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 (${wk}) の総括`;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────
// カウントアップ数字
// ────────────────────────────────────────────────────────────
function useCountUp(target: number, durationMs = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!isFinite(target) || target === 0) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

// ────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────
export default function DailyReport({
  open,
  onClose,
  persona,
  stripeThisMonth,
  stripeConnected,
  agentTasks,
  expenses,
  coachBrief,
  onDelegate,
}: DailyReportProps) {
  // ── 1) 今日の売上を Stripe 月次から推定
  // 月次の値しか取れないので、月の経過日数で割って 日次平均 を出す。
  // 「実日次」ではなく「日割り推定」と注記する (嘘禁止)。
  const todayRevenueEst = useMemo(() => {
    if (!stripeConnected || !stripeThisMonth.revenueJpy) return 0;
    const now = new Date();
    const dayOfMonth = now.getDate();
    return Math.round(stripeThisMonth.revenueJpy / Math.max(1, dayOfMonth));
  }, [stripeConnected, stripeThisMonth.revenueJpy]);

  // ── 2) 今日 AI 会社が完了したタスク
  const todayAgentTasks = useMemo(
    () => agentTasks.filter(t => t.status === 'done' && isToday(t.completedAt))
      .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || '')),
    [agentTasks]);

  // ── 3) 取り戻した時間 (推定): 完了 AI タスク × 1 件あたり 27 分 (平均)
  // 27 分 × 件数 = 節約分。時給は ¥3,000 仮定 (オーナーの実コストを下振れ目に推定)。
  const SAVED_MIN_PER_TASK = 27;
  const HOURLY_JPY = 3000;
  const savedMin = todayAgentTasks.length * SAVED_MIN_PER_TASK;
  const savedJpy = Math.round((savedMin / 60) * HOURLY_JPY);

  // ── 4) 今日完了した自分のタスク
  const todayMyTasks = useMemo(
    () => (persona.tasks || []).filter(t => t.done && isToday(t.completedAt))
      .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || '')),
    [persona.tasks]);

  // ── 5) 今日の経費
  const todayExpenses = useMemo(
    () => expenses.filter(e => e.date === todayISO()),
    [expenses]);
  const todayExpenseSum = todayExpenses.reduce((s, e) => s + (e.amountIncl || 0), 0);
  const todayNet = todayRevenueEst - todayExpenseSum;

  // ── 6) 明日やるべき 3 つ — coachBrief.actions を流用、足りなければ補完
  const tomorrowActions = useMemo(() => {
    const fromBrief = (coachBrief?.actions || []).slice(0, 3).map(a => ({
      label: a,
      delegate: a,
    }));
    const fallback = [
      { label: '今週の優先 3 つを決める', delegate: 'CEO に「今週の優先 3 つを決めて」と依頼' },
      { label: '今日アプローチする 5 社を選ぶ', delegate: 'CSO に「今日アプローチする 5 社を選んで」と依頼' },
      { label: '今月の損益を 1 枚にまとめる', delegate: 'CFO に「今月の損益を 1 枚にまとめて」と依頼' },
    ];
    const out = [...fromBrief];
    while (out.length < 3) out.push(fallback[out.length]);
    return out.slice(0, 3);
  }, [coachBrief]);

  // ── カウントアップ
  const cRev = useCountUp(todayRevenueEst);
  const cAi = useCountUp(todayAgentTasks.length, 700);
  const cSaved = useCountUp(savedJpy);

  // ── Markdown
  const buildMarkdown = useCallback(() => {
    const L: string[] = [];
    L.push(`# ${todayJaLabel()}`);
    L.push('');
    L.push(`- 今日の売上 (推定): ${formatJpyOrDash(todayRevenueEst)}${stripeConnected ? '' : ' — Stripe 未接続'}`);
    L.push(`- AI 会社が完了: ${todayAgentTasks.length} 件`);
    L.push(`- 取り戻した時間: ${savedMin} 分 (≒ ${formatJpyOrDash(savedJpy)})`);
    L.push('');
    if (todayAgentTasks.length) {
      L.push('## 今日 AI 会社がやったこと');
      todayAgentTasks.forEach(t => {
        L.push(`- [${formatTime(t.completedAt)}] ${t.title}`);
      });
      L.push('');
    }
    if (todayMyTasks.length) {
      L.push('## 今日完了した自分のタスク');
      todayMyTasks.forEach(t => L.push(`- [x] ${t.title}`));
      L.push('');
    }
    L.push('## 今日の動き');
    L.push(`- 売上: ${formatJpyOrDash(todayRevenueEst)}`);
    L.push(`- 経費: ${formatJpyOrDash(todayExpenseSum)}`);
    L.push(`- 純: ${formatJpyOrDash(todayNet)}`);
    L.push('');
    L.push('## 明日やるべき 3 つ');
    tomorrowActions.forEach((a, i) => L.push(`${i + 1}. ${a.label}`));
    return L.join('\n');
  }, [todayRevenueEst, stripeConnected, todayAgentTasks, savedMin, savedJpy, todayMyTasks, todayExpenseSum, todayNet, tomorrowActions]);

  const [copied, setCopied] = useState(false);
  const handleCopyMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* */ }
  }, [buildMarkdown]);

  const handleShareTwitter = useCallback(() => {
    const text = `今日の総括\n売上 ${formatJpyOrDash(todayRevenueEst)} / AI が ${todayAgentTasks.length} 件完了 / 取り戻した時間 ${savedMin} 分\n#CORE_Prism`;
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  }, [todayRevenueEst, todayAgentTasks.length, savedMin]);

  // ── キーボード ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const accent = persona.accentColor;
  const accentLight = persona.accentColorLight;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="daily-report-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 95,
            background: 'rgba(6, 4, 12, 0.78)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'max(0.75rem, env(safe-area-inset-top)) 0.75rem max(0.75rem, env(safe-area-inset-bottom))',
            overflow: 'auto',
          }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong"
            style={{
              width: '100%', maxWidth: 720,
              maxHeight: 'calc(100vh - 2rem)',
              overflowY: 'auto',
              borderRadius: 20,
              padding: 0,
            }}
          >
            {/* ── ヘッダ ── */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 2,
              background: 'linear-gradient(180deg, rgba(20,12,28,0.95), rgba(20,12,28,0.85))',
              backdropFilter: 'blur(10px)',
              padding: '14px 16px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>📊 DAILY REPORT</div>
                <div style={{ fontSize: 15, color: '#F4ECFF', fontWeight: 700, marginTop: 2 }}>{todayJaLabel()}</div>
              </div>
              <button
                onClick={onClose}
                aria-label="閉じる"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)', fontSize: 18, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >×</button>
            </div>

            {/* ── 本文 ── */}
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* (2) 今日の数字 3 連 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
              }}>
                <StatTile
                  label="今日の売上 (推定)"
                  value={todayRevenueEst > 0 ? formatJpy(cRev) : '—'}
                  hint={stripeConnected
                    ? `月次 ${formatJpy(stripeThisMonth.revenueJpy)} ÷ ${new Date().getDate()} 日 (日割り)`
                    : 'Stripe 未接続 — 設定で接続を'}
                  color="#34D399"
                  bg="rgba(52,211,153,0.10)"
                />
                <StatTile
                  label="AI 会社が完了"
                  value={todayAgentTasks.length > 0 ? `${cAi} 件` : '—'}
                  hint={todayAgentTasks.length > 0 ? '今日 完了した AgentTask' : 'まだ任せたタスクがありません'}
                  color="#A78BFA"
                  bg="rgba(167,139,250,0.12)"
                />
                <StatTile
                  label="取り戻した時間"
                  value={savedMin > 0 ? `${savedMin} 分` : '—'}
                  hint={savedMin > 0
                    ? `${SAVED_MIN_PER_TASK} 分 × ${todayAgentTasks.length} 件 × ¥${HOURLY_JPY.toLocaleString()}/h = ${formatJpy(cSaved)}`
                    : '完了が増えるほど積み上がります'}
                  color="#FB923C"
                  bg="rgba(251,146,60,0.12)"
                />
              </div>

              {/* (3) AI 会社がやったこと */}
              <Section title="今日 AI 会社がやったこと" emoji="🤖" accent={accent}>
                {todayAgentTasks.length === 0 ? (
                  <EmptyHint>
                    まだ AI 会社に何も任せていません。<br />
                    <kbd style={{
                      background: 'rgba(255,255,255,0.08)',
                      padding: '1px 6px', borderRadius: 4, fontSize: 11,
                    }}>Cmd+K</kbd> → 「依頼」と入力で始まります。
                  </EmptyHint>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {todayAgentTasks.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.25 }}
                        style={{
                          display: 'flex', gap: 10, padding: '10px 12px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                        }}
                      >
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', minWidth: 42 }}>
                          {formatTime(t.completedAt)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#F4ECFF', fontWeight: 600 }}>{t.title}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {t.steps.filter(s => s.status === 'done').map((s, si) => (
                              <span key={si} style={{
                                fontSize: 11,
                                background: `${CXO_META[s.cxo]?.color || '#888'}22`,
                                color: CXO_META[s.cxo]?.color || '#aaa',
                                padding: '2px 7px', borderRadius: 999,
                                border: `1px solid ${CXO_META[s.cxo]?.color || '#888'}55`,
                              }}>
                                {CXO_META[s.cxo]?.emoji} {s.cxo}: {s.output ? (s.output.length > 22 ? s.output.slice(0, 22) + '…' : s.output) : s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>

              {/* (4) 今日完了した自分のタスク */}
              <Section title="今日完了した自分のタスク" emoji="✅" accent={accent}>
                {todayMyTasks.length === 0 ? (
                  <EmptyHint>今日のチェックはまだ。1 つでも完了すれば streak +1。</EmptyHint>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {todayMyTasks.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: 'rgba(52,211,153,0.06)',
                          border: '1px solid rgba(52,211,153,0.18)',
                          borderRadius: 10,
                        }}
                      >
                        <span style={{ color: '#34D399', fontSize: 14 }}>✓</span>
                        <span style={{ flex: 1, fontSize: 13, color: '#F4ECFF', textDecoration: 'line-through', opacity: 0.85 }}>
                          {t.title}
                        </span>
                        {t.estimatedMin ? (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>≈ {t.estimatedMin} 分</span>
                        ) : null}
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>

              {/* (5) 今日の動き (財務) */}
              <Section title="今日の動き (財務)" emoji="💴" accent={accent}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                }}>
                  <MoneyCell label="売上" value={formatJpyOrDash(todayRevenueEst)} color="#34D399" />
                  <MoneyCell label="経費" value={formatJpyOrDash(todayExpenseSum)} color="#FB923C" />
                  <MoneyCell
                    label="純"
                    value={todayRevenueEst === 0 && todayExpenseSum === 0 ? '—' : formatJpy(todayNet)}
                    color={todayNet >= 0 ? '#34D399' : '#F87171'}
                  />
                </div>
                {todayExpenses.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    今日登録された経費: {todayExpenses.length} 件
                  </div>
                )}
              </Section>

              {/* (6) 明日の 3 つ */}
              <Section title="明日やるべき 3 つ" emoji="🌅" accent={accent}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tomorrowActions.map((a, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2, boxShadow: `0 6px 20px ${accent}22` }}
                      style={{
                        padding: '12px',
                        background: accentLight,
                        border: `1px solid ${accent}40`,
                        borderRadius: 12,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: accent, color: '#0b0612',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 13,
                        flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, fontSize: 13, color: '#F4ECFF', minWidth: 0 }}>{a.label}</div>
                      {onDelegate && (
                        <button
                          onClick={() => onDelegate(a.delegate)}
                          style={{
                            background: accent, color: '#0b0612',
                            border: 'none', borderRadius: 8,
                            padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="AI 会社にこのタスクを任せる"
                        >
                          AI に任せる
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Section>

              {/* (7) 共有 */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                padding: '12px 0 4px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}>
                <button
                  onClick={handleCopyMd}
                  style={{
                    flex: '1 1 200px',
                    padding: '10px 14px',
                    background: copied ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copied ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    color: copied ? '#34D399' : '#F4ECFF',
                    borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                >
                  {copied ? '✓ コピーしました' : '📋 Markdown でコピー'}
                </button>
                <button
                  onClick={handleShareTwitter}
                  style={{
                    flex: '1 1 160px',
                    padding: '10px 14px',
                    background: 'rgba(29,161,242,0.10)',
                    border: '1px solid rgba(29,161,242,0.35)',
                    color: '#5BA8FF',
                    borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  𝕏 で共有
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ────────────────────────────────────────────────────────────
// サブコンポーネント
// ────────────────────────────────────────────────────────────
function StatTile({ label, value, hint, color, bg }: {
  label: string; value: string; hint: string; color: string; bg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '14px',
        background: bg,
        border: `1px solid ${color}40`,
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 11, color, letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, color: '#F4ECFF', fontWeight: 800, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>
    </motion.div>
  );
}

function Section({ title, emoji, accent, children }: {
  title: string; emoji: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'rgba(255,255,255,0.62)',
        textTransform: 'none', letterSpacing: '0.03em',
        marginBottom: 8, fontWeight: 600,
      }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span>{title}</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}30, transparent)` }} />
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.12)',
      borderRadius: 10,
      fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
    }}>{children}</div>
  );
}

function MoneyCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 8px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ fontSize: 16, color, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
