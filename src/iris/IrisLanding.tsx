// ============================================================
// CORE Iris — 公開ランディング (視覚優先・文字最小)
// ============================================================
import { motion } from 'framer-motion';
import { IRIS_BRAND, IRIS_COLORS, IRIS_FONTS } from './irisStyle';

interface Props {
  onEnter: () => void;
}

export default function IrisLanding({ onEnter }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: IRIS_FONTS.body,
      color: IRIS_COLORS.ink,
      background: `radial-gradient(circle at 20% 20%, ${IRIS_COLORS.roseSoft} 0%, transparent 40%), radial-gradient(circle at 80% 80%, ${IRIS_COLORS.lavenderSoft} 0%, transparent 40%), linear-gradient(180deg, ${IRIS_COLORS.cream} 0%, ${IRIS_COLORS.roseMist} 100%)`,
    }}>
      {/* ヘッダ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '1rem 1.5rem',
        background: 'rgba(255,249,240,0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${IRIS_COLORS.roseSoft}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: IRIS_COLORS.roseDeep, fontWeight: 500 }}>
              CORE
            </div>
            <div style={{ fontSize: '1.4rem', fontFamily: IRIS_FONTS.display, fontStyle: 'italic', color: IRIS_COLORS.navy, lineHeight: 1, marginTop: '-2px' }}>
              Iris
            </div>
          </div>
          <button onClick={onEnter} style={{
            background: `linear-gradient(135deg, ${IRIS_COLORS.rose}, ${IRIS_COLORS.roseDeep})`,
            color: '#fff', border: 'none',
            padding: '0.65rem 1.3rem', borderRadius: 999,
            fontSize: '0.85rem', fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 6px 20px rgba(232,75,151,0.3)`,
          }}>
            はじめる →
          </button>
        </div>
      </header>

      {/* HERO — 大きなビジュアル */}
      <section style={{ padding: '5rem 1.5rem 6rem', position: 'relative', overflow: 'hidden' }}>
        {/* 装飾サークル */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2 }}
          style={{
            position: 'absolute', top: '20%', right: '5%',
            width: 'clamp(200px, 30vw, 400px)', height: 'clamp(200px, 30vw, 400px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${IRIS_COLORS.rose}55, transparent 70%)`,
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2 }}
          style={{
            position: 'absolute', bottom: '10%', left: '8%',
            width: 'clamp(150px, 25vw, 300px)', height: 'clamp(150px, 25vw, 300px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${IRIS_COLORS.lavender}55, transparent 70%)`,
            filter: 'blur(40px)',
          }}
        />

        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
          >
            {/* タグライン */}
            <p style={{
              fontFamily: IRIS_FONTS.accent,
              fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
              letterSpacing: '0.4em',
              color: IRIS_COLORS.roseDeep,
              marginBottom: '2rem',
              textTransform: 'uppercase',
            }}>
              {IRIS_BRAND.taglineEn}
            </p>

            {/* メインタイトル — 筆記体風 */}
            <h1 style={{
              fontFamily: IRIS_FONTS.display,
              fontSize: 'clamp(3rem, 9vw, 7rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              lineHeight: 1.05,
              color: IRIS_COLORS.navy,
              marginBottom: '1.5rem',
              letterSpacing: '-0.02em',
            }}>
              自分の色で、<br />
              <span style={{
                background: `linear-gradient(135deg, ${IRIS_COLORS.roseDeep} 0%, ${IRIS_COLORS.lavender} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                咲く。
              </span>
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 1.4vw, 1.15rem)',
              color: IRIS_COLORS.inkSoft,
              lineHeight: 1.9,
              marginBottom: '3rem',
              maxWidth: 580,
              margin: '0 auto 3rem',
            }}>
              インフルエンサーのための、もうひとつの脳。<br />
              案件の交渉も、投稿づくりも、美容の相談も。
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onEnter} style={{
                background: `linear-gradient(135deg, ${IRIS_COLORS.rose}, ${IRIS_COLORS.roseDeep})`,
                color: '#fff', border: 'none',
                padding: '1.1rem 2.5rem', borderRadius: 999,
                fontSize: '1rem', fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 12px 32px rgba(232,75,151,0.4)`,
                fontFamily: IRIS_FONTS.body,
              }}>
                ✨ はじめる
              </button>
              <a href="#features" style={{
                background: 'rgba(255,255,255,0.7)',
                color: IRIS_COLORS.navy,
                padding: '1.1rem 2.5rem', borderRadius: 999,
                fontSize: '1rem', fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${IRIS_COLORS.roseSoft}`,
              }}>
                できること
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 機能 — 大きな絵文字カード式 */}
      <section id="features" style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{
            fontFamily: IRIS_FONTS.accent,
            fontSize: '0.85rem',
            letterSpacing: '0.3em',
            color: IRIS_COLORS.roseDeep,
            textAlign: 'center',
            marginBottom: '1rem',
          }}>
            FEATURES
          </p>
          <h2 style={{
            fontFamily: IRIS_FONTS.display,
            fontStyle: 'italic',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            textAlign: 'center',
            marginBottom: '4rem',
            color: IRIS_COLORS.navy,
          }}>
            これ、ぜんぶできる。
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              { e: '💌', t: '案件管理', d: '打診から納品まで、ぜんぶ。' },
              { e: '💬', t: '交渉文 AI', d: '断りも、報酬交渉も、丁寧に。' },
              { e: '✍', t: '投稿下書き', d: 'プラットフォーム別に最適化。' },
              { e: '📊', t: '納品レポート', d: 'ブランドが感動する報告書。' },
              { e: '💆‍♀️', t: '美容相談', d: '肌・メイク・PMS、なんでも。' },
              { e: '🎨', t: '画像生成', d: 'ストーリー・投稿・サムネを AI で。' },
              { e: '🎬', t: '動画下書き', d: 'リール・ショートの構成案。' },
              { e: '🌸', t: '背景カスタム', d: '8 種類のテーマで気分転換。' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${IRIS_COLORS.roseSoft}`,
                  borderRadius: 24,
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{f.e}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: IRIS_COLORS.navy }}>{f.t}</div>
                <div style={{ fontSize: '0.85rem', color: IRIS_COLORS.inkSoft }}>{f.d}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ビジュアル CTA */}
      <section style={{
        padding: '5rem 1.5rem',
        background: `linear-gradient(135deg, ${IRIS_COLORS.rose} 0%, ${IRIS_COLORS.lavender} 100%)`,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', color: '#fff' }}>
          <h2 style={{
            fontFamily: IRIS_FONTS.display,
            fontStyle: 'italic',
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            lineHeight: 1.2,
            marginBottom: '1rem',
          }}>
            あなたが咲く時間を、<br />ぜんぶに。
          </h2>
          <p style={{ fontSize: '1.05rem', opacity: 0.9, marginBottom: '2.5rem' }}>
            登録不要・ブラウザだけ・5 分で始められます。
          </p>
          <button onClick={onEnter} style={{
            background: '#fff',
            color: IRIS_COLORS.roseDeep,
            border: 'none',
            padding: '1.2rem 3rem', borderRadius: 999,
            fontSize: '1.05rem', fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
            fontFamily: IRIS_FONTS.body,
          }}>
            🌸 Iris をはじめる
          </button>
        </div>
      </section>

      {/* フッタ */}
      <footer style={{
        padding: '2rem 1.5rem',
        background: IRIS_COLORS.navy,
        color: '#fff',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>
          {IRIS_BRAND.name} — A sister product of {IRIS_BRAND.parent}
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
          © {new Date().getFullYear()} CORE 株式会社 ・ <a href="/" style={{ color: '#fff', opacity: 0.7 }}>本家 CORE Prism (B2B) はこちら</a>
        </p>
      </footer>
    </div>
  );
}
