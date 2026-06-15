// ============================================================
// CommandCenter — Claude Code 風 「コマンド センター」 右側 パネル
//
// オーナー指示 (2026-06-05):
//   「右側 余白 に 各 役員 が 今 何 を 意思決定 / 実行 中 か を リアルタイム 表示。
//    Claude Code の よう な コマンド 入力 欄。 PRISM マーク で 開閉。
//    開いて いる 間 は 右下 の AgentTeamMonitor は 非表示。」
//
// レイアウト (右側 固定 440px、 100vh):
//   ┌─────────────────────┐
//   │ 🔮 プリズム ×       │
//   │ コマンド センター    │
//   ├─────────────────────┤
//   │ 📡 14 名 役員 状況  │
//   │ [CEO 陽翔]          │
//   │   💭 思考中: 売上分析│
//   │ [CSO 誠]            │
//   │   ⚡ 実行中: メール  │
//   │ ...                 │
//   ├─────────────────────┤
//   │ 💬 履歴 (スクロール) │
//   │ > 売上 を 整理      │
//   │ [CMO] 集客 案 作成中 │
//   │ ✓ 役員 日報 に 納品  │
//   ├─────────────────────┤
//   │ > 指令 を 入力…      │
//   │   [送信]            │
//   └─────────────────────┘
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CXO_META, useAgentTaskQueue, type CxoRole, cxoDisplayName } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';
import { listDeliverables, logDeliverable } from '../lib/cxoDeliverables';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  open: boolean;
  onClose: () => void;
  brand?: 'prism' | 'iris';
}

interface LogLine {
  id: string;
  ts: number;
  /** 同じ 指令 を まとめる ため の セッション ID */
  sessionId: string;
  kind: 'user' | 'route' | 'thinking' | 'executing' | 'done' | 'error';
  cxo?: CxoRole;
  text: string;
  /** 進行 状態 を 視覚化 する 補助 */
  detail?: string;
}

const LOG_KEY = 'core_command_center_log_v1';
const MAX_LOG = 80;

const CXO_ORDER: CxoRole[] = ['CEO', 'CTO', 'CPO', 'CDO', 'CMO', 'CSO', 'CFO', 'COO', 'CDS', 'CLO', 'UIE', 'UXE', 'QAE', 'CHR'];

const CXO_NAMES: Record<CxoRole, string> = {
  CEO: '陽翔', CTO: '匠',   CPO: '凛',   CDO: '蒼',
  CMO: '陽菜', CSO: '誠',   CFO: '颯太', COO: '葵',
  CDS: '陸',   CLO: '結衣', UIE: '美海', UXE: '玲奈',
  QAE: '律',   CHR: '優',
};

// 簡易 ルーター: 指令 文 から 担当 CXO を 推定
function pickCxoFor(command: string): CxoRole {
  if (/売上|利益|経費|資金|キャッシュ|損益|財務|stripe|請求/.test(command)) return 'CFO';
  if (/集客|広告|sns|seo|キャンペーン|コンテンツ|マーケ|オンライン/.test(command)) return 'CMO';
  if (/商談|営業|提案|案件|顧客|クロージング|crm/.test(command)) return 'CSO';
  if (/採用|人材|面接|評価|hr|求人/.test(command)) return 'CHR';
  if (/分析|kpi|データ|仮説|測定|計測/.test(command)) return 'CDO';
  if (/契約|法務|商標|個情|gdpr|約款|nda/.test(command)) return 'CLO';
  if (/技術|システム|連携|api|自動化|スクリプト|デプロイ/.test(command)) return 'CTO';
  if (/デザイン|配色|ロゴ|バナー|画像|og/.test(command)) return 'UXE';
  if (/ui|画面|動線|コピー|文言/.test(command)) return 'UIE';
  if (/競合|業界|リサーチ|トレンド/.test(command)) return 'CDS';
  if (/品質|テスト|バグ|エラー/.test(command)) return 'QAE';
  if (/運用|sop|プロセス|委託|事務/.test(command)) return 'COO';
  if (/機能|仕様|ロードマップ|商品|プロダクト/.test(command)) return 'CPO';
  return 'CEO'; // 振り分け 司令官
}

