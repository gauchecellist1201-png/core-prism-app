// ============================================================
// CORE Iris — 初回 3 ステップ「5 分の Wow」ツアー
//
// 目的（ロードマップ T4-2 / 初回 3 分の Wow）:
//   未連携・初見のユーザーでも、Instagram を繋ぐ前に
//   「解析 → 伸ばす作戦 → リール台本」が“自分ごと”として
//   一気に体感できる。完全フロント完結（API 不要）・初回 1 回だけ。
//
//   表示するのは架空クリエイター @hina_lifestyle の実物品質サンプル。
//   数字はサンプルである旨を必ず明示（嘘ゼロ）。最後に
//   「あなたのアカウントでも自動で」→ リールタブへ誘導。
//
// 鉄則:
//   - 偽ボタンなし。「次へ／台本スタジオを開く」は必ず動く。
//   - モバイル最優先（safe-area / 44px タップ / 100dvh / 縦スクロール可）。
//   - OS 絵文字を chrome に使わない（自作 SVG / Lucide ライン）。
//   - localStorage で 1 回だけ。閉じても二度と出さない。
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles, TrendingUp, Film, Check } from 'lucide-react';
import { IRIS_COLORS, IRIS_FONTS } from './irisStyle';
import InstagramGlyph from './InstagramGlyph';
import { tactileTap, tactileReward, tactileClose } from '../lib/haptic';

const SEEN_KEY = 'core_iris_firstrun_tour_v1';

/** このツアーをまだ見ていなければ true */
export function shouldShowFirstRunTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== 'done';
  } catch {
    return false;
  }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, 'done'); } catch { /* quota */ }
}

interface Props {
  /** 「リール台本スタジオを開く」で呼ばれる。dashboard 側で setTab('reel') する */
  onGotoReel: () => void;
  /** 閉じる（後で自分のアカウントで試す） */
  onClose: () => void;
}

// ── サンプル（架空 @hina_lifestyle・実物品質。すべて「サンプル」と明示）──
const SAMPLE_SCORES = [
  { label: 'プロフィールの強さ', value: 78, reason: 'ひと目で「誰の・何の発信か」が伝わる。固定リンクの導線も明確。' },
  { label: '世界観の統一感', value: 84, reason: 'クリーム×ベージュの色調が一貫。サムネだけで“ひな”と分かる。' },
  { label: '内容の独自性', value: 71, reason: '“28歳の等身大ライフ”が共感軸。あと一歩で唯一無二に。' },
  { label: '反応の効率', value: 69, reason: '保存される投稿は強いが、フォロワー比の反応率に伸びしろ。' },
  { label: '案件の受けやすさ', value: 82, reason: 'カフェ・コスメ・旅の親和性が高く、企業が声をかけやすい。' },
];
const SAMPLE_TOTAL = 77;

const SAMPLE_MOVES = [
  { tag: '今すぐ', text: '固定の3枚を「自己紹介→人気投稿→今の案件」の順に並べ替える' },
  { tag: '今週', text: 'リール週2本を固定化。1本は「朝のルーティン」“保存される系”で攻める' },
  { tag: '伸びしろ', text: 'キャプション冒頭の1行を“結論ファースト”に。読了率→保存率が上がる' },
];

const SAMPLE_REEL = {
  theme: '朝の3分ルーティンで1日が整う',
  title: '知らないと損する、朝の3分ルーティン',
  scenes: [
    { index: 1, caption: 'まだ二度寝してるの？', duration: 5, narration: 'おはよう。今日もバタバタで始まってない？' },
    { index: 2, caption: 'コップ1杯の白湯から', duration: 6, narration: 'まず白湯。次にカーテン全開。最後に深呼吸3回。これだけ。' },
    { index: 3, caption: '3分で“整う”がクセになる', duration: 5, narration: 'たった3分で1日の質が変わる。保存して明日からやってみて。' },
  ],
  cta: '保存して、明日の朝から一緒に。',
};

