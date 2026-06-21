// ============================================================
// IrisConnectFirst — Iris の「最初のステップ」= Instagram 連携
//
// オーナー指示 (2026-06-18):
//   「IRIS はインスタと連携するところから始まる。一番最初のステップとして、
//    インスタの連携を最初に行えるようにしてほしい。」
//
// 未連携のユーザーがダッシュボードを開く前に、まずこの画面で連携を促す。
// 連携できない事情のある人を閉じ込めない (離脱ゼロ) ため、控えめに「あとで」も用意。
// モバイル最優先 (safe-area / 100svh / タップ 44px 以上)。
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Sparkles, Search, ArrowRight, Eye, ChevronDown,
  TrendingUp, Clapperboard, Handshake,
} from 'lucide-react';
import { IrisLogo } from '../components/Logo';
import InstagramGlyph from './InstagramGlyph';

interface Props {
  /** 「Instagram を連携する」= 連携モーダルを開く */
  onConnect: () => void;
  /** 「あとで連携する」= ゲートを閉じてダッシュボードへ */
  onSkip: () => void;
}

const BENEFITS: { Icon: typeof BarChart3; title: string; desc: string }[] = [
  { Icon: BarChart3, title: '伸びる時間とテーマがわかる', desc: 'あなたの投稿データから、保存される投稿の共通点を分析します' },
  { Icon: Search, title: '相性の良い案件が届く', desc: 'フォロワー層に合うブランド案件を、毎日 AI が探してきます' },
  { Icon: Sparkles, title: '世界観に合った原稿を自動で', desc: 'キャプション・サムネ・リール構成をあなた専用に作ります' },
];

// ── サンプル（連携前に「中身」を 30 秒で見せる）。実物品質の作例＝プレースホルダー禁止。
//    純粋に表示だけ。localStorage も API も一切触らない＝実データ汚染リスクゼロ。
const SAMPLE = {
  handle: 'aya_beauty',
  followers: '8,420',
  analysis: [
    { label: '伸びる時間', value: '木・日 21時台', hint: '保存率が平均の2.3倍' },
    { label: '刺さるテーマ', value: '時短スキンケア', hint: '直近30投稿で最多保存' },
    { label: '次の一手', value: '「朝5分」系を週2本', hint: 'フォロワー層と相性◎' },
  ],
  reel: {
    theme: '時短スキンケア',
    hook: '「朝、化粧水つける時間もない」人に30秒だけください',
    scenes: [
      'スッピンで鏡前→「正直、もう諦めてた」のテロップ',
      '1本で済むオールインワンを手に取り、塗る5秒を実演',
      'メイクのり比較（before/after）で「ここまで変わる」',
    ],
    hashtags: ['#時短スキンケア', '#オールインワン', '#美容好きと繋がりたい'],
  },
  deal: {
    brand: 'スキンケアD2C「mira」',
    fee: '¥40,000 / 1投稿',
    reason: 'フォロワーの78%が女性・20〜34歳。ブランドの理想層と一致',
  },
};

