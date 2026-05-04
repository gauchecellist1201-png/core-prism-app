// ============================================================
// IRIS — Editorial Landing (Vogue / Devil Wears Prada inspired)
// 余白 · タイポグラフィ · ボルドー · インク · アイボリー
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
      background: IRIS_COLORS.ivory,
      color: IRIS_COLORS.ink,
      fontFamily: IRIS_FONTS.body,
      letterSpacing: '0.01em',
    }}>
      {/* ── マストヘッド (雑誌の表紙の上) ─────────── */}
      <header style={{
        borderBottom: `1px solid ${IRIS_COLORS.ink}`,
        padding: '0.75rem 1.5rem',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'baseline' }}>
            <div style={{
              fontFamily: IRIS_FONTS.serif,
              fontSize: '0.7rem',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: IRIS_COLORS.inkSoft,
            }}>
              {IRIS_BRAND.issue}
            </div>
            <div style={{
              fontFamily: IRIS_FONTS.serif,
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: IRIS_COLORS.inkSoft,
              display: 'none',
            }} className="show-md">
              ¥0 — Free Trial Edition
            </div>
          </div>
          <button onClick={onEnter} style={{
            background: 'transparent',
            color: IRIS_COLORS.ink,
            border: `1px solid ${IRIS_COLORS.ink}`,
            padding: '0.4rem 1.1rem',
            fontSize: '0.7rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            fontWeight: 500,
          }}>
            Enter
          </button>
        </div>
      </header>

      {/* ── COVER (HERO) ─────────────────────── */}
      <section style={{
        position: 'relative',
        padding: 'clamp(3rem, 8vw, 7rem) 1.5rem clamp(3rem, 6vw, 5rem)',
        borderBottom: `1px solid ${IRIS_COLORS.ink}30`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {/* 雑誌のロゴ — 巨大 */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              fontFamily: IRIS_FONTS.display,
              fontSize: 'clamp(5rem, 22vw, 18rem)',
              fontWeight: 900,
              lineHeight: 0.85,
              color: IRIS_COLORS.inkBlack,
              letterSpacing: '-0.04em',
              margin: 0,
              fontStyle: 'normal',
            }}>
            IRIS
          </motion.h1>

          {/* サブヘッダ — 雑誌の表紙コピー */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            flexWrap: 'wrap', gap: '2rem',
            marginTop: 'clamp(1rem, 3vw, 2.5rem)',
          }}>
            <div style={{ flex: '1 1 400px' }}>
              <p style={{
                fontFamily: IRIS_FONTS.serif,
                fontStyle: 'italic',
                fontSize: 'clamp(1.5rem, 3vw, 2.4rem)',
                fontWeight: 400,
                color: IRIS_COLORS.bordeaux,
                lineHeight: 1.3,
                marginBottom: '0.5rem',
                letterSpacing: '-0.005em',
              }}>
                {IRIS_BRAND.tagline}
              </p>
              <p style={{
                fontFamily: IRIS_FONTS.body,
                fontSize: '0.95rem',
                color: IRIS_COLORS.inkSoft,
                lineHeight: 1.7,
                maxWidth: 480,
                fontWeight: 400,
              }}>
                {IRIS_BRAND.taglineJa}<br />
                案件、写真、コミュニティ。<br />
                女がひとりで、すべてを編集する時代へ。
              </p>
            </div>

            <div style={{
              fontFamily: IRIS_FONTS.serif,
              fontSize: '0.75rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: IRIS_COLORS.inkSoft,
              textAlign: 'right',
              flex: '0 0 auto',
            }}>
              <div>By Editorial</div>
              <div>Standards.</div>
            </div>
          </div>

          {/* 表紙の Cover Lines (雑誌の表紙の文言) */}
          <div style={{
            marginTop: 'clamp(3rem, 6vw, 5rem)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem 2.5rem',
            paddingTop: '1.5rem',
            borderTop: `1px solid ${IRIS_COLORS.ink}20`,
          }}>
            {[
              { num: '01', en: 'The Negotiation', ja: '広告代理店との交渉、AI が筆を取る。' },
              { num: '02', en: 'Self-Edit', ja: '画像加工と背景処理を、指先で。' },
              { num: '03', en: 'Roster', ja: 'マネージャー、編集、コラボ。チームを束ねる。' },
              { num: '04', en: 'The Match', ja: 'ブランドが、向こうから探しにくる。' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
              >
                <div style={{
                  fontFamily: IRIS_FONTS.serif,
                  fontSize: '0.7rem',
                  letterSpacing: '0.25em',
                  color: IRIS_COLORS.bordeaux,
                  fontStyle: 'italic',
                  marginBottom: '0.4rem',
                }}>
                  No. {item.num}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.display,
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  color: IRIS_COLORS.inkBlack,
                  lineHeight: 1.2,
                  marginBottom: '0.3rem',
                }}>
                  {item.en}
                </div>
                <div style={{
                  fontFamily: IRIS_FONTS.body,
                  fontSize: '0.82rem',
                  color: IRIS_COLORS.inkSoft,
                  lineHeight: 1.6,
                }}>
                  {item.ja}
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            marginTop: 'clamp(3rem, 6vw, 5rem)',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <button onClick={onEnter} style={{
              background: IRIS_COLORS.inkBlack,
              color: IRIS_COLORS.cream,
              border: 'none',
              padding: '1.1rem 3rem',
              fontSize: '0.78rem',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = IRIS_COLORS.bordeaux; }}
            onMouseLeave={e => { e.currentTarget.style.background = IRIS_COLORS.inkBlack; }}
            >
              Enter the Issue
            </button>
            <a href="#features" style={{
              fontFamily: IRIS_FONTS.serif,
              fontStyle: 'italic',
              fontSize: '1rem',
              color: IRIS_COLORS.bordeaux,
              borderBottom: `1px solid ${IRIS_COLORS.bordeaux}`,
              padding: '0.2rem 0',
              textDecoration: 'none',
            }}>
              See the contents ↓
            </a>
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
