// ============================================================
// InlineActionExecutor — TodayBrief のアクション提案を「実際に実行」
//
// オーナー指示 (2026-06-03):
//   提案タップ → 提案だけでなく実行まで行ってくれる感動を作る。
//   実行過程を画面上に見せ、最後に成果物を納品する。
//
// 流れ:
//   1) ユーザーがアクションをタップ
//   2) ヘッダーに「AI が手順を組み立てています…」が出る
//   3) AI から plan が返ったら、ステップを 1 つずつ ✅ で点灯させていく
//   4) 全ステップ完了 → 成果物 (テキスト / チェックリスト / メール下書き等) が
//      下からせり上がる
//   5) コピー / 保存 / もう一度 / タスクに追加 のボタン
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Save, RotateCw, Plus, AlertCircle, Sparkles, Mail, FileText, MessageSquare } from 'lucide-react';
import type { AppSettings, Persona } from '../types/identity';
import {
  executeAction, saveArtifact,
  type ExecutionPlan, type Deliverable, type SavedArtifact,
  STEP_REVEAL_MS, STEP_THINKING_MS,
} from '../lib/actionExecutor';

interface Props {
  action: string;
  persona: Persona;
  settings: AppSettings;
  /** 「タスクに追加」ボタンを押したとき (任意。提示しない場合は省略) */
  onAddAsTask?: (action: string, deliverable?: Deliverable) => void;
  /** 閉じる/折りたたみ */
  onClose: () => void;
  /** 追加コンテキスト (オーナーのその日のメモ等) */
  contextText?: string;
  /** 完了時 に 親側 (AgentTeamMonitor 等) で 役員日報 へ logDeliverable する 用 (2026-06-05) */
  onComplete?: (deliverable: Deliverable, action: string) => void;
}

type Phase = 'planning' | 'streaming' | 'done' | 'error';

interface StreamedStep {
  label: string;
  detail: string;
  status: 'thinking' | 'done';
}

