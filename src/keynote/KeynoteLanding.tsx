// ============================================================
// Core Identity OS — 先行案内 (Keynote Landing)
// 講演会の QR コードから到達するクローズドベータ専用ページ
// 「不可逆の扉」を開けた人にだけ見える、Prism / Iris 統合の入口
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedAvatar from '../components/AnimatedAvatar';

export default function KeynoteLanding() {
  const [pick, setPick] = useState<'prism' | 'iris' | null>(null);

  useEffect(() => {
    document.title = 'Core Identity OS — 先行案内';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0a0a14');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #1A1230 0%, #0a0a14 70%)',
      color: '#FFFAF5',
      fontFamily: '"Inter","Noto Sans JP",sans-serif',
      overflowX: 'hidden',
    }}>
      {/* 微細な粒子の背景 */}
      <BackgroundStars />

      {/* HERO */}
      <section style={{
        padding: 'calc(env(safe-area-inset-top, 0px) + 5rem) 1.25rem 4rem',
        textAlign: 'center', position: 'relative', zIndex: 2,
      }}>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{
            fontSize: '0.72rem', letterSpacing: '0.5em', fontWeight: 700,
            background: 'linear-gradient(90deg, #FCB045, #E1306C, #B07BD9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '1.25rem',
          }}>
          CORE IDENTITY OS — CLOSED BETA INVITATION
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1 }}
          style={{
            fontFamily: '"Playfair Display","Cinzel","Noto Serif JP",serif',
            fontStyle: 'italic',
            fontSize: 'clamp(2.4rem, 6.5vw, 5.2rem)',
            fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.01em',
            marginBottom: '1.5rem',
          }}>
            ひとつの肉体に、
            <br />
            <span style={{
              background: 'linear-gradient(120deg, #FCB045, #E1306C 50%, #B07BD9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              無限の自分を。
            </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          style={{
            fontFamily: '"Cormorant Garamond","Noto Serif JP",serif',
            fontSize: 'clamp(1.05rem, 2.1vw, 1.45rem)',
            color: 'rgba(255,250,245,0.85)',
            lineHeight: 1.85, marginBottom: '0.75rem',
          }}>
          中世の時計が作った「時間の奴隷」を、今日で終わらせる。
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45 }}
          style={{
            fontSize: 'clamp(0.95rem, 1.7vw, 1.1rem)',
            color: 'rgba(255,250,245,0.6)',
            lineHeight: 1.85, maxWidth: 720, margin: '0 auto 3rem',
          }}>
          Core Identity OS は、あなたの左脳の作業を AI 分身が引き受け、
          <br />
          右脳の創造をあなただけに残す、自己拡張のためのオペレーティングシステム。
        </motion.p>

        {/* 2 つの分身カード */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          style={{
            display: 'grid', gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            maxWidth: 880, margin: '0 auto',
          }}>
          <BrandCard
            brand="prism" pick={pick} setPick={setPick}
            tag="FOR EVERY ENTREPRENEUR"
            title="CORE Prism"
            line="あなたの左脳を引き受ける、7 つの分身"
            desc="経営・営業・財務・創造・学び・人材・生活 — 役割の数だけエージェント。明日決断すべき「たった 1 つのこと」だけが、あなたの机に残る。"
            href="/"
          />
          <BrandCard
            brand="iris" pick={pick} setPick={setPick}
            tag="FOR EVERY CREATOR"
            title="CORE Iris"
            line="数万のファンに、あなたの体温で届ける"
            desc="DM 返信・案件交渉・投稿生成・美容相談 — Iris があなたの瞳になり、ひとり一人に「あなただけ」のメッセージを届け続ける。"
            href="/iris"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          style={{ fontSize: '0.78rem', color: 'rgba(255,250,245,0.45)', marginTop: '2rem', fontStyle: 'italic' }}>
          14 日無料 · クレカ不要 · 講演会限定 30 日延長コード <strong style={{ color: '#FCB045' }}>KEYNOTE30</strong>
        </motion.p>
      </section>

      {/* 哲学パート (台本ベース) */}
      <section style={{ padding: '5rem 1.25rem', maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <h2 style={{
          fontFamily: '"Playfair Display","Noto Serif JP",serif',
          fontStyle: 'italic',
          fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)',
          fontWeight: 500, lineHeight: 1.4, marginBottom: '1.5rem', textAlign: 'center',
          background: 'linear-gradient(120deg, #FCB045, #E1306C 50%, #B07BD9)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          AI が仕事を奪うのではない。<br />人間が機械の真似事を、辞めるためにある。
        </h2>
        <p style={{
          fontFamily: '"Cormorant Garamond","Noto Serif JP",serif',
          fontSize: 'clamp(1rem, 1.85vw, 1.2rem)',
          color: 'rgba(255,250,245,0.72)',
          lineHeight: 2, textAlign: 'center', marginBottom: '2.5rem',
        }}>
          メールの定型文を打ち、領収書を入力し、同じような告知を繰り返す。
          <br />
          それは、あなたが既に「機械」になっているということ。
          <br />
          Core Identity OS は、あなたを人間に戻すための装置。
        </p>

        {/* 3 つの数字ハイライト */}
        <div style={{
          display: 'grid', gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginTop: '3rem',
        }}>
          {[
            { k: '23 分', d: '集中状態に戻るのにかかる時間 (1 通の通知あたり)' },
            { k: '7 + 6', d: '事業家・クリエイターのために用意した分身エージェントの数' },
            { k: '24 / 7', d: 'あなたが眠っている間も動き続ける、もう一人のあなた' },
          ].map((s, i) => (
            <motion.div
              key={s.k}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                background: 'rgba(255,250,245,0.04)',
                border: '1px solid rgba(255,250,245,0.12)',
                borderRadius: 18, padding: '1.6rem 1.25rem', textAlign: 'center',
              }}>
              <div style={{
                fontFamily: '"Inter",sans-serif', fontSize: '2.4rem', fontWeight: 800,
                background: 'linear-gradient(135deg, #FCB045, #E1306C)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1.1, marginBottom: '0.5rem',
              }}>
                {s.k}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'rgba(255,250,245,0.7)', lineHeight: 1.65 }}>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 最終 CTA */}
      <section style={{
        padding: 'calc(5rem) 1.25rem calc(6rem + env(safe-area-inset-bottom, 0px))',
        background: 'radial-gradient(ellipse at center, #1A0A26 0%, #0a0a14 70%)',
        textAlign: 'center', position: 'relative', zIndex: 2,
      }}>
        <h2 style={{
          fontFamily: '"Playfair Display","Noto Serif JP",serif',
          fontStyle: 'italic',
          fontSize: 'clamp(1.7rem, 3.6vw, 2.6rem)',
          fontWeight: 500, lineHeight: 1.3, marginBottom: '1.25rem',
        }}>
          扉は、もう開いてしまった。
        </h2>
        <p style={{
          color: 'rgba(255,250,245,0.7)', fontSize: 'clamp(0.95rem, 1.7vw, 1.1rem)',
          lineHeight: 1.85, marginBottom: '2.5rem', maxWidth: 640, margin: '0 auto 2.5rem',
        }}>
          昨日までのあなたには、もう戻れない。<br />
          先に進むのか、忘れたフリをして留まるのか。決めるのは、今この瞬間。
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={ctaBtnPrism}>
            Prism を試す
          </a>
          <a href="/iris" style={ctaBtnIris}>
            Iris を試す
          </a>
        </div>
        <p style={{ marginTop: '2rem', fontSize: '0.78rem', color: 'rgba(255,250,245,0.4)' }}>
          講演会限定コード <strong style={{ color: '#FCB045' }}>KEYNOTE30</strong> を入力すると、トライアルが 30 日に延長されます (Phase 2 で実装予定)
        </p>
      </section>

      <footer style={{
        textAlign: 'center', padding: '2rem 1rem',
        color: 'rgba(255,250,245,0.35)', fontSize: '0.78rem',
        borderTop: '1px solid rgba(255,250,245,0.08)',
      }}>
        Core Identity OS — produced by 株式会社コアプリズム (仮) / Founder: 井出直毅
      </footer>
    </div>
  );
}

