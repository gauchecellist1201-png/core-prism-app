// ============================================================
// LiveAgentMock — LP ヒーロー右側に置く「動く AgentTeamMonitor 風」モック
//
// 静止画ではなく React + framer-motion で実際に動かす:
//   - 13 CXO アバターを格子状に並べ、常時パルス
//   - 4.5 秒ごとに「CFO が経費を確認中…」などのメッセージが切り替わる
//   - 切り替えに同期して、対応する CXO アバターが「働いてる」状態にハイライト
//
// Prism / Iris 両方の LP で使用。trial=false で純表示。
// ============================================================
import { motion, AnimatePresence } from 'framer-motion';
import { TRIAL_BASE_DAYS } from '../lib/referral';
import { useEffect, useState } from 'react';
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

type Theme = 'prism' | 'iris';

// 表示順 (CEO は中央、9 CXO + 3 エンジニア)
const DISPLAY_ORDER: CxoRole[] = [
  'CEO', 'CTO', 'CPO', 'CDO', 'CMO',
  'CSO', 'CFO', 'COO', 'CDS', 'CLO',
  'UIE', 'UXE', 'QAE',
];

// rotating メッセージ (CXO / 文言 / 完了感のあるアクション)
const PRISM_TICKER: { cxo: CxoRole; msg: string }[] = [
  { cxo: 'CFO', msg: '今月の経費レシート 12 枚を仕訳中…' },
  { cxo: 'CSO', msg: '見込み先 5 社に AI が提案文を起草中…' },
  { cxo: 'CMO', msg: 'X / note 用の投稿コピーを 3 案作成中…' },
  { cxo: 'COO', msg: '今週の議事録を要点 + アクション化中…' },
  { cxo: 'CPO', msg: '次に作るべき機能を 3 つに絞り込み中…' },
  { cxo: 'CDS', msg: '今週の指標を集計、異常値を検出中…' },
  { cxo: 'CDO', msg: 'OG 画像と LP 配色を再点検中…' },
  { cxo: 'CLO', msg: '今週届いた契約書 1 通の論点を抽出中…' },
  { cxo: 'CEO', msg: '判断保留の議題 3 件を棚卸し中…' },
];

const IRIS_TICKER: { cxo: CxoRole; msg: string }[] = [
  { cxo: 'CMO', msg: '今夜の Instagram 投稿コピーを起草中…' },
  { cxo: 'CSO', msg: '届いた PR 案件 DM を案件カード化中…' },
  { cxo: 'CDO', msg: 'リールのサムネ 3 案を生成中…' },
  { cxo: 'CDS', msg: '今週の伸びた投稿の共通点を分析中…' },
  { cxo: 'CPO', msg: '次に試すコンテンツ型を 3 つ選定中…' },
  { cxo: 'COO', msg: '撮影スケジュールと投稿時間を最適化中…' },
  { cxo: 'CFO', msg: '今月の案件売上を集計、振込予定を算出中…' },
  { cxo: 'CLO', msg: 'PR 契約書のリスク条項を点検中…' },
];

interface Props {
  theme?: Theme;
}

export default function LiveAgentMock({ theme = 'prism' }: Props) {
  const tickerData = theme === 'iris' ? IRIS_TICKER : PRISM_TICKER;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick(t => (t + 1) % tickerData.length), 4500);
    return () => window.clearInterval(id);
  }, [tickerData.length]);

  const active = tickerData[tick];
  const accent = CXO_META[active.cxo].color;

  // テーマカラー
  const bg = theme === 'iris'
    ? 'linear-gradient(150deg, rgba(45,15,60,0.92) 0%, rgba(20,5,30,0.95) 100%)'
    : 'linear-gradient(150deg, rgba(21,21,42,0.92) 0%, rgba(10,10,24,0.95) 100%)';
  const borderColor = theme === 'iris' ? 'rgba(225,48,108,0.32)' : 'rgba(167,139,250,0.28)';
  const ringGlow = theme === 'iris' ? 'rgba(225,48,108,0.32)' : 'rgba(167,139,250,0.32)';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 22,
        background: bg,
        border: `1px solid ${borderColor}`,
        padding: '1.1rem 1.1rem 1.25rem',
        boxShadow: `0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px ${ringGlow}`,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* 内側にグラデ光 */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: -80, right: -80, width: 240, height: 240,
          borderRadius: '50%', background: accent, opacity: 0.18, filter: 'blur(60px)',
          transition: 'background 0.6s ease',
          pointerEvents: 'none',
        }}
      />

      {/* ── ヘッダ: ウィンドウ風 ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem', position: 'relative', zIndex: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
        <div style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace',
          letterSpacing: '0.04em',
        }}>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80' }}
          />
          LIVE · AI 役員 13 名稼働中
        </div>
      </div>

      {/* ── ティッカー (現在働いてる CXO の文言) ─────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        background: `linear-gradient(135deg, ${accent}24, ${accent}10)`,
        border: `1px solid ${accent}40`,
        borderRadius: 14,
        padding: '0.85rem 1rem',
        marginBottom: '0.95rem',
        minHeight: 78,
        transition: 'background 0.6s ease, border-color 0.6s ease',
      }}>
        <div style={{
          fontSize: '0.55rem', letterSpacing: '0.25em', fontWeight: 700,
          color: accent, marginBottom: 4, textTransform: 'uppercase',
        }}>
          NOW WORKING · {active.cxo}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={tick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              fontSize: '0.92rem', color: '#fff', fontWeight: 600, lineHeight: 1.45,
            }}
          >
            <MetaIcon meta={CXO_META[active.cxo]} size={20} strokeWidth={2.2} />
            <span>{active.msg}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── CXO アバター格子 ─────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.4rem',
      }}>
        {DISPLAY_ORDER.map((role, i) => {
          const meta = CXO_META[role];
          const isActive = role === active.cxo;
          return (
            <motion.div
              key={role}
              animate={isActive ? { scale: [1, 1.12, 1] } : { scale: [1, 1.04, 1] }}
              transition={{
                duration: isActive ? 1.4 : 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: isActive ? 0 : (i * 0.13) % 2.5,
              }}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 10,
                background: isActive
                  ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                  : `${meta.color}26`,
                border: isActive
                  ? `1.5px solid ${meta.color}`
                  : `1px solid ${meta.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(0.85rem, 2.4vw, 1.1rem)',
                boxShadow: isActive
                  ? `0 8px 22px ${meta.color}88, inset 0 1px 0 rgba(255,255,255,0.22)`
                  : `0 4px 10px ${meta.color}33`,
                transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
              }}
              title={meta.name}
            >
              <MetaIcon meta={meta} size={20} color={isActive ? '#fff' : meta.color} strokeWidth={2.2} />
              {isActive && (
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.4, 1.7] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: -3,
                    borderRadius: 12,
                    border: `2px solid ${meta.color}`,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── フッタ: 統計風 (嘘の数字は書かない、無料/解約の事実だけ) ─────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        marginTop: '1rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem',
      }}>
        {[
          { label: '初期費用', value: '¥0' },
          { label: '無料お試し', value: `${TRIAL_BASE_DAYS} 日` },
          { label: '解約', value: '1 タップ' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '0.45rem 0.55rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 2 }}>{stat.label}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
