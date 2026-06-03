// ============================================================
// EveningFeed — 1 日の終わりに「AI 役員が今日進めた仕事」をまとめる夜のフィード
//
// オーナー指示 (2026-06-04 第 20 波 VVV):
//   ダッシュボード上に、その日のタスクログ / 提案 / 成果物 / Studio 訪問 を
//   1 枚のカードに集約。「明日に持ち越し」の心理的負担を下げる。
//
// 表示ロジック:
//   - 18:00 以降 で 1 日 1 回だけ初表示 (core_evening_feed_shown:<date>)
//   - ユーザーが閉じれば隠す (同日は再表示しない)
//   - 内訳: 完了タスク数 / 提案数 / Studio 行動数 / おすすめの明日 1 つ
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, X, Sparkles, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, cxoDisplayName, type AgentTask } from '../hooks/useAgentTaskQueue';

const SHOWN_KEY = 'core_evening_feed_shown';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isEveningHour(): boolean {
  const h = new Date().getHours();
  return h >= 18 || h < 5;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// タスクのうち今日完了 / 今日提案 / 今日失敗 を抽出
function summarizeToday(tasks: AgentTask[]) {
  const start = startOfTodayMs();
  const today = tasks.filter(t => {
    const proposed = Date.parse(t.proposedAt);
    const completed = t.completedAt ? Date.parse(t.completedAt) : 0;
    return (Number.isFinite(proposed) && proposed >= start)
        || (Number.isFinite(completed) && completed >= start);
  });
  const done = today.filter(t => t.status === 'done');
  const proposed = today.filter(t => t.status !== 'done' && t.status !== 'failed');
  const failed = today.filter(t => t.status === 'failed');
  // CXO 別 完了数
  const byCxo: Record<string, number> = {};
  for (const t of done) {
    for (const step of t.steps) {
      if (step.status === 'done') byCxo[step.cxo] = (byCxo[step.cxo] || 0) + 1;
    }
  }
  return { done, proposed, failed, byCxo };
}

function topCxos(byCxo: Record<string, number>): Array<{ cxo: string; count: number }> {
  return Object.entries(byCxo)
    .map(([cxo, count]) => ({ cxo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export default function EveningFeed() {
  const queue = useAgentTaskQueue();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEveningHour()) return;
    try {
      const k = `${SHOWN_KEY}:${todayKey()}`;
      if (localStorage.getItem(k) === '1') return;
      // ちょっと遅延して表示 (ダッシュボードが描画落ち着いた頃)
      const t = window.setTimeout(() => {
        setVisible(true);
        localStorage.setItem(k, '1');
      }, 1800);
      return () => window.clearTimeout(t);
    } catch { /* */ }
  }, []);

  const summary = useMemo(() => summarizeToday(queue.tasks || []), [queue.tasks]);
  const top = useMemo(() => topCxos(summary.byCxo), [summary.byCxo]);
  const totalTouched = summary.done.length + summary.proposed.length + summary.failed.length;

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
          zIndex: 75,
          width: 'min(360px, calc(100vw - 24px))',
          padding: '1rem 1.1rem',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(79,70,229,0.95), rgba(167,139,250,0.85) 50%, rgba(244,114,182,0.85))',
          border: '1px solid rgba(167,139,250,0.5)',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div aria-hidden style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180,
          borderRadius: '50%', filter: 'blur(40px)',
          background: 'radial-gradient(circle, rgba(79,70,229,0.4) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <button
          aria-label="閉じる"
          onClick={() => setVisible(false)}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: 14,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X size={13} /></button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5, #A78BFA)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Moon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 800, color: '#A78BFA', textTransform: 'uppercase' }}>
              EVENING FEED · 今日のまとめ
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--fg)' }}>
              今日、AI 役員が 触れた仕事 {totalTouched} 件
            </div>
          </div>
        </div>

        {totalTouched === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
            今日は AI 役員に頼んだ仕事がありませんでした。<br />
            明日の朝、まずひとつだけ「<strong>今週の優先 3 つを決める</strong>」を CEO に頼んでみませんか?
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
              marginBottom: 10,
            }}>
              <Stat icon={<CheckCircle2 size={13} color="#34D399" />} label="完了" value={summary.done.length} color="#34D399" />
              <Stat icon={<MessageSquare size={13} color="#A78BFA" />} label="提案中" value={summary.proposed.length} color="#A78BFA" />
              <Stat icon={<Sparkles size={13} color="#F472B6" />} label="役員" value={top.length} color="#F472B6" />
            </div>

            {top.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  fontSize: '0.65rem', letterSpacing: '0.15em',
                  fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 6,
                }}>今日 動いた CXO</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {top.map(t => {
                    const meta = CXO_META[t.cxo as keyof typeof CXO_META];
                    return (
                      <span key={t.cxo} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: `${meta.color}25`,
                        color: meta.color,
                        fontSize: 11, fontWeight: 800,
                      }}>
                        <span style={{ fontSize: 13 }}>{meta.emoji}</span>
                        {cxoDisplayName(t.cxo as keyof typeof CXO_META)} ×{t.count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {summary.done.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10, padding: '8px 10px',
                marginBottom: 8,
                fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>
                  ✓ 完了したばかりの仕事 (上位 3)
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {summary.done.slice(0, 3).map(t => (
                    <li key={t.id} style={{ marginBottom: 2 }}>{t.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.failed.length > 0 && (
              <div style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 10, padding: '6px 10px', marginBottom: 8,
                fontSize: '0.72rem', color: '#fda4af',
              }}>
                {summary.failed.length} 件 つまずいたタスクがあります。明日 再開できます。
              </div>
            )}

            <div style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 10,
              fontSize: '0.78rem', color: 'var(--fg)',
              lineHeight: 1.7,
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#A78BFA', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 4 }}>
                <ArrowRight size={11} /> 明日 まずやる
              </div>
              {summary.proposed.length > 0
                ? `保留中の「${summary.proposed[0].title}」を朝一で承認する`
                : '「今日のブリーフ」を開いて、最初の 1 タスクを CEO に頼む'}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}22`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700, marginBottom: 2 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
