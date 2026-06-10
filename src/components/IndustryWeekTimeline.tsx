// ============================================================
// IndustryWeekTimeline — 業界別 LP に「導入後の典型 1 週間」を可視化
//
// オーナー指示 (2026-06-04 第 20 波 WWW):
//   Hero と 比較表 の間に「初日 / 3 日目 / 7 日目」の体験タイムラインを
//   3 ステップで可視化。「いま入って 1 週間後 こうなれる」のイメージを
//   ユーザーに先に持ってもらう。
// ============================================================

import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, TrendingUp, Sunrise, Zap, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WeekStep {
  day: string;     // '初日 (Day 1)' 等
  Icon: LucideIcon;
  title: string;
  body: string;
  ai: string;      // 「あなたが AI に頼むこと」
  outcome: string; // 「その日の終わりに 起こること」
}

const DEFAULT_STEPS: WeekStep[] = [
  {
    day: '初日 (Day 1)',
    Icon: Sunrise,
    title: '5 分でセットアップ',
    body: '名前・業種・モデル を選ぶだけ。クレカ登録不要、7 日間ぜんぶ無料。',
    ai: '「今週の優先 3 つ を決める」を CEO に頼む',
    outcome: '優先順 / 期限 / 担当 CXO の 1 枚画面が出ます',
  },
  {
    day: '3 日目',
    Icon: Zap,
    title: '業務に染み込む',
    body: '朝のブリーフ + 完了タスク 5-10 件。「あ、これ AI に頼めばいいのか」が増える。',
    ai: '「営業先 3 社に DM 下書き」「数字を整理して」を CSO / CFO に',
    outcome: '初週で 5 つ以上の「自分でやらない仕事」が AI 側に移ります',
  },
  {
    day: '7 日目',
    Icon: Rocket,
    title: '無料体験終了 — 続けるか判断',
    body: '1 週間の AI 進めた仕事ログが「今週の日記」で 1 通のメールに。',
    ai: '夜のフィードで「今日 AI が触れた仕事 N 件」を確認',
    outcome: '時給換算で 6-8 時間 浮く感覚。続けるか 1 タップで決められます',
  },
];

interface Props {
  /** 業界別にメッセージを変えたい場合に渡す (将来用) */
  steps?: WeekStep[];
  accent?: string;
  bgDark?: string;
}

export default function IndustryWeekTimeline({
  steps = DEFAULT_STEPS,
  accent = '#A78BFA',
  bgDark = '#080812',
}: Props) {
  return (
    <section style={{ padding: '5rem 1.5rem', background: bgDark }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{
          fontFamily: '"Inter","Hiragino Kaku Gothic ProN",sans-serif',
          fontSize: 11, letterSpacing: '0.3em', color: accent,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          A TYPICAL FIRST WEEK
        </div>
        <h2 style={{
          fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)',
          fontWeight: 800,
          textAlign: 'center',
          marginBottom: '0.6rem',
          color: '#fff',
        }}>
          導入したら、<span style={{
            background: `linear-gradient(120deg, ${accent}, #F472B6)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>1 週間 でこうなります</span>
        </h2>
        <p style={{
          fontSize: '0.88rem',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          marginBottom: '3rem',
          lineHeight: 1.7,
        }}>
          ※ 想定の典型例。実利用での体感は環境により変動します。
        </p>

        {/* タイムライン */}
        <div style={{ position: 'relative' }}>
          {/* ライン (デスクトップ時のみ) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 60, left: '8.5%', right: '8.5%',
              height: 2,
              background: `linear-gradient(90deg, ${accent}55, #F472B655)`,
              borderRadius: 999,
            }}
            className="industry-week-line"
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            position: 'relative',
            zIndex: 1,
          }}>
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                style={{
                  padding: '1.5rem 1.5rem 1.25rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${accent}33`,
                  borderRadius: 16,
                  position: 'relative',
                  textAlign: 'center',
                }}
              >
                {/* タイムライン ドット */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -22, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 44, height: 44, borderRadius: 22,
                    background: `linear-gradient(135deg, ${accent}, #F472B6)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 16px ${accent}77`,
                  }}
                >
                  <s.Icon size={22} color="#fff" strokeWidth={2.2} />
                </div>

                <div style={{
                  fontSize: 11, letterSpacing: '0.18em', color: accent,
                  fontWeight: 800, marginTop: 24, marginBottom: 6,
                  fontFamily: '"Inter",sans-serif',
                }}>
                  {s.day}
                </div>
                <h3 style={{
                  fontSize: '1.05rem', fontWeight: 800,
                  color: '#fff', marginBottom: 10, lineHeight: 1.4,
                }}>
                  {s.title}
                </h3>
                <p style={{
                  fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.7, marginBottom: 16,
                }}>
                  {s.body}
                </p>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: `${accent}10`,
                  border: `1px solid ${accent}33`,
                  marginBottom: 8, textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: 10, color: accent, fontWeight: 800,
                    letterSpacing: '0.1em', marginBottom: 3,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Sparkles size={10} /> あなたが頼むこと
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                    {s.ai}
                  </div>
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: 10, color: '#34D399', fontWeight: 800,
                    letterSpacing: '0.1em', marginBottom: 3,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <CheckCircle2 size={10} /> その日の終わり
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                    {s.outcome}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 32,
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 12,
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.8)',
          lineHeight: 1.7,
          maxWidth: 720, margin: '32px auto 0',
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <TrendingUp size={14} color="#F472B6" />
          7 日後に「もう手放せない」と感じたら 月額に切替。合わなければ 1 タップ で停止。
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .industry-week-line { display: none; }
        }
      `}</style>
    </section>
  );
}