export default function IrisFirstRunTour({ onGotoReel, onClose }: Props) {
  const [step, setStep] = useState(0); // 0:分析 1:作戦 2:台本
  const steps = 3;

  // 背景スクロールロック
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const close = () => { tactileClose(); markSeen(); onClose(); };
  const next = () => {
    if (step < steps - 1) { tactileTap(); setStep(s => s + 1); }
  };
  const finish = () => { tactileReward(); markSeen(); onGotoReel(); };

  const accent = IRIS_COLORS.hotPink;

  return (
    <AnimatePresence>
      <motion.div
        key="iris-firstrun-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 2147483000,
          background: 'rgba(16,6,26,0.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          fontFamily: IRIS_FONTS.body,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{
            width: '100%', maxWidth: 480,
            maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 12px)',
            background: IRIS_COLORS.cream,
            color: IRIS_COLORS.ink,
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -12px 48px rgba(26,10,38,0.4)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* ── ヘッダ ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 8px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9,
                background: `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purple})`,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <InstagramGlyph size={18} color="#fff" strokeWidth={2.2} />
              </span>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em' }}>30秒の体験ツアー</div>
                <div style={{ fontSize: '0.62rem', color: IRIS_COLORS.inkDim }}>サンプル: @hina_lifestyle（架空）</div>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="閉じる"
              style={{
                width: 36, height: 36, minWidth: 36, borderRadius: 12,
                border: 'none', background: 'rgba(26,10,38,0.06)',
                color: IRIS_COLORS.inkSoft, cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── 進捗ドット ── */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', flexShrink: 0 }}>
            {Array.from({ length: steps }).map((_, i) => (
              <span key={i} style={{
                flex: 1, height: 4, borderRadius: 99,
                background: i <= step ? accent : 'rgba(26,10,38,0.12)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* ── 本文（スクロール可） ── */}
          <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 8px', flex: 1 }}>
            <AnimatePresence mode="wait">
              {step === 0 && <StepAnalysis key="s0" accent={accent} />}
              {step === 1 && <StepMoves key="s1" accent={accent} />}
              {step === 2 && <StepReel key="s2" accent={accent} />}
            </AnimatePresence>
          </div>

          {/* ── フッタ CTA ── */}
          <div style={{ padding: '10px 16px 16px', flexShrink: 0, borderTop: `1px solid ${IRIS_COLORS.ivoryDeep}` }}>
            {step < steps - 1 ? (
              <button
                onClick={next}
                style={primaryBtn(accent)}
              >
                次へ <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={finish}
                style={primaryBtn(accent)}
              >
                <Film size={18} /> この台本を、自分のテーマで作る
              </button>
            )}
            <button
              onClick={close}
              style={{
                width: '100%', marginTop: 8, padding: '10px',
                background: 'transparent', border: 'none',
                color: IRIS_COLORS.inkDim, fontSize: '0.78rem', cursor: 'pointer',
                minHeight: 44,
              }}
            >
              {step < steps - 1 ? 'あとで自分のアカウントで試す' : 'まずはダッシュボードを見る'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── ステップ1: 解析 ──────────────────────────────
function StepAnalysis({ accent }: { accent: string }) {
  return (
    <StepShell
      icon={<Sparkles size={16} />}
      kicker="STEP 1 ・ 解析"
      title="繋ぐだけで、現在地が数字で見える"
      lead="あなたのプロフィールを AI が読み、5 つの観点で採点します。下はサンプルの結果です。"
      accent={accent}
    >
      {/* 総合スコア */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: IRIS_COLORS.paper, border: `1px solid ${IRIS_COLORS.ivoryDeep}`,
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${accent} ${SAMPLE_TOTAL * 3.6}deg, ${IRIS_COLORS.ivoryDeep} 0deg)`,
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', background: IRIS_COLORS.paper,
            display: 'grid', placeItems: 'center', flexDirection: 'column',
          }}>
            <span style={{ fontFamily: IRIS_FONTS.mono, fontSize: '1.3rem', fontWeight: 700, color: IRIS_COLORS.ink, lineHeight: 1 }}>{SAMPLE_TOTAL}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: IRIS_COLORS.inkDim, fontWeight: 600 }}>総合スコア（サンプル）</div>
          <div style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>
            “伸びる準備は整っている。あとは型化だけ”
          </div>
        </div>
      </div>

      {/* 5 軸 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SAMPLE_SCORES.map((s) => (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontFamily: IRIS_FONTS.mono, fontSize: '0.9rem', fontWeight: 700, color: accent }}>{s.value}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: IRIS_COLORS.ivoryDeep, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.value}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${IRIS_COLORS.gold}, ${accent})` }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: IRIS_COLORS.inkSoft, marginTop: 4, lineHeight: 1.45 }}>{s.reason}</div>
          </div>
        ))}
      </div>
    </StepShell>
  );
}

// ── ステップ2: 伸ばす作戦 ────────────────────────
function StepMoves({ accent }: { accent: string }) {
  return (
    <StepShell
      icon={<TrendingUp size={16} />}
      kicker="STEP 2 ・ 伸ばす作戦"
      title="採点で終わらない。次の一手まで出す"
      lead="解析の結果から、今すぐ・今週・伸びしろの 3 手に落とし込みます。"
      accent={accent}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SAMPLE_MOVES.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: IRIS_COLORS.paper, border: `1px solid ${IRIS_COLORS.ivoryDeep}`,
              borderRadius: 14, padding: '12px 14px',
            }}
          >
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.03em',
              color: '#fff', background: i === 0 ? accent : IRIS_COLORS.purple,
              padding: '4px 8px', borderRadius: 7, flexShrink: 0, marginTop: 1,
            }}>{m.tag}</span>
            <span style={{ fontSize: '0.86rem', lineHeight: 1.5, fontWeight: 500 }}>{m.text}</span>
          </motion.div>
        ))}
      </div>
      <div style={{
        marginTop: 12, fontSize: '0.74rem', color: IRIS_COLORS.inkSoft,
        background: IRIS_COLORS.pinkMist, borderRadius: 12, padding: '10px 12px', lineHeight: 1.5,
      }}>
        繋いだあとは、あなたの実データから毎朝この「今日の一手」が届きます。
      </div>
    </StepShell>
  );
}

