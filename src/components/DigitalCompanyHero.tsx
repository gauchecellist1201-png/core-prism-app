// ============================================================
// DigitalCompanyHero — 「デジタル に 自分 の 会社 を 持って いる」 体感 を 出す ヒーロー
//
// オーナー指示 (2026-06-05):
//   「デジタル 上 に 会社 を 作れる ニュアンス を もっと UI で 出して。
//    CXO の 存在感 が 右下 で 小さい の で、 もっと 大きく して。」
//
// 設計:
//   - ダッシュ 最上段 に 「🏢 株式会社 X」 ヘッダ (ペルソナ 名 + 設立 日 + 役員数)
//   - 14 名 の CXO を 大きな カード で 横並び (役職 + 名前 + 今 動いて いる 仕事)
//   - 各 CXO に 「💼 営業中 / 🟢 待機中」 ステータス バッジ
//   - 「今日 動いた 役員」「今週 の 納品 件数」 を 上部 に
//   - タップ で 役員 に 即 依頼 (AgentTeamMonitor の popover を 呼び出し)
// ============================================================
import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Briefcase, Package, Lightbulb, CheckCircle2, MousePointerClick, Sparkles } from 'lucide-react';
import { CXO_META, type CxoRole, cxoDisplayName } from '../hooks/useAgentTaskQueue';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { realStatsForPersona, listDeliverables, logDeliverable } from '../lib/cxoDeliverables';
import type { Persona } from '../types/identity';
import { useSettings } from '../hooks/useSettings';
import InlineActionExecutor from './InlineActionExecutor';

interface Props {
  persona: Persona;
  /** ポップオーバー で 「任せる」 が 押された 時 — AgentTeamMonitor を 開く */
  onCxoClick?: (role: CxoRole) => void;
}

// 14 名 を 役職 順 に 並べる
const CXO_ORDER: CxoRole[] = ['CEO', 'CTO', 'CPO', 'CDO', 'CMO', 'CSO', 'CFO', 'COO', 'CDS', 'CLO', 'UIE', 'UXE', 'QAE', 'CHR'];

// 役員 の 担当 領域 (オーナー指示 2026-06-05: 個別 名前 削除 — 役職 で 識別)
const CXO_TAGLINE: Record<CxoRole, string> = {
  CEO: '統括 / 優先順位',
  CTO: '技術 / 自動化',
  CPO: '機能 / ロードマップ',
  CDO: 'KPI / 分析',
  CMO: '集客 / SNS',
  CSO: '営業 / 商談',
  CFO: '損益 / 資金',
  COO: '運用 / SOP',
  CDS: '競合 / リサーチ',
  CLO: '契約 / 法務',
  UIE: 'UI / 動線',
  UXE: 'デザイン',
  QAE: '品質 / 検証',
  CHR: '採用 / 評価',
};

// CXO ごと の 「タップ で 一発 着手」 する 標準 タスク
const CXO_QUICK_TASK: Record<CxoRole, string> = {
  CEO: '現状 を 整理 して 今週 やる べき 3 件 を 提案',
  CTO: '自動 化 できる 業務 を 3 つ ピックアップ',
  CPO: '次 リリース の 候補 機能 を 5 つ 整理',
  CDO: 'KPI 異常 値 を 検出 + 仮説 を 3 つ',
  CMO: '今週 の 集客 案 を 3 つ 起案',
  CSO: '商談 候補 リスト を 5 件 用意',
  CFO: '今月 の 損益 を 1 枚 に まとめる',
  COO: '業務 SOP の 改善 ポイント を 3 つ',
  CDS: '競合 3 社 の 動向 を 要約',
  CLO: '契約 / 法務 の チェック ポイント を 整理',
  UIE: 'UI 動線 の 改善 案 を 3 つ',
  UXE: 'デザイン 改善 提案 を 3 つ',
  QAE: '品質 リスク を 検出 + 優先順位',
  CHR: '採用 戦略 を 整理',
};

