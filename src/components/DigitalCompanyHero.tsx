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
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { statsForPersona, listDeliverables } from '../lib/cxoDeliverables';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  /** ポップオーバー で 「任せる」 が 押された 時 — AgentTeamMonitor を 開く */
  onCxoClick?: (role: CxoRole) => void;
}

// 14 名 を 役職 順 に 並べる
const CXO_ORDER: CxoRole[] = ['CEO', 'CTO', 'CPO', 'CDO', 'CMO', 'CSO', 'CFO', 'COO', 'CDS', 'CLO', 'UIE', 'UXE', 'QAE', 'CHR'];

// 役員 の 「肩書 + 名前」 (お飾り 感 を 消す ため プロフィール 風)
const CXO_PROFILE: Record<CxoRole, { name: string; tagline: string }> = {
  CEO: { name: '陽翔',  tagline: '全体 を まとめ、 優先順位 を 決める'  },
  CTO: { name: '匠',    tagline: '技術 / 自動化 / 連携 を 設計'         },
  CPO: { name: '凛',    tagline: '機能 / 仕様 / 商標 / ロードマップ'    },
  CDO: { name: '蒼',    tagline: 'KPI / 仮説 / 分析'                  },
  CMO: { name: '陽菜',  tagline: '広告 / SNS / コンテンツ'             },
  CSO: { name: '誠',    tagline: '営業 / 商談 / 提案 / 督促'           },
  CFO: { name: '颯太',  tagline: '損益 / 資金繰り / 投資 判断'          },
  COO: { name: '葵',    tagline: '業務 プロセス / SOP / 委託'           },
  CDS: { name: '陸',    tagline: '競合 / 業界 動向 / リサーチ'         },
  CLO: { name: '結衣',  tagline: '契約 / 商標 / 個情法 / 約款'          },
  UIE: { name: '美海',  tagline: 'UI / コピー / 動線 を 磨く'           },
  UXE: { name: '玲奈',  tagline: 'デザイン / バナー / 配色'             },
  QAE: { name: '律',    tagline: 'バグ / 沈黙エラー / 数字嘘 検知'      },
  CHR: { name: '優',    tagline: '採用 / 評価 / 1 on 1 質問'           },
};