export default function InlineActionExecutor({
  action, persona, settings, onAddAsTask, onClose, contextText, onComplete,
}: Props) {
  const [phase, setPhase] = useState<Phase>('planning');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [streamed, setStreamed] = useState<StreamedStep[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runKey, setRunKey] = useState(0); // 「もう一度」で再実行する key

  // ── 1) 起動と同時に AI 呼び出し ─────────────────────
  useEffect(() => {
    let aborted = false;
    setPhase('planning');
    setPlan(null);
    setStreamed([]);
    setErrMsg(null);
    setCopied(false);
    setSaved(false);

    executeAction(action, persona, settings, contextText)
      .then(p => {
        if (aborted) return;
        setPlan(p);
        setPhase('streaming');
      })
      .catch(e => {
        if (aborted) return;
        setErrMsg(e?.message || 'AI 実行に失敗しました');
        setPhase('error');
      });

    return () => { aborted = true; };
  }, [action, runKey, persona.id, settings.preferredModel, contextText]);

  // ── 2) plan を受け取ったら、ステップを時間差で点灯 ───
  useEffect(() => {
    if (phase !== 'streaming' || !plan) return;
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < plan.steps.length; i++) {
        if (cancelled) return;
        const s = plan.steps[i];
        // thinking → 表示
        setStreamed(prev => [...prev, { ...s, status: 'thinking' }]);
        await sleep(STEP_THINKING_MS);
        if (cancelled) return;
        // done に切替
        setStreamed(prev => prev.map((ss, idx) => idx === i ? { ...ss, status: 'done' } : ss));
        await sleep(STEP_REVEAL_MS - STEP_THINKING_MS);
      }
      if (!cancelled) setPhase('done');
    };
    run();
    return () => { cancelled = true; };
  }, [phase, plan]);

  // ── 3) 完了時に成果物を localStorage に保存 ─────────
  useEffect(() => {
    if (phase !== 'done' || !plan || saved) return;
    const id = `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const a: SavedArtifact = {
      id,
      personaId: persona.id,
      action,
      plan,
      createdAt: new Date().toISOString(),
    };
    saveArtifact(a);
    setSaved(true);
    // 価値カード(WeeklyValueCard)へ即時反映 — AIが動いた瞬間に「今週/今日の件数」が増える体感を作る
    try { window.dispatchEvent(new CustomEvent('core:value-updated')); } catch { /* */ }
    // 親 へ 完了 通知 (AgentTeamMonitor が 役員日報 へ logDeliverable する)
    try { onComplete?.(plan.deliverable, action); } catch { /* */ }
  }, [phase, plan, saved, persona.id, action, onComplete]);

  const handleCopy = async () => {
    if (!plan) return;
    const txt = formatDeliverableAsText(plan.deliverable);
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        marginTop: 8, marginBottom: 4,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${persona.accentColor}1a, var(--surface-3))`,
        border: `1px solid ${persona.accentColor}44`,
        overflow: 'hidden',
      }}
    >
      {/* ヘッダー */}
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <motion.div
          animate={phase === 'planning' || phase === 'streaming' ? { rotate: [0, 360] } : {}}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: `${persona.accentColor}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: persona.accentColor,
          }}
        >
          {phase === 'done' ? <Check size={13} /> : <Sparkles size={13} />}
        </motion.div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
            {phase === 'planning' ? 'AI が手順を組み立てています' :
             phase === 'streaming' ? '実行中' :
             phase === 'done' ? '実行完了' : 'エラー'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.4, marginTop: 1 }}>
            {action}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: 'var(--fg-muted)',
            fontSize: 11, cursor: 'pointer', padding: 4, flexShrink: 0,
          }}
        >閉じる</button>
      </div>

      {/* エラー */}
      {phase === 'error' && (
        <div style={{ padding: '6px 14px 14px' }}>
          <div style={{
            display: 'flex', gap: 7, alignItems: 'flex-start',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: 8, padding: '8px 10px', color: '#f87171', fontSize: 11.5, lineHeight: 1.55,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 2 }}>実行できませんでした</div>
              <div>{errMsg}</div>
            </div>
          </div>
          <button
            onClick={() => setRunKey(k => k + 1)}
            style={{
              marginTop: 8,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', fontSize: 11.5, fontWeight: 700,
              background: persona.accentColor, color: '#0a0a0f',
              border: 'none', borderRadius: 999, cursor: 'pointer',
            }}
          ><RotateCw size={11} /> もう一度</button>
        </div>
      )}

      {/* 計画中 (skeleton) */}
      {phase === 'planning' && (
        <div style={{ padding: '4px 14px 14px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 6, opacity: 1 - i * 0.18,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 4,
                background: 'var(--surface-3)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
              }} />
              <div style={{
                flex: 1, height: 10, borderRadius: 4,
                background: 'var(--surface-3)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.18 + 0.1}s`,
              }} />
            </div>
          ))}
          <style>{`@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
        </div>
      )}

      {/* ステップ列 (streaming / done) */}
      {(phase === 'streaming' || phase === 'done') && (
        <div style={{ padding: '4px 14px 10px' }}>
          <AnimatePresence>
            {streamed.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  padding: '7px 0',
                  borderBottom: i < streamed.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <motion.div
                  animate={s.status === 'thinking' ? { rotate: [0, 360] } : {}}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.status === 'done' ? `${persona.accentColor}33` : 'var(--surface-3)',
                    color: s.status === 'done' ? persona.accentColor : 'var(--fg-muted)',
                    border: `1px solid ${s.status === 'done' ? `${persona.accentColor}66` : 'var(--border)'}`,
                  }}
                >
                  {s.status === 'done'
                    ? <Check size={11} strokeWidth={3} />
                    : <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--fg-muted)',
                      }} />
                  }
                </motion.div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.4 }}>
                    {s.label}
                  </div>
                  {s.detail && (
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1, lineHeight: 1.55 }}>
                      {s.detail}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 成果物カード */}
      {phase === 'done' && plan && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            margin: '0 14px 14px',
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: `1px solid ${persona.accentColor}55`,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '9px 12px',
            background: `${persona.accentColor}1f`,
            borderBottom: `1px solid ${persona.accentColor}33`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <KindBadge kind={plan.deliverable.kind} accent={persona.accentColor} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--fg)' }}>
              {plan.deliverable.title}
            </span>
          </div>
          <DeliverableView deliverable={plan.deliverable} accent={persona.accentColor} />
          {plan.note && (
            <div style={{
              padding: '8px 12px 10px', fontSize: 11, color: 'var(--fg-muted)',
              fontStyle: 'italic', lineHeight: 1.55,
              borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <MessageSquare size={12} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{plan.note}</span>
            </div>
          )}
          {/* アクションボタン群 */}
          <div style={{
            display: 'flex', gap: 6, padding: '8px 10px',
            background: 'var(--surface-3)', borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}>
            <button onClick={handleCopy} style={btnStyle('primary', persona.accentColor)}>
              {copied ? <><Check size={12} /> コピーしました</> : <><Copy size={12} /> コピー</>}
            </button>
            {plan.deliverable.kind === 'email' && (() => {
              const { subject, body } = parseEmail(plan.deliverable.content);
              return (
                <button
                  onClick={() => {
                    const url = gmailComposeUrl(subject, body);
                    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
                  }}
                  style={btnStyle('ghost', persona.accentColor)}
                ><Mail size={12} /> Gmailで作成</button>
              );
            })()}
            {onAddAsTask && (
              <button
                onClick={() => onAddAsTask(action, plan.deliverable)}
                style={btnStyle('ghost', persona.accentColor)}
              ><Plus size={12} /> タスクに追加</button>
            )}
            <button onClick={() => setRunKey(k => k + 1)} style={btnStyle('ghost', persona.accentColor)}>
              <RotateCw size={11} /> もう一度
            </button>
            <span style={{
              marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-muted)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Save size={10} /> 自動保存済み
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── 成果物の中身を見せる ───────────────────────────────
function DeliverableView({ deliverable, accent }: { deliverable: Deliverable; accent: string }) {
  const { kind, content } = deliverable;

  if (kind === 'checklist') {
    const items = content.split('\n').map(l => l.trim()).filter(Boolean);
    return (
      <div style={{ padding: '10px 12px' }}>
        {items.map((line, i) => {
          // - [ ] や - [x] を取り除いて表示
          const m = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
          const checked = !!m && /[xX]/.test(m[1]);
          const text = m ? m[2] : line.replace(/^[-*]\s*/, '');
          return (
            <label key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0',
              cursor: 'pointer', fontSize: 12.5, color: 'var(--fg)', lineHeight: 1.5,
            }}>
              <input
                type="checkbox"
                defaultChecked={checked}
                style={{ marginTop: 3, accentColor: accent }}
              />
              <span>{text}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (kind === 'email') {
    // 「件名: ...」+ 本文 のフォーマット
    const m = content.match(/^件名:\s*(.+)\n([\s\S]*)$/);
    const subject = m ? m[1].trim() : '(件名なし)';
    const body = m ? m[2].trim() : content;
    return (
      <div style={{ padding: '10px 12px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--fg)' }}>
        <div style={{
          fontWeight: 800, paddingBottom: 6, marginBottom: 8,
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Mail size={13} strokeWidth={2.3} style={{ flexShrink: 0 }} /> 件名: {subject}
        </div>
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: 'inherit', margin: 0, fontSize: 12.5, lineHeight: 1.65,
        }}>{body}</pre>
      </div>
    );
  }

  if (kind === 'table') {
    // GFM table をパースして表示
    const rows = content.split('\n').map(l => l.trim()).filter(Boolean);
    const dataRows = rows.filter(r => !/^\s*\|?\s*[-: ]+\s*\|/.test(r));
    const parsed = dataRows.map(r =>
      r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    );
    if (parsed.length === 0) return <div style={{ padding: '10px 12px', fontSize: 12.5 }}>{content}</div>;
    return (
      <div style={{ padding: '10px 12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', color: 'var(--fg)' }}>
          <thead>
            <tr>
              {parsed[0].map((h, i) => (
                <th key={i} style={{
                  textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${accent}55`,
                  fontWeight: 800, color: accent,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.slice(1).map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // text / memo
  return (
    <div style={{ padding: '10px 12px', fontSize: 12.5, lineHeight: 1.7, color: 'var(--fg)' }}>
      <pre style={{
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'inherit', margin: 0, fontSize: 12.5, lineHeight: 1.7,
      }}>{content}</pre>
    </div>
  );
}