export default function DigitalCompanyHero({ persona, onCxoClick }: Props) {
  const { tasks } = useAgentTaskQueue();
  const [stats, setStats] = useState(() => realStatsForPersona(persona.id));
  const [items, setItems] = useState(() => listDeliverables(persona.id));
  // 役員 を タップ した 時 に 役割 + 任せられる 仕事 を 見せる ポップオーバー
  const [popoverRole, setPopoverRole] = useState<CxoRole | null>(null);

  // 役員 日報 が 増えたら 自動 更新
  useEffect(() => {
    const refresh = () => {
      setStats(realStatsForPersona(persona.id));
      setItems(listDeliverables(persona.id));
    };
    window.addEventListener('core:deliverable-added', refresh);
    const t = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('core:deliverable-added', refresh);
      window.clearInterval(t);
    };
  }, [persona.id]);

  // 各 CXO の 「今 やって いる 仕事」 を 計算 (running task + 直近 deliverable)
  // 嘘禁止: 「動いた / 納品」 の 数字 は デモ サンプル を 除いた 実際 の 成果物 だけ で 数える
  const realItems = useMemo(() => items.filter((d) => d.source !== 'demo'), [items]);

  const cxoStatus = useMemo(() => {
    const map: Record<string, { state: 'working' | 'idle'; lastDelivery?: string; doneCount: number }> = {};
    for (const role of CXO_ORDER) {
      const running = tasks?.find?.((t) => t.status === 'running' && t.steps?.some?.((s: any) => s.cxo === role && s.status === 'working'));
      const lastDel = realItems.find((d) => d.cxoRole === role);
      const doneCount = realItems.filter((d) => d.cxoRole === role).length;
      map[role] = {
        state: running ? 'working' : 'idle',
        lastDelivery: lastDel?.title,
        doneCount,
      };
    }
    return map;
  }, [tasks, realItems]);

  const workingCount = Object.values(cxoStatus).filter((s) => s.state === 'working').length;
  const accent = persona.accentColor || '#A78BFA';
  const companyName = persona.name || 'あなた';

  return (
    <div
      data-tour-id="digital-company-hero"
      style={{
        marginBottom: 20,
        padding: '18px 18px 14px',
        borderRadius: 18,
        // light/dark 両対応: surface を base に 紫グラデを 乗せる (light でも 文字が 読める)
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(99,102,241,0.10) 100%), var(--surface)',
        border: `1px solid ${accent}55`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景 の 装飾 (会社 ロゴ 風 の グロー) */}
      <div style={{
        position: 'absolute', top: -120, right: -80,
        width: 320, height: 320, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}25 0%, transparent 60%)`,
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />

      {/* ヘッダ: 会社 名 + 設立 + 役員数 */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 14, position: 'relative',
      }}>
        <div data-explain-id="company-title" style={{ cursor: 'pointer' }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
            color: accent, marginBottom: 4,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><Building2 size={12} strokeWidth={2.2} /> あなた の デジタル 会社</div>
          <h1 style={{
            fontSize: 'clamp(1.4rem, 4.5vw, 2rem)', fontWeight: 900,
            margin: 0, lineHeight: 1.2, color: 'var(--fg-strong)',
            letterSpacing: '-0.02em',
          }}>
            {companyName} <span style={{ color: 'var(--fg-subtle)', fontWeight: 600, fontSize: '0.65em' }}>役員 会議室</span>
          </h1>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Users size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} /> 役員 14 名 在籍 · 今日 動いた {Object.values(cxoStatus).filter((s) => s.doneCount > 0).length} 名 · 累計 納品 {stats.totalCount} 件
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 999,
          background: workingCount > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${workingCount > 0 ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
          fontSize: 11, fontWeight: 800,
          color: workingCount > 0 ? '#34D399' : 'var(--fg-muted)',
          whiteSpace: 'nowrap',
        }}>
          {workingCount > 0 ? (
            <>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: 999, background: '#34D399', display: 'inline-block' }}
              />
              {workingCount} 名 実行中
            </>
          ) : (
            <><span style={{ width: 6, height: 6, borderRadius: 999, background: '#9CA3AF', display: 'inline-block' }} /> 全員 待機 中</>
          )}
        </div>
      </div>

      {/* 14 名 CXO カード — グリッド (大きめ) */}
      <div
        data-tour-id="cxo-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8,
          position: 'relative',
        }}
      >
        {CXO_ORDER.map((role) => {
          const meta = CXO_META[role];
          const tagline = CXO_TAGLINE[role];
          const st = cxoStatus[role];
          const working = st?.state === 'working';
          const hasDone = (st?.doneCount || 0) > 0;
          return (
            <motion.button
              key={role}
              type="button"
              onClick={() => setPopoverRole(role)}
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{
                padding: '12px 8px 10px',
                borderRadius: 14,
                background: working
                  ? `linear-gradient(135deg, ${meta.color}30, ${meta.color}10)`
                  : `var(--surface-3)`,
                border: `1px solid ${working ? meta.color : hasDone ? meta.color + '66' : `${meta.color}33`}`,
                cursor: 'pointer', color: 'inherit',
                position: 'relative', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}
              aria-label={`${role} に 依頼`}
            >
              {/* 実行中 パルス */}
              {working && (
                <motion.div
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 8, height: 8, borderRadius: 999,
                    background: '#34D399',
                  }}
                />
              )}
              {working && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: 999,
                  background: '#34D399',
                }} />
              )}
              {/* 納品 数 バッジ */}
              {hasDone && !working && (
                <div style={{
                  position: 'absolute', top: 5, right: 5,
                  fontSize: 8, padding: '1px 5px', borderRadius: 999, fontWeight: 800,
                  background: meta.color, color: '#0a0a0f', lineHeight: 1.4,
                }}>{st.doneCount}</div>
              )}
              {/* アバター 円 (大きめ + ホバー で 光る) */}
              <motion.div
                animate={working ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={working ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                style={{
                  width: 46, height: 46, borderRadius: 999,
                  // 光沢のある球体：左上に白いハイライト → ブランド色 へ。下地の暗さを透かさず鮮やかに。
                  background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 28%, ${meta.color} 58%, ${meta.color} 100%)`,
                  color: '#0a0a0f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900,
                  // 外側にカラーグロー（輝き）＋内側に上ハイライト/下シャドウで艶のある立体感
                  boxShadow: working
                    ? `0 0 28px ${meta.color}, 0 0 50px ${meta.color}88, inset 0 2px 5px rgba(255,255,255,0.6), inset 0 -4px 9px rgba(0,0,0,0.3)`
                    : `0 0 16px ${meta.color}cc, 0 6px 16px ${meta.color}66, inset 0 2px 5px rgba(255,255,255,0.55), inset 0 -4px 9px rgba(0,0,0,0.28)`,
                  marginBottom: 3,
                }}
              >
                <meta.Icon size={22} color="#0a0a0f" strokeWidth={2.4} />
              </motion.div>
              {/* 役職 ピル (大きめ) */}
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                padding: '2px 9px', borderRadius: 999,
                background: meta.color + '22',
                color: meta.color,
                border: `1px solid ${meta.color}55`,
              }}>{role}</div>
              {/* 担当 領域 */}
              <div style={{
                fontSize: 9.5, lineHeight: 1.3, color: 'var(--fg-muted)',
                marginTop: 1, minHeight: 24, fontWeight: 600,
              }}>{tagline}</div>
              {/* 実行中 ラベル */}
              {working && (
                <div style={{
                  marginTop: 3,
                  fontSize: 8, fontWeight: 800, color: '#34D399',
                  padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.35)',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}><Briefcase size={9} strokeWidth={2.4} /> 実行中</div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* フッタ: 直近 の 納品 (最新 1 件 を ティッカー 風 に) — 実際 の 成果物 のみ */}
      {realItems.length > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 10,
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          position: 'relative',
        }}>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 999, fontWeight: 800,
            background: accent, color: 'var(--fg-strong)', letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}><Package size={10} strokeWidth={2.4} /> 直近 納品</span>
          <span style={{ fontSize: 12, color: 'var(--fg-strong)', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {realItems[0].cxoEmoji} {realItems[0].cxoName} → 「{realItems[0].title}」
          </span>
          <a
            href="/briefings"
            style={{
              fontSize: 10, fontWeight: 800, color: accent,
              textDecoration: 'none', padding: '3px 8px', borderRadius: 6,
              background: accent + '22', border: `1px solid ${accent}55`,
              whiteSpace: 'nowrap',
            }}
          >役員 日報 →</a>
        </div>
      )}

      {/* CTA ヒント — まだ 実際 の 納品 が ない 間 (サンプル のみ) は ここ で 最初 の 一手 を 促す */}
      {realItems.length === 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
          fontSize: 12, color: '#FBBF24', lineHeight: 1.5,
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <Lightbulb size={14} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} /> <span>まず 1 人 タップ してみて ください。 60 秒 で 役員 が 仕事 を 仕上げて 役員 日報 に 納品 します。</span>
        </div>
      )}

      {/* 役員 タップ → 実際 に 動き出す ポップオーバー (InlineActionExecutor 内蔵) */}
      <AnimatePresence>
        {popoverRole && (
          <CxoActionPopover
            role={popoverRole}
            persona={persona}
            doneCount={cxoStatus[popoverRole]?.doneCount || 0}
            lastDone={cxoStatus[popoverRole]?.lastDelivery}
            quickTask={CXO_QUICK_TASK[popoverRole]}
            onClose={() => setPopoverRole(null)}
            onAgentMonitorOpen={() => {
              try { onCxoClick?.(popoverRole); } catch { /* */ }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// CxoActionPopover — タップ で 実際 に 動く ポップオーバー
//
// オーナー指示 (2026-06-05):
//   「クリック したら その 人 が 仕事 し 始めて、 提案 して、 目に 見える 形 で
//    ダイナミック に 表現 して。 ポンコツ じゃ なくて 実際 に 動かして。」
//
// 動き:
//   1. 開いた 瞬間 に 「💼 [役員] が 動き始めて います…」
//   2. 「今 すぐ 着手」 ボタン → InlineActionExecutor 起動 (本物 の AI 実行)
//   3. AI が plan を 立てる → ステップ を 順に 表示 → 成果物 完成
//   4. 完了 で 役員 日報 に 自動 納品 + 緑 チェック
//   5. 「もっと 細かく 任せる」 で AgentTeamMonitor へ ジャンプ
// ============================================================
function CxoActionPopover({
  role, persona, doneCount, lastDone, quickTask, onClose, onAgentMonitorOpen,
}: {
  role: CxoRole;
  persona: Persona;
  doneCount: number;
  lastDone?: string;
  quickTask: string;
  onClose: () => void;
  onAgentMonitorOpen: () => void;
}) {
  const meta = CXO_META[role];
  const { settings } = useSettings();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const canDoList = (meta.canDo || []).slice(0, 4);
  const allTasks = [quickTask, ...canDoList.filter((t) => t !== quickTask)].slice(0, 4);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
          background: 'var(--bg-2)',
          borderRadius: 22,
          border: `2px solid ${meta.color}`,
          boxShadow: `0 28px 70px rgba(0,0,0,0.55), 0 0 60px ${meta.color}55`,
          padding: '22px 24px 20px',
          color: 'var(--fg-strong)',
        }}
      >
        {/* ヘッダ: アバター + 役職 (大きく、 ダイナミック に 入場) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <motion.div
            initial={{ scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 18 }}
            style={{
              width: 72, height: 72, borderRadius: 20,
              background: `radial-gradient(circle at 30% 22%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 30%, ${meta.color} 60%, ${meta.color} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, color: '#0a0a0f', flexShrink: 0,
              boxShadow: `0 0 34px ${meta.color}cc, 0 8px 22px rgba(0,0,0,0.4), inset 0 3px 6px rgba(255,255,255,0.55), inset 0 -5px 11px rgba(0,0,0,0.3)`,
              position: 'relative',
            }}
          >
            <meta.Icon size={34} color="#0a0a0f" strokeWidth={2.2} />
            {/* 動いて いる 時 の パルス */}
            {phase === 'running' && (
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: -4,
                  borderRadius: 22,
                  border: `2px solid ${meta.color}`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </motion.div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 900, letterSpacing: '0.2em',
              color: meta.color, marginBottom: 2,
            }}>{role} エージェント</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1.15, color: 'var(--fg-strong)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {phase === 'idle' ? '何 を 任せます か?' :
               phase === 'running' ? <><Briefcase size={20} strokeWidth={2.4} /> 動いて います…</> :
               <><CheckCircle2 size={20} strokeWidth={2.4} color="#34D399" /> 納品 しました</>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
              {meta.tagline || CXO_TAGLINE[role]}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: 'var(--surface-3)', color: 'var(--fg-strong)',
              border: '1px solid var(--border, rgba(0,0,0,0.12))', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, flexShrink: 0, fontWeight: 700,
            }}
          >×</button>
        </div>

        {/* 過去 の 納品 (ピル) */}
        {doneCount > 0 && (
          <div style={{
            padding: '8px 12px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.4)',
            fontSize: 11, color: '#10B981',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Package size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} /> これ まで {doneCount} 件 納品 {lastDone ? `· 直近: 「${lastDone}」` : ''}
          </div>
        )}

        {/* 仕事 選択 (idle) */}
        {phase === 'idle' && (
          <>
            <div style={{
              fontSize: 11, letterSpacing: '0.16em', fontWeight: 800,
              color: 'var(--fg-muted)', marginBottom: 10,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}><MousePointerClick size={13} strokeWidth={2.2} /> タップ で その 仕事 を 今 すぐ 着手</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {allTasks.map((task, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedTask(task);
                    setPhase('running');
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px', borderRadius: 12,
                    background: i === 0 ? `linear-gradient(135deg, ${meta.color}26, ${meta.color}0d)` : 'var(--surface-3)',
                    border: `1px solid ${i === 0 ? meta.color : meta.color + '44'}`,
                    color: 'var(--fg-strong)', fontSize: 13.5, fontWeight: 700, lineHeight: 1.45,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: i === 0 ? `0 4px 14px ${meta.color}33` : 'none',
                  }}
                >
                  {i === 0 && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 800,
                      background: meta.color, color: '#0a0a0f', letterSpacing: '0.06em', flexShrink: 0,
                    }}>おすすめ</span>
                  )}
                  <span style={{ color: meta.color, flexShrink: 0, display: 'inline-flex' }}><Sparkles size={16} strokeWidth={2.2} /></span>
                  <span style={{ flex: 1 }}>{task}</span>
                  <span style={{ fontSize: 18, color: meta.color, fontWeight: 800 }}>→</span>
                </motion.button>
              ))}
            </div>
            <div style={{
              fontSize: 10.5, color: 'var(--fg-subtle)', textAlign: 'center',
              padding: '8px 0 0',
            }}>
              タップ する と {role} が AI で 即 着手 → 役員 日報 に 自動 納品 されます
            </div>
          </>
        )}

        {/* AI 実行 (running / done) */}
        {phase !== 'idle' && selectedTask && (
          <InlineActionExecutor
            action={selectedTask}
            persona={persona}
            settings={settings}
            onClose={() => { setPhase('idle'); setSelectedTask(null); }}
            onComplete={(deliverable, act) => {
              // 役員 日報 に 自動 記録
              try {
                const kindToCategory: Record<string, 'plan' | 'copy' | 'analysis' | 'outreach' | 'design' | 'finance' | 'product' | 'ops' | 'other'> = {
                  text: 'copy', checklist: 'plan', email: 'outreach', table: 'analysis', memo: 'copy',
                };
                logDeliverable({
                  personaId: persona.id,
                  cxoRole: role,
                  cxoName: cxoDisplayName(role),
                  cxoEmoji: meta.emoji,
                  title: deliverable.title || act,
                  summary: act,
                  content: deliverable.content,
                  category: kindToCategory[deliverable.kind] || 'other',
                  source: 'agent-monitor',
                });
              } catch { /* */ }
              setPhase('done');
            }}
          />
        )}

        {/* もっと 細かく 任せる (右下 役員 会議室 へ) */}
        {phase === 'idle' && (
          <button
            onClick={() => { onClose(); onAgentMonitorOpen(); }}
            style={{
              width: '100%', marginTop: 10,
              padding: '8px 14px', borderRadius: 8,
              background: 'transparent', color: meta.color,
              border: `1px solid ${meta.color}44`,
              cursor: 'pointer', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >もっと 細かく 指示 する → 役員 会議室 (右下)</button>
        )}
      </motion.div>
    </motion.div>
  );
}