function SamplePreview({ accent }: { accent: string }) {
  const cardBase: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid rgba(225,48,108,0.16)',
    padding: '0.95rem 1rem', boxShadow: '0 8px 22px rgba(225,48,108,0.07)',
  };
  const head = (Icon: typeof BarChart3, step: string, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 9, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(225,48,108,0.13), rgba(247,119,55,0.11))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={accent} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 800, color: accent }}>{step}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1F1A2E' }}>{title}</div>
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 14px' }}>
        <div style={{ fontSize: 11, color: '#8A8593', textAlign: 'center', fontWeight: 600 }}>
          ↓ これは作例です。<strong style={{ color: accent }}>@{SAMPLE.handle}（フォロワー{SAMPLE.followers}）</strong>を連携したら、こうなります
        </div>

        {/* ① 分析 */}
        <div style={cardBase}>
          {head(TrendingUp, 'STEP A', 'あなたの分析')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SAMPLE.analysis.map((a) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8593', width: 64, flexShrink: 0 }}>{a.label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1F1A2E' }}>{a.value}</span>
                <span style={{ fontSize: 10.5, color: accent, fontWeight: 700, marginLeft: 'auto' }}>{a.hint}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ② リール台本 */}
        <div style={cardBase}>
          {head(Clapperboard, 'STEP B', '今日のリール台本')}
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1F1A2E', marginBottom: 6, lineHeight: 1.55 }}>
            フック：「{SAMPLE.reel.hook}」
          </div>
          <ol style={{ margin: '0 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SAMPLE.reel.scenes.map((s, i) => (
              <li key={i} style={{ fontSize: 12, color: '#5A5562', lineHeight: 1.5 }}>{s}</li>
            ))}
          </ol>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {SAMPLE.reel.hashtags.map((h) => (
              <span key={h} style={{
                fontSize: 10.5, fontWeight: 700, color: accent,
                background: 'rgba(225,48,108,0.08)', borderRadius: 99, padding: '3px 9px',
              }}>{h}</span>
            ))}
          </div>
        </div>

        {/* ③ 案件 */}
        <div style={cardBase}>
          {head(Handshake, 'STEP C', '届いた案件')}
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1F1A2E' }}>{SAMPLE.deal.brand}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: accent, margin: '2px 0 6px' }}>{SAMPLE.deal.fee}</div>
          <div style={{ fontSize: 11.5, color: '#7A7585', lineHeight: 1.6 }}>{SAMPLE.deal.reason}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function IrisConnectFirst({ onConnect, onSkip }: Props) {
  const [showSample, setShowSample] = useState(false);
  const accent = '#E1306C';
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        minHeight: '100svh',
        background: 'radial-gradient(ellipse at 50% -10%, rgba(225,48,108,0.16) 0%, #fff 55%)',
        color: '#1F1A2E',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflowY: 'auto',
        padding: 'max(2rem, calc(env(safe-area-inset-top,0px) + 1.5rem)) 1.25rem calc(env(safe-area-inset-bottom,0px) + 1.5rem)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, margin: 'auto 0', display: 'flex', flexDirection: 'column' }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}
        >
          <IrisLogo size={40} withWordmark />
        </motion.div>

        {/* Instagram グラデーションのオーブ + カメラ */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 200, delay: 0.1 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}
        >
          <div style={{
            width: 88, height: 88, borderRadius: 26,
            background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 18px 44px rgba(225,48,108,0.4)',
          }}>
            <InstagramGlyph size={42} color="#fff" strokeWidth={2.2} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ textAlign: 'center', marginBottom: '1.5rem' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10.5, letterSpacing: '0.25em', fontWeight: 800, color: '#E1306C',
            marginBottom: 8,
          }}>
            <InstagramGlyph size={12} color="#E1306C" /> STEP 1 — まずはここから
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.4, margin: '0 0 0.6rem' }}>
            Instagram をつなぐと、<br />Iris があなた専用になります
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#5A5562', lineHeight: 1.75, margin: 0 }}>
            連携は <strong style={{ color: '#1F1A2E' }}>30 秒</strong>。スクショ 1 枚でも始められます。
          </p>
        </motion.div>

        {/* できること 3 つ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.75rem' }}>
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', borderRadius: 16,
                border: '1px solid rgba(225,48,108,0.14)',
                padding: '0.85rem 1rem',
                boxShadow: '0 6px 18px rgba(225,48,108,0.06)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(225,48,108,0.12), rgba(247,119,55,0.10))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <b.Icon size={20} color="#E1306C" strokeWidth={2.3} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.4 }}>{b.title}</div>
                <div style={{ fontSize: 11.5, color: '#7A7585', lineHeight: 1.5, marginTop: 2 }}>{b.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* サンプルを見る（連携前に中身を 30 秒で確認＝行き止まりゼロ） */}
        <motion.button
          type="button"
          onClick={() => setShowSample((v) => !v)}
          aria-expanded={showSample}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', minHeight: 48,
            background: showSample ? 'rgba(225,48,108,0.06)' : '#fff',
            border: `1px solid rgba(225,48,108,0.28)`, borderRadius: 14,
            color: accent, fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: showSample ? 4 : '1.75rem',
          }}
        >
          <Eye size={17} /> {showSample ? 'サンプルを閉じる' : '連携せずに中身を見る（30秒）'}
          <motion.span animate={{ rotate: showSample ? 180 : 0 }} transition={{ duration: 0.25 }}
            style={{ display: 'inline-flex' }}>
            <ChevronDown size={16} />
          </motion.span>
        </motion.button>

        <AnimatePresence initial={false}>
          {showSample && <SamplePreview key="sample" accent={accent} />}
        </AnimatePresence>

        {showSample && (
          <div style={{ marginBottom: '1.5rem' }} />
        )}

        {/* CTA */}
        <motion.button
          type="button"
          onClick={onConnect}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', minHeight: 56,
            background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
            color: '#fff', border: 'none', borderRadius: 99,
            padding: '1rem 1.4rem', fontSize: 16, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(225,48,108,0.42)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <InstagramGlyph size={19} color="#fff" /> Instagram を連携する <ArrowRight size={18} />
        </motion.button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%', minHeight: 44,
            background: 'transparent', border: 'none',
            color: '#8A8593', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', marginTop: 14,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          あとで連携する（先に中を見てみる）
        </button>
      </div>
    </div>
  );
}