export default function DigitalCompanyHero({ persona, onCxoClick }: Props) {
  const { tasks } = useAgentTaskQueue();
  const [stats, setStats] = useState(() => statsForPersona(persona.id));
  const [items, setItems] = useState(() => listDeliverables(persona.id));
  // 役員 を タップ した 時 に 役割 + 任せられる 仕事 を 見せる ポップオーバー
  const [popoverRole, setPopoverRole] = useState<CxoRole | null>(null);

  // 役員 日報 が 増えたら 自動 更新
  useEffect(() => {
    const refresh = () => {
      setStats(statsForPersona(persona.id));
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
  const cxoStatus = useMemo(() => {
    const map: Record<string, { state: 'working' | 'idle'; lastDelivery?: string; doneCount: number }> = {};
    for (const role of CXO_ORDER) {
      const running = tasks?.find?.((t) => t.status === 'running' && t.steps?.some?.((s: any) => s.cxo === role && s.status === 'working'));
      const lastDel = items.find((d) => d.cxoRole === role);
      const doneCount = items.filter((d) => d.cxoRole === role).length;
      map[role] = {
        state: running ? 'working' : 'idle',
        lastDelivery: lastDel?.title,
        doneCount,
      };
    }
    return map;
  }, [tasks, items]);

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
            fontSize: 10, letterSpacing: '0.24em', fontWeight: 800,
            color: accent, marginBottom: 4,
          }}>🏢 あなた の デジタル 会社</div>
          <h1 style={{
            fontSize: 'clamp(1.4rem, 4.5vw, 2rem)', fontWeight: 900,
            margin: 0, lineHeight: 1.2, color: 'var(--fg-strong)',
            letterSpacing: '-0.02em',
          }}>
            {companyName} <span style={{ color: 'var(--fg-subtle)', fontWeight: 600, fontSize: '0.65em' }}>役員 会議室</span>
          </h1>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
            👥 役員 14 名 在籍 · 今日 動いた {Object.values(cxoStatus).filter((s) => s.doneCount > 0).length} 名 · 累計 納品 {stats.totalCount} 件
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
            <>🟢 全員 待機 中</>
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
          const prof = CXO_PROFILE[role];
          const st = cxoStatus[role];
          const working = st?.state === 'working';
          const hasDone = (st?.doneCount || 0) > 0;
          return (
            <motion.button
              key={role}
              type="button"
              onClick={() => setPopoverRole(role)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '10px 8px 8px',
                borderRadius: 12,
                background: working
                  ? `linear-gradient(135deg, ${meta.color}30, ${meta.color}10)`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${working ? meta.color : hasDone ? meta.color + '55' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer', color: 'inherit',
                position: 'relative', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
              aria-label={`${role} ${prof.name} に 依頼`}
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
              {/* アバター 円 */}
              <div style={{
                width: 38, height: 38, borderRadius: 999,
                background: `linear-gradient(135deg, ${meta.color}, ${meta.color}80)`,
                color: '#0a0a0f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900,
                boxShadow: working ? `0 0 18px ${meta.color}99` : `0 2px 8px ${meta.color}55`,
                marginBottom: 2,
              }}>
                {meta.emoji}
              </div>
              {/* 役職 ピル */}
              <div style={{
                fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
                padding: '1px 6px', borderRadius: 999,
                background: meta.color + '22',
                color: meta.color,
                border: `1px solid ${meta.color}44`,
              }}>{role}</div>
              {/* 名前 */}
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-strong)' }}>
                {prof.name}
              </div>
              {/* tagline (小さく) */}
              <div style={{
                fontSize: 8, lineHeight: 1.3, color: 'var(--fg-subtle)',
                marginTop: 1, minHeight: 22,
              }}>{prof.tagline}</div>
              {/* 実行中 ラベル */}
              {working && (
                <div style={{
                  marginTop: 3,
                  fontSize: 8, fontWeight: 800, color: '#34D399',
                  padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.35)',
                }}>💼 実行中</div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* フッタ: 直近 の 納品 (最新 1 件 を ティッカー 風 に) */}
      {items.length > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 10,
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          position: 'relative',
        }}>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 999, fontWeight: 800,
            background: accent, color: 'var(--fg-strong)', letterSpacing: '0.08em',
          }}>📦 直近 納品</span>
          <span style={{ fontSize: 12, color: 'var(--fg-strong)', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {items[0].cxoEmoji} {items[0].cxoName} → 「{items[0].title}」
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

      {/* CTA ヒント */}
      {items.length === 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
          fontSize: 12, color: '#FBBF24', lineHeight: 1.5,
        }}>
          💡 まず 1 人 タップ してみて ください。 60 秒 で 役員 が 仕事 を 仕上げて 役員 日報 に 納品 します。
        </div>
      )}

      {/* 役員 タップ ポップオーバー (役割 + 任せられる 仕事 リスト) */}
      <AnimatePresence>
        {popoverRole && (() => {
          const meta = CXO_META[popoverRole];
          const prof = CXO_PROFILE[popoverRole];
          const st = cxoStatus[popoverRole];
          const canDo = meta.canDo || [];
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setPopoverRole(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 480,
                  // light/dark 両対応: bg-2 を base に、 light で 黒文字 が 読める
                  background: 'var(--bg-2)',
                  borderRadius: 18,
                  border: `1px solid ${meta.color}66`,
                  boxShadow: `0 24px 60px rgba(0,0,0,0.4), 0 0 32px ${meta.color}33`,
                  padding: '20px 22px 18px',
                  color: 'var(--fg-strong)',
                }}
              >
                {/* ヘッダ: アバター + 役職 + 名前 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: `linear-gradient(135deg, ${meta.color}, ${meta.color}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, color: '#0a0a0f', flexShrink: 0,
                    boxShadow: `0 0 22px ${meta.color}88`,
                  }}>{meta.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 900, letterSpacing: '0.14em',
                      color: meta.color, marginBottom: 2,
                    }}>{popoverRole} · {meta.name || ''}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1.2 }}>
                      {prof.name} さん
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {prof.tagline}
                    </div>
                  </div>
                  <button
                    onClick={() => setPopoverRole(null)}
                    aria-label="閉じる"
                    style={{
                      width: 32, height: 32, borderRadius: 999,
                      background: 'var(--surface-3)', color: 'var(--fg-strong)',
                      border: '1px solid var(--border, rgba(0,0,0,0.1))', cursor: 'pointer',
                      fontSize: 16, lineHeight: 1, flexShrink: 0,
                    }}
                  >×</button>
                </div>

                {/* これまで の 仕事 */}
                {(st?.doneCount || 0) > 0 && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    fontSize: 11, color: '#34D399',
                  }}>
                    📦 これ まで {st.doneCount} 件 納品 — {st.lastDelivery ? `直近: 「${st.lastDelivery}」` : ''}
                  </div>
                )}

                {/* 任せられる 仕事 */}
                <div style={{
                  fontSize: 10, letterSpacing: '0.18em', fontWeight: 800,
                  color: 'var(--fg-subtle)', marginBottom: 8,
                }}>👇 今 任せられる 仕事</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {canDo.slice(0, 4).map((task: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPopoverRole(null);
                        // 親 へ 通知 — AgentTeamMonitor を 開く 等
                        try { onCxoClick?.(popoverRole); } catch { /* */ }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px', borderRadius: 10,
                        background: 'var(--surface-3)',
                        border: `1px solid ${meta.color}33`,
                        color: 'var(--fg-strong)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{
                        fontSize: 14, color: meta.color, flexShrink: 0,
                      }}>✨</span>
                      <span style={{ flex: 1 }}>{task}</span>
                      <span style={{ fontSize: 12, color: meta.color, fontWeight: 800 }}>→</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setPopoverRole(null);
                    try { onCxoClick?.(popoverRole); } catch { /* */ }
                  }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                    color: '#0a0a0f', fontSize: 13, fontWeight: 900,
                    border: 'none', cursor: 'pointer',
                    boxShadow: `0 6px 20px ${meta.color}55`,
                  }}
                >🏢 {prof.name} さん に 任せる</button>
                <div style={{
                  marginTop: 8, fontSize: 10, color: 'var(--fg-subtle)', textAlign: 'center',
                }}>右下 の 「役員 会議室」 が 開いて 詳細 の 仕事 選択 へ</div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