// 状態 文 サンプル (シミュレート 用)
const THINKING_VERBS = ['を 分析中', 'を 整理中', 'の 仮説 を 立て中', 'の 候補 を 比較中', 'を 起案中'];
const EXECUTING_VERBS = ['を 作成中', 'を 出力中', 'に 取り組み中', 'を 仕上げ中', 'の 文面 を 書いて います'];

export default function CommandCenter({ persona, open, onClose, brand = 'prism' }: Props) {
  const accent = brand === 'iris' ? '#F472B6' : '#A78BFA';
  const accent2 = brand === 'iris' ? '#A855F7' : '#6366F1';

  const { tasks, activeTask } = useAgentTaskQueue();
  const [items, setItems] = useState(() => listDeliverables(persona.id));
  const [log, setLog] = useState<LogLine[]>(() => loadLog());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 役員 日報 が 増えたら 自動 更新
  useEffect(() => {
    const refresh = () => setItems(listDeliverables(persona.id));
    window.addEventListener('core:deliverable-added', refresh);
    const t = window.setInterval(() => { refresh(); setTick((x) => x + 1); }, 3000);
    return () => {
      window.removeEventListener('core:deliverable-added', refresh);
      window.clearInterval(t);
    };
  }, [persona.id]);

  // ログ 永続
  useEffect(() => { saveLog(log); }, [log]);
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [log]);

  // 開いた瞬間 に 入力欄 へ focus
  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  // 各 CXO の 状態 を 計算
  const cxoStatus = useMemo(() => {
    void tick; // tick で 再計算
    const map: Record<CxoRole, { state: 'working' | 'thinking' | 'idle'; task?: string; lastDone?: string; doneCount: number }> =
      {} as any;
    for (const r of CXO_ORDER) {
      const running = tasks?.find?.((t) =>
        t.status === 'running' && t.steps?.some?.((s: any) => s.cxo === r && (s.status === 'working' || s.status === 'pending'))
      );
      const lastDel = items.find((d) => d.cxoRole === r);
      const doneCount = items.filter((d) => d.cxoRole === r).length;
      const step = running?.steps?.find?.((s: any) => s.cxo === r);
      map[r] = {
        state: running ? (step?.status === 'pending' ? 'thinking' : 'working') : 'idle',
        task: running?.title,
        lastDone: lastDel?.title,
        doneCount,
      };
    }
    return map;
  }, [tasks, items, tick]);

  const workingCount = Object.values(cxoStatus).filter((s) => s.state === 'working' || s.state === 'thinking').length;

  // 指令 を 実行 — Claude Code 風 の リアルタイム 進捗 + 役員日報 納品
  const submit = async () => {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setBusy(true);
    setInput('');
    const sessionId = `s-${Date.now().toString(36)}`;

    // 1. ユーザー ログ
    pushLog({ sessionId, kind: 'user', text: cmd });

    // 2. CEO が 担当 を 振り分け
    const role = pickCxoFor(cmd);
    const meta = CXO_META[role];
    const name = CXO_NAMES[role];
    await sleep(450);
    pushLog({
      sessionId, kind: 'route',
      text: `担当 を 振り分け ました`,
      detail: `${cxoDisplayName(role)} (${name}) ← ${routeReason(cmd, role)}`,
    });

    // 3. CXO 思考中
    await sleep(550);
    const tv = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
    pushLog({
      sessionId, kind: 'thinking', cxo: role,
      text: `${cmd}${tv}`,
      detail: 'ナレッジ ベース を 横断 検索 / 仮説 を 整理',
    });

    // 4. 実行中
    await sleep(800);
    const ev = EXECUTING_VERBS[Math.floor(Math.random() * EXECUTING_VERBS.length)];
    pushLog({
      sessionId, kind: 'executing', cxo: role,
      text: `成果物${ev}`,
      detail: 'AI 文章 生成 / 構造化 / 検証',
    });

    // 5. AI で 簡易 成果物 生成 を 試みる (失敗時 は フォールバック)
    let content = '';
    let aiErr = '';
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'haiku',
          max_tokens: 700,
          messages: [{
            role: 'user',
            content: `あなたは 株式会社 ${persona.name || 'XX'} の ${cxoDisplayName(role)} (${name}) です。\n以下の指令に 対して、 80-120 字 で 「自分が 何を 考え、 何を 実行するか」 を 一人称 で 書いて ください。\n指令: ${cmd}`,
          }],
        }),
      });
      if (res.ok) {
        const j = await res.json();
        content = j?.content?.[0]?.text || '';
      } else {
        aiErr = `HTTP ${res.status}`;
      }
    } catch (e: any) { aiErr = e?.message || 'network'; }
    if (!content) {
      content = `${cmd} を 受領 しました。 ${cxoDisplayName(role)} として、 ${tv.replace('を ', '')} を 経て、 ${ev.replace('を ', '')} を 進めて います。 完了 次第 役員 日報 に 納品 します。`;
    }

    if (aiErr) {
      pushLog({
        sessionId, kind: 'error', cxo: role,
        text: `AI 接続 が 一時 失敗 (${aiErr}) — 雛形 で 進めます`,
      });
    }

    // 6. 役員 日報 に 記録
    let savedId: string | null = null;
    try {
      const saved = logDeliverable({
        personaId: persona.id,
        cxoRole: role,
        cxoName: `${name} (${role})`,
        cxoEmoji: meta.emoji,
        title: cmd,
        summary: content.slice(0, 60),
        content,
        category: 'plan',
        source: 'agent-monitor',
      });
      savedId = saved?.id || null;
    } catch { /* */ }

    await sleep(350);
    pushLog({
      sessionId, kind: 'done', cxo: role,
      text: `役員 日報 に 納品 しました`,
      detail: savedId ? `📋 「${cmd}」 (${content.length} 字)` : `📋 「${cmd}」`,
    });

    setBusy(false);
  };

  function pushLog(line: Omit<LogLine, 'id' | 'ts'>) {
    setLog((prev) => [...prev, { id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), ...line }].slice(-MAX_LOG));
  }

  // 振り分け 理由 (ユーザー に 見せる 用)
  function routeReason(cmd: string, role: CxoRole): string {
    const reasons: Record<CxoRole, string> = {
      CFO: '財務 / 数字 系',
      CMO: '集客 / マーケ 系',
      CSO: '営業 / 商談 系',
      CHR: '採用 / 人材 系',
      CDO: '分析 / KPI 系',
      CLO: '法務 / 契約 系',
      CTO: '技術 / 自動化 系',
      UXE: 'デザイン 系',
      UIE: 'UI / 動線 系',
      CDS: 'リサーチ 系',
      QAE: '品質 / 検証 系',
      COO: '運用 / 業務 系',
      CPO: 'プロダクト 系',
      CEO: '統括 → 自分 で 受ける',
    };
    void cmd;
    return reasons[role] || '統括';
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            top: 0, right: 0,
            width: 'min(460px, 100vw)',
            height: '100dvh',
            zIndex: 50,
            background: 'linear-gradient(180deg, rgba(10,10,20,0.96), rgba(7,7,18,0.98))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderLeft: `1px solid ${accent}44`,
            boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
            color: '#fff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "JetBrains Mono", monospace',
          }}
        >
          {/* ヘッダ */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${accent}, ${accent2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#fff',
              boxShadow: `0 6px 18px ${accent}66`,
            }}>🔮</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.22em', fontWeight: 900,
                color: accent, marginBottom: 1,
              }}>{brand === 'iris' ? 'IRIS' : 'PRISM'} · COMMAND CENTER</div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>
                プリズム コマンド センター
              </div>
            </div>
            <div style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 800,
              background: workingCount > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
              color: workingCount > 0 ? '#34D399' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${workingCount > 0 ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}>
              {workingCount > 0 ? (
                <>
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ width: 5, height: 5, borderRadius: 999, background: '#34D399', display: 'inline-block' }}
                  />
                  {workingCount} 名 稼働
                </>
              ) : '🟢 全員 待機'}
            </div>
            <button
              onClick={onClose}
              aria-label="閉じる"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                fontSize: 18, lineHeight: 1, flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* 14 役員 状況 グリッド */}
          <div style={{
            padding: '10px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 9, letterSpacing: '0.16em', fontWeight: 800,
              color: 'rgba(255,255,255,0.45)', marginBottom: 7,
            }}>📡 14 名 役員 リアルタイム</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 5,
            }}>
              {CXO_ORDER.map((role) => {
                const meta = CXO_META[role];
                const name = CXO_NAMES[role];
                const st = cxoStatus[role];
                const working = st?.state === 'working';
                const thinking = st?.state === 'thinking';
                const active = working || thinking;
                return (
                  <div
                    key={role}
                    style={{
                      padding: '5px 3px 4px',
                      borderRadius: 8,
                      background: active ? meta.color + '22' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? meta.color : st?.doneCount ? meta.color + '44' : 'rgba(255,255,255,0.08)'}`,
                      position: 'relative',
                      textAlign: 'center',
                    }}
                    title={st?.task || st?.lastDone || cxoDisplayName(role)}
                  >
                    {active && (
                      <motion.div
                        animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        style={{
                          position: 'absolute', top: 3, right: 3,
                          width: 6, height: 6, borderRadius: 999,
                          background: thinking ? '#FBBF24' : '#34D399',
                        }}
                      />
                    )}
                    {active && (
                      <div style={{
                        position: 'absolute', top: 3, right: 3,
                        width: 6, height: 6, borderRadius: 999,
                        background: thinking ? '#FBBF24' : '#34D399',
                      }} />
                    )}
                    {st?.doneCount > 0 && !active && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2,
                        fontSize: 7, padding: '0 3px', borderRadius: 999, fontWeight: 800,
                        background: meta.color, color: '#0a0a0f', lineHeight: 1.4,
                      }}>{st.doneCount}</div>
                    )}
                    <div style={{
                      width: 22, height: 22, borderRadius: 999, margin: '0 auto',
                      background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: '#0a0a0f',
                      boxShadow: active ? `0 0 8px ${meta.color}` : 'none',
                    }}><MetaIcon meta={meta} size={13} color="#0a0a0f" strokeWidth={2.4} /></div>
                    <div style={{ fontSize: 8, fontWeight: 800, marginTop: 2, color: active ? meta.color : 'rgba(255,255,255,0.7)' }}>{role}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{name}</div>
                  </div>
                );
              })}
            </div>
            {/* 実行中 詳細 (1 行) */}
            {workingCount > 0 && (
              <div style={{
                marginTop: 8, padding: '6px 8px', borderRadius: 6,
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
                fontSize: 10, color: '#34D399', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >⚡</motion.span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeTask?.title || '指令 を 処理中…'}
                </span>
              </div>
            )}
          </div>

          {/* ログ ストリーム — Claude Code 風 セッション グループ化 */}
          <div style={{
            flex: 1, minHeight: 0,
            padding: '14px 14px',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 14,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
          }}>
            {log.length === 0 ? (
              <div style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '20px 4px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                <div style={{ fontWeight: 800, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontSize: 13 }}>
                  指令 を 入力 して ください
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                  例: 「今週 の 集客 案 を 3 つ」<br/>
                  「来月 の 損益 を まとめて」<br/>
                  「商標 調査 を 急いで」
                </div>
              </div>
            ) : groupBySession(log).map((session) => {
              const userLine = session.find((l) => l.kind === 'user');
              const cxoRole = session.find((l) => l.cxo)?.cxo;
              const cxoMeta = cxoRole ? CXO_META[cxoRole] : null;
              const isLast = session === groupBySession(log).slice(-1)[0];
              const done = session.some((l) => l.kind === 'done');
              return (
                <div key={session[0].id} style={{
                  borderLeft: `2px solid ${done ? '#34D399' : cxoMeta?.color || accent}55`,
                  paddingLeft: 12,
                  position: 'relative',
                }}>
                  {/* ユーザー 指令 行 */}
                  {userLine && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                      }}>
                        <span style={{
                          fontSize: 11, fontWeight: 900, color: accent,
                          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
                          flexShrink: 0,
                        }}>{'>'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.5,
                            wordBreak: 'break-word',
                          }}>{userLine.text}</div>
                          <div style={{
                            fontSize: 9, color: 'rgba(255,255,255,0.4)',
                            marginTop: 2, letterSpacing: '0.04em',
                            fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
                          }}>{fmtTime(userLine.ts)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 実行 ステップ (route / thinking / executing / done / error) */}
                  {session.filter((l) => l.kind !== 'user').map((l, i, arr) => {
                    const stepMeta = STEP_META[l.kind];
                    const meta = l.cxo ? CXO_META[l.cxo] : null;
                    const isLastStep = i === arr.length - 1;
                    const pending = isLast && busy && isLastStep && l.kind !== 'done' && l.kind !== 'error';
                    return (
                      <div key={l.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9,
                        padding: '4px 0',
                        position: 'relative',
                      }}>
                        {/* ステップ マーカー (左 縦 線) */}
                        <div style={{
                          width: 20, flexShrink: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          position: 'relative', minHeight: 20,
                        }}>
                          {l.cxo && meta ? (
                            <div style={{
                              width: 20, height: 20, borderRadius: 999,
                              background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                              color: '#0a0a0f',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11,
                              boxShadow: pending ? `0 0 10px ${meta.color}` : 'none',
                            }}><MetaIcon meta={meta} size={12} color="#0a0a0f" strokeWidth={2.4} /></div>
                          ) : (
                            <div style={{
                              width: 20, height: 20, borderRadius: 999,
                              background: stepMeta.bg,
                              color: stepMeta.fg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11,
                            }}>
                              {pending ? (
                                <motion.span
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                                  style={{ display: 'inline-block' }}
                                >⚙</motion.span>
                              ) : stepMeta.icon}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 11.5, lineHeight: 1.5,
                            color: stepMeta.textColor, fontWeight: 700,
                            wordBreak: 'break-word',
                          }}>
                            {l.cxo && (
                              <span style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 800,
                                background: meta ? meta.color + '22' : 'rgba(255,255,255,0.08)',
                                color: meta?.color || 'rgba(255,255,255,0.8)',
                                marginRight: 6, letterSpacing: '0.04em',
                              }}>{l.cxo} {CXO_NAMES[l.cxo]}</span>
                            )}
                            <span style={{ color: stepMeta.textColor }}>
                              {stepMeta.prefix} {l.text}
                            </span>
                          </div>
                          {l.detail && (
                            <div style={{
                              fontSize: 10, color: 'rgba(255,255,255,0.4)',
                              marginTop: 2, lineHeight: 1.4,
                              fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
                            }}>
                              ↳ {l.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {busy && groupBySession(log).slice(-1)[0]?.some((l) => l.kind === 'done') === false && null}
            <div ref={logEndRef} />
          </div>

          {/* コマンド 入力 */}
          <div style={{
            padding: '10px 12px 14px',
            borderTop: `1px solid ${accent}33`,
            background: 'rgba(0,0,0,0.3)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              padding: '8px 8px 8px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${accent}44`,
              boxShadow: `0 0 0 0 ${accent}, 0 4px 16px rgba(0,0,0,0.3)`,
            }}>
              <span style={{ color: accent, fontWeight: 900, fontSize: 14, lineHeight: 1, alignSelf: 'center' }}>{'>'}</span>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={busy}
                placeholder="指令 を 入力 (⌘+Enter で 送信)"
                rows={1}
                style={{
                  flex: 1, minHeight: 22, maxHeight: 100,
                  resize: 'none', background: 'transparent',
                  border: 'none', outline: 'none',
                  color: '#fff', fontSize: 13, fontWeight: 500,
                  lineHeight: 1.5,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
                }}
              />
              <button
                onClick={submit}
                disabled={busy || !input.trim()}
                aria-label="送信"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: input.trim() && !busy
                    ? `linear-gradient(135deg, ${accent}, ${accent2})`
                    : 'rgba(255,255,255,0.08)',
                  color: input.trim() && !busy ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: 'none', cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 800,
                  flexShrink: 0, alignSelf: 'flex-end',
                  boxShadow: input.trim() && !busy ? `0 4px 14px ${accent}55` : 'none',
                }}
              >↵</button>
            </div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              marginTop: 6, textAlign: 'center', letterSpacing: '0.04em',
            }}>
              ⌘ + Enter で 送信 · 指令 は 自動 で 担当 役員 に 振り分け
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── helpers ─────────────────────────────────
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
function fmtTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** ステップ 種類 別 の 表示 メタ (Claude Code 風) */
const STEP_META: Record<LogLine['kind'], {
  icon: string; bg: string; fg: string; textColor: string; prefix: string;
}> = {
  user:      { icon: '>', bg: 'transparent',           fg: '#A78BFA',           textColor: '#fff',                prefix: '' },
  route:     { icon: '↓', bg: 'rgba(167,139,250,0.2)', fg: '#A78BFA',           textColor: 'rgba(167,139,250,0.95)', prefix: '🎯' },
  thinking:  { icon: '💭', bg: 'rgba(251,191,36,0.2)', fg: '#FBBF24',           textColor: 'rgba(255,255,255,0.85)', prefix: '💭 思考中:' },
  executing: { icon: '⚡', bg: 'rgba(34,211,238,0.2)', fg: '#22D3EE',           textColor: 'rgba(255,255,255,0.92)', prefix: '⚡ 実行中:' },
  done:      { icon: '✓', bg: 'rgba(52,211,153,0.25)', fg: '#34D399',           textColor: '#34D399',                prefix: '✓ 完了:' },
  error:     { icon: '⚠', bg: 'rgba(248,113,113,0.25)', fg: '#F87171',          textColor: '#FCA5A5',                prefix: '⚠' },
};

/** ログ を 同じ sessionId で グループ化 (新しい セッション 順) */
function groupBySession(log: LogLine[]): LogLine[][] {
  const map = new Map<string, LogLine[]>();
  for (const l of log) {
    const key = l.sessionId || `solo-${l.id}`;
    const arr = map.get(key) || [];
    arr.push(l);
    map.set(key, arr);
  }
  return Array.from(map.values());
}
function loadLog(): LogLine[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 旧 ログ migration: kind 名 + sessionId を 補完
    const KIND_MAP: Record<string, LogLine['kind']> = {
      user: 'user', system: 'route', agent: 'executing', done: 'done',
    };
    return arr.map((l: any) => ({
      id: String(l.id || ''), ts: Number(l.ts || Date.now()),
      sessionId: String(l.sessionId || `legacy-${l.id || ''}`),
      kind: (KIND_MAP[l.kind] || l.kind || 'executing') as LogLine['kind'],
      cxo: l.cxo, text: String(l.text || ''), detail: l.detail,
    })).slice(-MAX_LOG);
  } catch { return []; }
}
function saveLog(log: LogLine[]) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_LOG))); } catch { /* */ }
}