// ── ステップ3: リール台本 ────────────────────────
function StepReel({ accent }: { accent: string }) {
  const total = SAMPLE_REEL.scenes.reduce((a, s) => a + s.duration, 0);
  return (
    <StepShell
      icon={<Film size={16} />}
      kicker="STEP 3 ・ リール台本"
      title="作戦が、そのまま撮れる台本になる"
      lead={`テーマ「${SAMPLE_REEL.theme}」から、約${total}秒の 3 シーン台本を自動生成。下はサンプルです。`}
      accent={accent}
    >
      <div style={{
        background: IRIS_COLORS.paper, border: `1px solid ${IRIS_COLORS.ivoryDeep}`,
        borderRadius: 16, padding: '14px 16px',
      }}>
        <div style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3, marginBottom: 12 }}>
          {SAMPLE_REEL.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE_REEL.scenes.map((sc) => (
            <div key={sc.index} style={{ display: 'flex', gap: 10 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: IRIS_COLORS.pinkMist, color: accent,
                display: 'grid', placeItems: 'center',
                fontFamily: IRIS_FONTS.mono, fontWeight: 700, fontSize: '0.85rem',
              }}>{sc.index}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.35 }}>
                  「{sc.caption}」
                  <span style={{ fontSize: '0.66rem', fontWeight: 600, color: IRIS_COLORS.inkDim, marginLeft: 6 }}>{sc.duration}秒</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: IRIS_COLORS.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{sc.narration}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${IRIS_COLORS.ivoryDeep}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={16} color={accent} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{SAMPLE_REEL.cta}</span>
        </div>
      </div>
    </StepShell>
  );
}

// ── 共通レイアウト ──────────────────────────────
function StepShell({
  icon, kicker, title, lead, accent, children,
}: {
  icon: React.ReactNode; kicker: string; title: string; lead: string;
  accent: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accent, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em' }}>{kicker}</span>
      </div>
      <h2 style={{
        fontFamily: IRIS_FONTS.serif, fontSize: '1.32rem', fontWeight: 700,
        lineHeight: 1.25, margin: '0 0 6px',
      }}>{title}</h2>
      <p style={{ fontSize: '0.82rem', color: IRIS_COLORS.inkSoft, lineHeight: 1.55, margin: '0 0 14px' }}>{lead}</p>
      {children}
    </motion.div>
  );
}

function primaryBtn(accent: string): React.CSSProperties {
  return {
    width: '100%', minHeight: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${accent}, ${IRIS_COLORS.purple})`,
    color: '#fff', border: 'none', borderRadius: 14,
    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(225,48,108,0.34)',
  };
}