function KindBadge({ kind, accent }: { kind: Deliverable['kind']; accent: string }) {
  const label =
    kind === 'checklist' ? 'チェックリスト' :
    kind === 'email' ? 'メール下書き' :
    kind === 'table' ? '表' :
    kind === 'memo' ? 'メモ' : 'テキスト';
  const Icon =
    kind === 'checklist' ? Check :
    kind === 'email' ? Mail :
    kind === 'table' ? FileText :
    kind === 'memo' ? FileText : FileText;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: `${accent}22`, color: accent,
      fontSize: 10, fontWeight: 800, letterSpacing: 1,
    }}>
      <Icon size={11} strokeWidth={2.6} />{label}
    </span>
  );
}

function btnStyle(variant: 'primary' | 'ghost', accent: string): React.CSSProperties {
  if (variant === 'primary') {
    return {
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 11px', fontSize: 11.5, fontWeight: 800,
      background: accent, color: '#0a0a0f',
      border: 'none', borderRadius: 8, cursor: 'pointer',
    };
  }
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', fontSize: 11.5, fontWeight: 700,
    background: 'transparent', color: 'var(--fg)',
    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
  };
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function formatDeliverableAsText(d: Deliverable): string {
  return `[${d.title}]\n\n${d.content}\n`;
}

// メール下書きを「件名」「本文」に分解（DeliverableView の email 分岐と同じ規則）
function parseEmail(content: string): { subject: string; body: string } {
  const m = content.match(/^件名:\s*(.+)\n([\s\S]*)$/);
  return {
    subject: m ? m[1].trim() : '',
    body: (m ? m[2] : content).trim(),
  };
}

// Gmail の「新規作成」画面を、件名・本文を入れた状態で開く URL
function gmailComposeUrl(subject: string, body: string): string {
  const q = `view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `https://mail.google.com/mail/?${q}`;
}
