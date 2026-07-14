// ============================================================
// HowItWorks — 公開「導入の流れ」 3 ステップ アコーディオン
//
// オーナー指示 (2026-06-04 第 44 波 RRRRRR):
//   /lp/* の 比較表 の下 に「3 ステップ (登録 / 接続 / AI に任せる) で 5 分」
//   1 シーンずつ アコーディオン (アクセスしやすい折りたたみ式)
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, Plus } from 'lucide-react';

interface Step {
  num: number;
  emoji: string;
  title: string;
  duration: string;       // 「30 秒」「2 分」「1 分」
  short: string;          // 1 行 サマリ
  detail: string[];       // 詳細 箇条書き
  tip?: string;           // 補足
}

const STEPS: Step[] = [
  {
    num: 1,
    emoji: '✍️',
    title: '登録 (アカウント作成)',
    duration: '30 秒',
    short: 'メール 1 つ で 完了。クレカ 不要、 3 日間 無料。',
    detail: [
      'メールアドレス 入力 → 確認 リンクを クリック',
      '名前 / 業種 を 選択 (あとで 変えられます)',
      '入力 した瞬間 から AI 役員 が 動き始める',
    ],
    tip: 'Google ログイン も 1 タップ。 氏名 / 業種 は スキップ可。',
  },
  {
    num: 2,
    emoji: '🔌',
    title: '接続 (AI と あなたの データ)',
    duration: '2 分',
    short: 'Claude API キー or デモ モード を 選ぶだけ。',
    detail: [
      '無料 Anthropic API キー (sk-ant-...) を コピペ → 即接続',
      '「あとで」 を 選んで デモ データ (CAFE TANAKA) で 試すことも可能',
      '会計 / CRM / SNS / メール の 連携 は 後で 個別 ON (任意)',
    ],
    tip: '初期は デモ モード で 触ってもらって OK。本番接続は 後でも。',
  },
  {
    num: 3,
    emoji: '🤖',
    title: 'AI に任せる (即実行)',
    duration: '1 分',
    short: 'CXO を タップ → 「お願いします」 で 1 分以内 に 結果。',
    detail: [
      'ダッシュボード で 14 役員 から 1 名 を タップ',
      '「いま 任せられること」 3 つ から 選ぶ',
      '1 分以内 に 提案 / 提案書 / メール下書き が 返ってくる',
      '気に入った 結果 は タスク に保存 → 採用率 が 履歴 (Cmd+Shift+H) に',
    ],
    tip: '最初の 3 タスク (CFO / CSO / CMO) を D3 メール でも 案内します。',
  },
];

interface Props {
  accentLeft?: string;
  accentRight?: string;
}

export default function HowItWorks({ accentLeft = '#A78BFA', accentRight = '#F472B6' }: Props) {
  const [open, setOpen] = useState<Set<number>>(new Set([1])); // 最初の 1 つだけ 開く

  const toggle = (n: number) => {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      style={{
        padding: '5rem 1.5rem',
        background: 'linear-gradient(180deg, #080812 0%, #0d0d22 100%)',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center', fontSize: 11, letterSpacing: '0.3em',
          color: accentRight, fontWeight: 700, marginBottom: 8,
        }}>
          HOW IT WORKS
        </div>
        <h2
          id="how-heading"
          style={{
            textAlign: 'center', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 900, lineHeight: 1.25, color: '#fff',
            margin: '0 0 8px',
          }}
        >
          3 ステップ で <span style={{
            background: `linear-gradient(120deg, ${accentLeft}, ${accentRight})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>5 分</span>
        </h2>
        <p style={{
          textAlign: 'center', fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
          margin: '0 auto 36px', maxWidth: 560,
        }}>
          登録 → 接続 → AI に任せる。 これだけ。
          「設定 1 時間」 を 「タップ 1 回」 に。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((s) => {
            const isOpen = open.has(s.num);
            return (
              <div
                key={s.num}
                style={{
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isOpen ? `${accentLeft}55` : 'rgba(255,255,255,0.08)'}`,
                  overflow: 'hidden',
                  transition: 'border 0.2s',
                }}
              >
                <button
                  onClick={() => toggle(s.num)}
                  aria-expanded={isOpen}
                  aria-controls={`how-panel-${s.num}`}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 22px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, color: '#fff', flexShrink: 0,
                    boxShadow: `0 8px 20px ${accentLeft}44`,
                  }}>{s.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: accentRight, fontWeight: 800, letterSpacing: '0.18em' }}>
                        STEP {s.num}
                      </span>
                      <span style={{
                        fontSize: 11, padding: '2px 9px', borderRadius: 999,
                        background: `${accentLeft}22`, color: accentLeft, fontWeight: 800,
                      }}>{s.duration}</span>
                    </div>
                    <h3 style={{ margin: '4px 0 4px', fontSize: '1.05rem', fontWeight: 900, lineHeight: 1.4 }}>{s.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{s.short}</p>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown size={20} color={`${accentLeft}cc`} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`how-panel-${s.num}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 22px 22px', borderTop: `1px solid ${accentLeft}22` }}>
                        <ul style={{
                          margin: '16px 0 0', padding: 0,
                          listStyle: 'none',
                          display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                          {s.detail.map((d, i) => (
                            <li
                              key={i}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)',
                                lineHeight: 1.7,
                              }}
                            >
                              <CheckCircle2 size={14} color={accentLeft} style={{ flexShrink: 0, marginTop: 4 }} />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                        {s.tip && (
                          <div style={{
                            marginTop: 14,
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.25)',
                            fontSize: '0.82rem',
                            color: 'rgba(255,231,176,0.95)',
                            lineHeight: 1.7,
                          }}>
                            💡 {s.tip}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* CTA: 全部開く / アクション */}
        <div style={{
          marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => setOpen(new Set([1, 2, 3]))}
            style={{
              padding: '8px 16px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Plus size={13} /> 全部 開く
          </button>
          <p style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', margin: 0 }}>
            合計 <strong style={{ color: '#fff' }}>5 分</strong> で 14 役員 が 動き始めます。
          </p>
        </div>
      </div>
    </section>
  );
}
