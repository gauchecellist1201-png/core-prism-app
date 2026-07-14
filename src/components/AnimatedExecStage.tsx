// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AnimatedExecStage — 14 CXO が実時間で動いている様子をループ表示する LP ステージ
//   - 各 CXO アイコンが順番にハイライト (2 秒) → 仕事 1 行を表示
//   - 約 30 秒で 14 役員一周
//   - 一周後に CTA「あなたの会社、こうなります」
//   - framer-motion でループ再生
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

type Props = {
  onCta?: () => void;
  ctaLabel?: string;
  /** LLLLLL (2026-06-04): CXO ピル を タップ した時 CxoProfileModal を 開く コールバック */
  onCxoClick?: (cxo: CxoRole) => void;
};

type StageBeat = {
  cxo: CxoRole;
  task: string;
  output: string;
};

// CXO ごとの「今やっている仕事」の 1 行 + 出力サンプル
const BEATS: StageBeat[] = [
  { cxo: 'CEO', task: '今週の経営方針を整理しています', output: '✓ 売上 + 18% / 新規 3 社が決裁段階' },
  { cxo: 'CFO', task: '昨日の Stripe 入金を集計しています', output: '✓ 入金 ¥327,800 / 経費仕訳 12 件 完了' },
  { cxo: 'CSO', task: '営業先 1 件にアプローチ文を作成中', output: '✓ 田中商事様 宛 提案文 を Gmail 下書きへ' },
  { cxo: 'CMO', task: '今日の SNS 投稿コピーを 3 本生成', output: '✓ X / Instagram / LINE 3 媒体 配信予約完了' },
  { cxo: 'CPO', task: 'ロードマップ優先度を再計算', output: '✓ Wave 6 を 7 月 1 週へ前倒し' },
  { cxo: 'CDO', task: '新規 LP のヒーロー画像を 3 案生成', output: '✓ Option A 採用候補 / プレビュー保存' },
  { cxo: 'CTO', task: 'API レスポンス時間を監視', output: '✓ P95 = 320ms / 異常なし' },
  { cxo: 'COO', task: '在庫 / 仕入れの自動補充を確認', output: '✓ 主要 8 SKU 残量 12% 以下 0 件' },
  { cxo: 'CDS', task: 'リテンション率を分析しています', output: '✓ 30 日継続 78% / 業界 +12pt' },
  { cxo: 'CLO', task: '利用規約 v3 のドラフトを生成', output: '✓ 主要変更点 5 箇所 + 差分レポート' },
  { cxo: 'UIE', task: 'モバイルの細部 8 箇所を磨き', output: '✓ safe-area / フォント / タップ域 修正' },
  { cxo: 'UXE', task: 'オンボーディング完了率を測定', output: '✓ Step 3 で離脱 23% → 改善案 出力' },
  { cxo: 'QAE', task: '出力結果を 3 軸で点検', output: '✓ 数値整合 / 文脈一致 / 言い回し 全て OK' },
  { cxo: 'CHR', task: '採用候補者の応募率を試算', output: '✓ 求人 A は週 12 件想定 / 推奨配信 4 媒体' },
];

const BEAT_MS = 2200;
const FINAL_PAUSE_MS = 3000;