function BrandCard({ brand, pick, setPick, tag, title, line, desc, href }: {
  brand: 'prism' | 'iris';
  pick: 'prism' | 'iris' | null;
  setPick: (b: 'prism' | 'iris' | null) => void;
  tag: string; title: string; line: string; desc: string; href: string;
}) {
  const isHover = pick === brand;
  const accent = brand === 'iris' ? '#E1306C' : '#7A8AFF';
  return (
    <a href={href}
      onMouseEnter={() => setPick(brand)}
      onMouseLeave={() => setPick(null)}
      style={{
        textDecoration: 'none', color: 'inherit',
        background: isHover
          ? `linear-gradient(180deg, ${accent}25, ${accent}10)`
          : 'rgba(255,250,245,0.04)',
        border: `1px solid ${isHover ? accent + '88' : 'rgba(255,250,245,0.12)'}`,
        borderRadius: 22,
        padding: '2rem 1.5rem 1.75rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: isHover ? `0 16px 40px ${accent}44` : 'none',
        transition: 'all 0.25s ease',
        transform: isHover ? 'translateY(-4px)' : 'none',
      }}>
      <AnimatedAvatar
        brand={brand}
        isSpeaking={false}
        mood={isHover ? 'happy' : 'curious'}
        size={150}
      />
      <p style={{
        fontSize: '0.65rem', letterSpacing: '0.32em', fontWeight: 700,
        color: accent, marginTop: '1rem', textTransform: 'uppercase',
      }}>
        {tag}
      </p>
      <h3 style={{
        fontFamily: '"Playfair Display","Noto Serif JP",serif', fontStyle: 'italic',
        fontSize: '2rem', fontWeight: 500, margin: '0.4rem 0 0.4rem',
      }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,250,245,0.92)', marginBottom: '0.65rem', textAlign: 'center' }}>
        {line}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,250,245,0.62)', lineHeight: 1.7, textAlign: 'center' }}>
        {desc}
      </p>
      <span style={{
        marginTop: '1.25rem',
        background: `linear-gradient(135deg, ${accent}, ${brand === 'iris' ? '#FCB045' : '#B07BD9'})`,
        color: '#fff', padding: '0.7rem 1.5rem', borderRadius: 999,
        fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.04em',
        boxShadow: `0 6px 20px ${accent}55`,
      }}>
        試してみる →
      </span>
    </a>
  );
}

