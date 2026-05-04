// ============================================================
// IRIS — Editorial Landing (Vogue / Devil Wears Prada inspired)
// 視覚最優先 · 文字は最小限 · インパクト
// ============================================================
import { motion } from 'framer-motion';
import { IRIS_BRAND, IRIS_COLORS, IRIS_FONTS } from './irisStyle';

interface Props {
  onEnter: () => void;
}

export default function IrisLanding({ onEnter }: Props) {
  return (
    <div style={{
      background: IRIS_COLORS.inkBlack,
      color: IRIS_COLORS.cream,
      fontFamily: IRIS_FONTS.body,
      letterSpacing: '0.01em',
    }}>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HERO ─ 全画面・ホットピンク × ゴールド ネオン爆発     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        position: 'relative',
        height: '100vh',
        minHeight: 600,
        overflow: 'hidden',
        background: IRIS_COLORS.inkBlack,
        cursor: 'pointer',
      }}
      onClick={onEnter}
      >
        {/* レイヤー1: 巨大なホットピンク・スポット */}
        <motion.div
          animate={{
            x: ['-15%', '8%', '-8%', '12%', '-15%'],
            y: ['15%', '-8%', '8%', '-12%', '15%'],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: 'clamp(500px, 65vw, 1000px)',
            height: 'clamp(500px, 65vw, 1000px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${IRIS_COLORS.hotPink}ff 0%, ${IRIS_COLORS.magenta}cc 30%, transparent 65%)`,
            filter: 'blur(50px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* レイヤー2: ネオンパープル */}
        <motion.div
          animate={{
            x: ['8%', '-12%', '15%', '-8%', '8%'],
            y: ['-8%', '12%', '-15%', '8%', '-8%'],
            scale: [1, 1.15, 0.9, 1.1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '0%',
            width: 'clamp(450px, 55vw, 850px)',
            height: 'clamp(450px, 55vw, 850px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${IRIS_COLORS.purple}ff 0%, ${IRIS_COLORS.purpleDeep}aa 35%, transparent 65%)`,
            filter: 'blur(60px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* レイヤー3: ゴールド (Versace 風) */}
        <motion.div
          animate={{
            x: ['0%', '15%', '-10%', '5%', '0%'],
            y: ['0%', '-15%', '10%', '-5%', '0%'],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '30%',
            right: '20%',
            width: 'clamp(300px, 40vw, 600px)',
            height: 'clamp(300px, 40vw, 600px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${IRIS_COLORS.gold}dd 0%, ${IRIS_COLORS.goldRose}88 40%, transparent 65%)`,
            filter: 'blur(70px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* レイヤー4: 回転するコニックグラデ (ディスコボール感) */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'clamp(300px, 45vw, 700px)',
            height: 'clamp(300px, 45vw, 700px)',
            borderRadius: '50%',
            background: `conic-gradient(from 0deg, ${IRIS_COLORS.hotPink}66, ${IRIS_COLORS.gold}88, ${IRIS_COLORS.purple}77, ${IRIS_COLORS.magenta}66, ${IRIS_COLORS.gold}88, ${IRIS_COLORS.hotPink}66)`,
            filter: 'blur(50px)',
            opacity: 0.7,
            mixBlendMode: 'screen',
          }}
        />

        {/* レイヤー5: スパークル (キラキラ点) */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              borderRadius: '50%',
              background: i % 3 === 0 ? IRIS_COLORS.gold : i % 3 === 1 ? IRIS_COLORS.hotPink : '#fff',
              boxShadow: `0 0 20px ${i % 3 === 0 ? IRIS_COLORS.gold : i % 3 === 1 ? IRIS_COLORS.hotPink : '#fff'}`,
              zIndex: 3,
            }}
          />
        ))}

        {/* 微細なフィルムグレイン */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
        }} />

        {/* 上部マストヘッド */}
        <div style={{
          position: 'absolute', top: '1.5rem', left: 0, right: 0,
          padding: '0 1.5rem',
          display: 'flex', justifyContent: 'space-between',
          fontFamily: IRIS_FONTS.serif,
          fontSize: '0.7rem',
          letterSpacing: '0.5em',
          textTransform: 'uppercase',
          color: IRIS_COLORS.gold,
          fontWeight: 600,
          zIndex: 5,
          textShadow: `0 0 12px ${IRIS_COLORS.gold}`,
        }}>
          <span>{IRIS_BRAND.issue}</span>
          <span>Tokyo · Milan · Paris</span>
        </div>

        {/* 中央: 巨大ロゴ — グラデーション + グロー */}
        <div style={{
          position: 'relative', zIndex: 10,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1rem',
        }}>
          <motion.h1
            initial={{ opacity: 0, scale: 0.85, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, scale: 1, letterSpacing: '-0.05em' }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: IRIS_FONTS.display,
              fontSize: 'clamp(8rem, 30vw, 32rem)',
              fontWeight: 900,
              lineHeight: 0.85,
              margin: 0,
              textAlign: 'center',
              background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink} 0%, ${IRIS_COLORS.gold} 35%, ${IRIS_COLORS.purpleLt} 70%, ${IRIS_COLORS.hotPink} 100%)`,
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: `drop-shadow(0 0 40px ${IRIS_COLORS.hotPink}aa) drop-shadow(0 0 80px ${IRIS_COLORS.gold}55)`,
              animation: 'iris-gradient 8s ease infinite',
            }}>
            IRIS
          </motion.h1>

          {/* タグライン: ゴールドのグロー文字 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 1.2 }}
            style={{
              fontFamily: IRIS_FONTS.serif,
              fontStyle: 'italic',
              fontSize: 'clamp(1rem, 2.2vw, 1.6rem)',
              color: IRIS_COLORS.gold,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              marginTop: 'clamp(0.5rem, 2vw, 1.5rem)',
              fontWeight: 400,
              textShadow: `0 0 25px ${IRIS_COLORS.gold}cc, 0 0 50px ${IRIS_COLORS.hotPink}55`,
            }}
          >
            {IRIS_BRAND.tagline}
          </motion.div>

          {/* 下部の派手な ENTER ボタン */}
          <motion.button
            onClick={(e) => { e.stopPropagation(); onEnter(); }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            style={{
              marginTop: 'clamp(2rem, 5vw, 4rem)',
              background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purple})`,
              color: '#fff',
              border: `2px solid ${IRIS_COLORS.gold}`,
              padding: '1.2rem 4rem',
              fontSize: '0.85rem',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
              fontWeight: 700,
              borderRadius: 999,
              boxShadow: `0 0 30px ${IRIS_COLORS.hotPink}88, 0 0 60px ${IRIS_COLORS.gold}55, inset 0 0 20px rgba(255,255,255,0.2)`,
              zIndex: 10,
            }}>
            ✨ Step Inside
          </motion.button>
        </div>

        {/* 下部: スクロールヒント */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.4, 1] }}
          transition={{ delay: 2.8, duration: 2.5, repeat: Infinity, repeatType: 'reverse' }}
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: 0, right: 0,
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <div style={{
            fontFamily: IRIS_FONTS.serif,
            fontSize: '0.7rem',
            letterSpacing: '0.6em',
            textTransform: 'uppercase',
            color: IRIS_COLORS.gold,
            opacity: 0.85,
          }}>
            ↓ Scroll
          </div>
        </motion.div>

        {/* グラデーションアニメ用 keyframe */}
        <style>{`
          @keyframes iris-gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECOND VIEW: マストヘッド + サブコピー (スクロール後)  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header style={{
        background: `linear-gradient(135deg, ${IRIS_COLORS.pinkMist} 0%, ${IRIS_COLORS.ivory} 50%, ${IRIS_COLORS.pinkMist} 100%)`,
        color: IRIS_COLORS.ink,
        borderTop: `3px solid ${IRIS_COLORS.hotPink}`,
        borderBottom: `1px solid ${IRIS_COLORS.purple}33`,
        padding: '1rem 1.5rem',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'baseline' }}>
            <div style={{
              fontFamily: IRIS_FONTS.display,
              fontSize: '1.6rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purple})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              IRIS
            </div>
            <div style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem',
              letterSpacing: '0.25em', textTransform: 'uppercase',
              color: IRIS_COLORS.hotPink, fontWeight: 600,
            }}>
              {IRIS_BRAND.tagline}
            </div>
          </div>
          <button onClick={onEnter} style={{
            background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purple})`,
            color: '#fff',
            border: 'none',
            padding: '0.7rem 1.8rem',
            fontSize: '0.72rem',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            fontWeight: 700,
            borderRadius: 999,
            boxShadow: `0 4px 16px ${IRIS_COLORS.hotPink}66`,
          }}>
            Enter
          </button>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* COVER LINES (4 つの No.セクション)                    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        background: `linear-gradient(180deg, ${IRIS_COLORS.ivory} 0%, ${IRIS_COLORS.pinkMist} 100%)`,
        color: IRIS_COLORS.ink,
        padding: 'clamp(4rem, 8vw, 6rem) 1.5rem',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 5vw, 4rem)' }}>
            <p style={{
              fontFamily: IRIS_FONTS.serif,
              fontStyle: 'italic',
              fontSize: '0.78rem',
              letterSpacing: '0.5em',
              textTransform: 'uppercase',
              color: IRIS_COLORS.hotPink,
              marginBottom: '1rem',
              fontWeight: 700,
            }}>
              ✦ In This Issue ✦
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0',
          }}>
            {[
              { num: '01', en: 'The Strategist',  ja: '次の一本を、AI が指図する。', color: IRIS_COLORS.hotPink },
              { num: '02', en: 'The Negotiation', ja: '広告代理店との交渉、AI が筆を取る。', color: IRIS_COLORS.purple },
              { num: '03', en: 'Self-Edit',       ja: '画像加工も、背景処理も、指先で。', color: IRIS_COLORS.gold },
              { num: '04', en: 'The House',       ja: 'ブランド、チーム、仲間が集う。', color: IRIS_COLORS.magenta },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                style={{
                  padding: '2.5rem 1.5rem',
                  borderRight: i < 3 ? `1px solid ${IRIS_COLORS.hotPink}33` : 'none',
                  cursor: 'default',
                }}
              >
                <div style={{
                  fontFamily: IRIS_FONTS.display,
                  fontStyle: 'italic',
                  fontSize: '4rem',
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${item.color}, ${IRIS_COLORS.gold})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                  marginBottom: '0.75rem',
                  letterSpacing: '-0.02em',
                }}>
                  {item.num}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.display,
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: IRIS_COLORS.inkBlack,
                  lineHeight: 1.2,
                  marginBottom: '0.4rem',
                  letterSpacing: '-0.01em',
                }}>
                  {item.en}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.body,
                  fontSize: '0.88rem',
                  color: IRIS_COLORS.inkSoft,
                  lineHeight: 1.7,
                }}>
                  {item.ja}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EDITOR'S LETTER (引用) ──────────── */}
      <section style={{
        padding: 'clamp(4rem, 10vw, 8rem) 1.5rem',
        background: IRIS_COLORS.inkBlack,
        color: IRIS_COLORS.cream,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            fontFamily: IRIS_FONTS.serif,
            fontSize: '0.7rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: IRIS_COLORS.nudeDeep,
            marginBottom: '2rem',
          }}>
            Editor's Letter
          </div>
          <p style={{
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
            lineHeight: 1.5,
            color: IRIS_COLORS.cream,
            marginBottom: '2rem',
            fontWeight: 400,
          }}>
            “時間と労力を、もう自分以外のものに使うのはやめにしよう。<br />
            交渉も、写真も、コミュニティも、<br />
            <span style={{ color: IRIS_COLORS.roseGoldLt, fontStyle: 'italic' }}>あなたが、決めて、編集して、出す。</span>”
          </p>
          <p style={{
            fontFamily: IRIS_FONTS.serif,
            fontSize: '0.75rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: IRIS_COLORS.nudeDeep,
          }}>
            — IRIS, Vol.01
          </p>
        </div>
      </section>

      {/* ── CONTENTS — 雑誌の目次風 ──────────── */}
      <section id="features" style={{
        padding: 'clamp(4rem, 8vw, 7rem) 1.5rem',
        background: IRIS_COLORS.ivory,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 4fr',
            gap: '3rem',
            alignItems: 'baseline',
            paddingBottom: '2rem',
            borderBottom: `2px solid ${IRIS_COLORS.inkBlack}`,
          }}>
            <div>
              <p style={{
                fontFamily: IRIS_FONTS.serif,
                fontStyle: 'italic',
                fontSize: '0.75rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: IRIS_COLORS.bordeaux,
                marginBottom: '0.5rem',
              }}>
                The Index
              </p>
            </div>
            <h2 style={{
              fontFamily: IRIS_FONTS.display,
              fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
              fontWeight: 800,
              color: IRIS_COLORS.inkBlack,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              Contents.
            </h2>
          </div>

          <div style={{
            marginTop: '3rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0',
          }}>
            {[
              { num: '01', t: 'The Negotiation',     ja: '交渉文 AI', d: '広告代理店・ブランドへの返信、報酬カウンター、断り方。すべて、私の名前で書ける。' },
              { num: '02', t: 'Brand Match',         ja: 'ブランドを探す', d: '営業データを横断検索。向こうから「お声がかかる」前に、こちらから声をかける。' },
              { num: '03', t: 'The Retouch',         ja: '画像加工', d: '撮った写真を、そのまま投稿に。背景処理、クロップ、肌の整え。' },
              { num: '04', t: 'Caption Studio',      ja: '投稿下書き', d: '商品の良さを、自分の声で言い換える。プラットフォーム別に最適化。' },
              { num: '05', t: 'Beauty Council',      ja: '美容相談', d: '肌、髪、PMS。一番話したいことを、一番安心できる相手に。' },
              { num: '06', t: 'The Roster',          ja: 'チーム / コラボ', d: 'ひとりで全部はもう古い。マネージャー、編集、推し合い。' },
              { num: '07', t: 'Media Kit',           ja: 'メディアキット', d: '数字とブランド観を、整えて持ち歩く。' },
              { num: '08', t: 'Background Studio',   ja: '背景デザイン', d: '8 種の補色プリセット + 自分だけのカスタム。気分は、編集できる。' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                style={{
                  padding: '2rem 1.25rem 2.25rem',
                  borderBottom: `1px solid ${IRIS_COLORS.ink}25`,
                  borderRight: `1px solid ${IRIS_COLORS.ink}25`,
                  background: 'transparent',
                  cursor: 'default',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = IRIS_COLORS.cream; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  fontFamily: IRIS_FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: '0.78rem',
                  color: IRIS_COLORS.bordeaux,
                  letterSpacing: '0.2em',
                  marginBottom: '0.75rem',
                }}>
                  No. {item.num}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.display,
                  fontSize: '1.6rem',
                  fontWeight: 600,
                  color: IRIS_COLORS.inkBlack,
                  marginBottom: '0.25rem',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}>
                  {item.t}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  color: IRIS_COLORS.inkSoft,
                  marginBottom: '1rem',
                  letterSpacing: '0.05em',
                }}>
                  {item.ja}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.body,
                  fontSize: '0.85rem',
                  color: IRIS_COLORS.ink,
                  lineHeight: 1.7,
                  fontWeight: 400,
                }}>
                  {item.d}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PULL QUOTE (Devil Wears Prada 級の決め台詞) ──────── */}
      <section style={{
        padding: 'clamp(5rem, 10vw, 9rem) 1.5rem',
        background: IRIS_COLORS.cream,
        textAlign: 'center',
        borderTop: `1px solid ${IRIS_COLORS.ink}20`,
        borderBottom: `1px solid ${IRIS_COLORS.ink}20`,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{
            fontFamily: IRIS_FONTS.display,
            fontSize: 'clamp(2.2rem, 6vw, 5rem)',
            fontWeight: 700,
            color: IRIS_COLORS.inkBlack,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            <span style={{ fontStyle: 'italic', color: IRIS_COLORS.bordeaux }}>
              That's all.
            </span>
          </p>
          <p style={{
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 1.5vw, 1.2rem)',
            color: IRIS_COLORS.inkSoft,
            marginTop: '1.5rem',
            letterSpacing: '0.08em',
            lineHeight: 1.7,
          }}>
            言いきれる女に、なる。
          </p>
        </div>
      </section>

      {/* ── 招待 / CTA ──────────────────────── */}
      <section style={{
        padding: 'clamp(4rem, 8vw, 7rem) 1.5rem',
        background: IRIS_COLORS.ivory,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontSize: '0.78rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: IRIS_COLORS.bordeaux,
            marginBottom: '1.5rem',
          }}>
            Subscribe to the Edition
          </p>
          <h2 style={{
            fontFamily: IRIS_FONTS.display,
            fontSize: 'clamp(2.4rem, 5vw, 4rem)',
            fontWeight: 800,
            color: IRIS_COLORS.inkBlack,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '1.5rem',
          }}>
            <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Welcome</span> to the Edition.
          </h2>
          <p style={{
            fontFamily: IRIS_FONTS.body,
            fontSize: '1rem',
            color: IRIS_COLORS.inkSoft,
            marginBottom: '3rem',
            lineHeight: 1.8,
          }}>
            登録不要、初月無料。<br />
            あなたの仕事と、感性と、コミュニティが、ここから始まります。
          </p>
          <button onClick={onEnter} style={{
            background: IRIS_COLORS.inkBlack,
            color: IRIS_COLORS.cream,
            border: 'none',
            padding: '1.3rem 4rem',
            fontSize: '0.78rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = IRIS_COLORS.bordeaux; }}
          onMouseLeave={e => { e.currentTarget.style.background = IRIS_COLORS.inkBlack; }}
          >
            Enter
          </button>
        </div>
      </section>

      {/* ── COLOPHON (奥付) ────────────────── */}
      <footer style={{
        padding: '3rem 1.5rem 2.5rem',
        background: IRIS_COLORS.inkBlack,
        color: IRIS_COLORS.cream,
        borderTop: `1px solid ${IRIS_COLORS.bordeaux}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            paddingBottom: '2rem',
            borderBottom: `1px solid ${IRIS_COLORS.cream}30`,
          }}>
            <div>
              <p style={{
                fontFamily: IRIS_FONTS.display,
                fontSize: '2rem',
                fontWeight: 800,
                lineHeight: 1,
                marginBottom: '0.5rem',
              }}>
                IRIS
              </p>
              <p style={{
                fontFamily: IRIS_FONTS.serif,
                fontStyle: 'italic',
                fontSize: '0.78rem',
                color: IRIS_COLORS.nudeDeep,
                letterSpacing: '0.1em',
              }}>
                A magazine you live in.
              </p>
            </div>
            <div>
              <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: IRIS_COLORS.nudeDeep, marginBottom: '0.75rem' }}>
                Editorial
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>The Negotiation</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>The Retouch</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>Beauty Council</p>
            </div>
            <div>
              <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: IRIS_COLORS.nudeDeep, marginBottom: '0.75rem' }}>
                The House
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>Roster</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>Brand Match</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>
                <a href="/" style={{ color: 'inherit' }}>CORE Prism (B2B)</a>
              </p>
            </div>
            <div>
              <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: IRIS_COLORS.nudeDeep, marginBottom: '0.75rem' }}>
                Contact
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem', opacity: 0.85 }}>
                <a href="mailto:gauche.cellist1201@gmail.com" style={{ color: 'inherit' }}>
                  gauche.cellist1201@gmail.com
                </a>
              </p>
            </div>
          </div>
          <p style={{
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontSize: '0.75rem',
            letterSpacing: '0.2em',
            color: IRIS_COLORS.nudeDeep,
            marginTop: '1.5rem',
            textAlign: 'center',
          }}>
            © {new Date().getFullYear()} CORE — Published in Tokyo. Edited by you.
          </p>
        </div>
      </footer>
    </div>
  );
}