export default function AnimatedExecStage({ onCta, ctaLabel = '3 日間 無料で始める', onCxoClick }: Props) {
  const [step, setStep] = useState(0); // 0..BEATS.length-1 = 各 CXO / BEATS.length = CTA フェーズ
  const isCtaPhase = step >= BEATS.length;
  const currentBeat = BEATS[step] || BEATS[0];
  const meta = CXO_META[currentBeat.cxo];

  useEffect(() => {
    const next = isCtaPhase ? 0 : step + 1;
    const wait = isCtaPhase ? FINAL_PAUSE_MS : BEAT_MS;
    const t = setTimeout(() => setStep(next), wait);
    return () => clearTimeout(t);
  }, [step, isCtaPhase]);

  return (
    <section
      aria-label="14 役員 リアルタイム稼働ステージ"
      style={{
        position: 'relative',
        padding: '4rem 1.25rem 5rem',
        background: 'linear-gradient(180deg, #070712 0%, #0a0a1c 50%, #070712 100%)',
        borderTop: '1px solid rgba(167,139,250,0.10)',
        borderBottom: '1px solid rgba(167,139,250,0.10)',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{
            fontSize: '0.7rem',
            letterSpacing: '0.35em',
            fontWeight: 700,
            color: '#a78bfa',
            marginBottom: '0.7rem',
          }}>
            LIVE — 14 EXECUTIVES, NOW WORKING
          </p>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3.2vw, 2.4rem)',
            fontWeight: 800,
            lineHeight: 1.3,
            marginBottom: '0.75rem',
            color: '#fff',
          }}>
            あなたが寝ている間も、<br />
            <span style={{
              background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6, #fb923c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              14 人の役員 が動いています。
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>
            ※ 表示は実際の機能ベースのシミュレーションです
          </p>
        </div>

        {/* CXO アイコン 14 個グリッド */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.5rem',
            maxWidth: 560,
            margin: '0 auto 2rem',
          }}
        >
          {(Object.keys(CXO_META) as CxoRole[]).map((role) => {
            const isActive = !isCtaPhase && role === currentBeat.cxo;
            const m = CXO_META[role];
            const clickable = !!onCxoClick;
            return (
              <motion.div
                key={role}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={clickable ? `${m.name} の プロフィールを開く` : undefined}
                onClick={clickable ? () => onCxoClick?.(role) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCxoClick?.(role); } } : undefined}
                animate={{
                  scale: isActive ? 1.18 : 1,
                  opacity: isActive ? 1 : 0.45,
                }}
                whileHover={clickable ? { scale: isActive ? 1.22 : 1.08, opacity: 1 } : undefined}
                whileTap={clickable ? { scale: 0.95 } : undefined}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  background: isActive ? `${m.color}22` : 'rgba(255,255,255,0.04)',
                  border: isActive ? `2px solid ${m.color}` : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? `0 0 24px ${m.color}66` : 'none',
                  cursor: clickable ? 'pointer' : 'default',
                  outline: 'none',
                }}
              >
                <div style={{ lineHeight: 1 }}>
                  <MetaIcon meta={m} size={22} color={isActive ? m.color : 'rgba(255,255,255,0.85)'} strokeWidth={2.1} />
                </div>
                <div style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  marginTop: 4,
                  color: isActive ? m.color : 'rgba(255,255,255,0.6)',
                }}>
                  {m.shortLabel}
                </div>
                {isActive && (
                  <motion.div
                    layoutId="active-dot"
                    style={{
                      position: 'absolute',
                      top: 4, right: 4,
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 8px #22c55e',
                    }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* タスク表示パネル */}
        <div
          style={{
            maxWidth: 620,
            margin: '0 auto',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(167,139,250,0.18)',
            borderRadius: 16,
            padding: '1.25rem 1.5rem',
            minHeight: 130,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <AnimatePresence mode="wait">
            {!isCtaPhase ? (
              <motion.div
                key={`beat-${step}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: '0.7rem', letterSpacing: '0.1em',
                  color: meta.color, fontWeight: 700, marginBottom: 8,
                }}>
                  <MetaIcon meta={meta} size={17} color={meta.color} strokeWidth={2.2} />
                  {meta.name}
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#22c55e22',
                    color: '#22c55e',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}>稼働中</span>
                </div>
                <div style={{
                  fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
                  fontWeight: 600,
                  color: '#fff',
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}>
                  {currentBeat.task}
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.6,
                  paddingTop: 10,
                  borderTop: '1px dashed rgba(255,255,255,0.12)',
                }}>
                  {currentBeat.output}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="cta"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.45 }}
                style={{ textAlign: 'center', padding: '0.5rem 0' }}
              >
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.7rem',
                  letterSpacing: '0.2em',
                  color: '#f472b6',
                  fontWeight: 700,
                  marginBottom: 12,
                }}>
                  <Sparkles size={12} /> あなたの会社、こうなります
                </div>
                <div style={{
                  fontSize: 'clamp(1.05rem, 2vw, 1.3rem)',
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 14,
                }}>
                  14 人の役員が、24 時間 365 日、<br />
                  あなたのために働きます。
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onCta}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0.85rem 1.5rem',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #a78bfa, #f472b6)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(167,139,250,0.4)',
                  }}
                >
                  {ctaLabel}
                  <ArrowRight size={16} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 進捗バー */}
        <div
          aria-hidden
          style={{
            maxWidth: 620,
            margin: '1rem auto 0',
            height: 3,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{ height: '100%', background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${((step + 1) / (BEATS.length + 1)) * 100}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>
    </section>
  );
}