function BackgroundStars() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const x = (i * 37 + 11) % 100;
        const y = (i * 53 + 17) % 100;
        const dur = 6 + (i % 5);
        const delay = (i % 7) * 0.4;
        return (
          <motion.div
            key={i}
            animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.4, 1] }}
            transition={{ duration: dur, repeat: Infinity, delay, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              left: `${x}%`, top: `${y}%`,
              width: 3, height: 3, borderRadius: '50%',
              background: i % 3 === 0 ? '#FCB045' : i % 3 === 1 ? '#E1306C' : '#B07BD9',
              boxShadow: '0 0 12px currentColor',
            }} />
        );
      })}
    </div>
  );
}

const ctaBtnPrism: React.CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #6FA8FF, #B07BD9, #E1306C)',
  color: '#fff',
  padding: '1rem 2.2rem',
  borderRadius: 14,
  fontSize: '1rem', fontWeight: 800,
  textDecoration: 'none', letterSpacing: '0.05em',
  boxShadow: '0 12px 36px rgba(122,138,255,0.45)',
};

const ctaBtnIris: React.CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #FCB045, #E1306C, #833AB4)',
  color: '#fff',
  padding: '1rem 2.2rem',
  borderRadius: 14,
  fontSize: '1rem', fontWeight: 800,
  textDecoration: 'none', letterSpacing: '0.05em',
  boxShadow: '0 12px 36px rgba(225,48,108,0.45)',
};
