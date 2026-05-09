// ============================================================
// CORE Inc. — 法人 LP (Corporate Landing)
// 「In the core of every era, there is a CORE.」
// 配置: /corp ルート、noindex で検索エンジンには載せない
// ============================================================
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { PrismLogo, IrisLogo } from '../components/Logo';

const COMPANY = {
  nameEn: 'CORE Inc.',
  nameJa: '株式会社コア',
  founded: 'Founding in 2026',
  ceo: 'Naoki Ide',
  ceoJa: '井出 直樹',
  address: '7-11-7 Uozaki-Minamimachi, Higashinada-ku, Kobe, Hyogo 658-0026, Japan',
  addressJa: '〒658-0026 兵庫県神戸市東灘区魚崎南町7丁目11-7',
  email: 'hello@core-inc.jp',
};

const SPECTRUM = ['#ff5757', '#ff9842', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'];

export default function CoreSite() {
  useEffect(() => {
    // タイトル + theme-color
    document.title = 'CORE Inc. — In the core of every era.';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#000000');

    // 検索エンジンには載せない (noindex)
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);

  return (
    <div
      style={{
        background: '#000',
        color: '#fff',
        minHeight: '100vh',
        fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", "游ゴシック", sans-serif',
        overflowX: 'hidden',
      }}
    >
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  HEADER (sticky, minimal)  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          className="lp-safe"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '1.1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a
            href="#top"
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              letterSpacing: '0.4em',
              color: '#fff',
              textDecoration: 'none',
              fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
            }}
          >
            CORE
          </a>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href="#products" style={navLink} className="lp-nav-link">Products</a>
            <a href="#mission" style={navLink} className="lp-nav-link">Mission</a>
            <a href="#about" style={navLink} className="lp-nav-link">About</a>
            <a href="#contact" style={ctaSmall}>Contact →</a>
          </nav>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  HERO                       */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="top"
        className="lp-hero-pad lp-safe"
        style={{
          position: 'relative',
          padding: '9rem 1.5rem 7rem',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <CoreOrb />

        <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.5em',
              fontWeight: 600,
              marginBottom: '1.75rem',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            CORE INC.  /  EST. 2026
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.1 }}
            style={{
              fontFamily: '"Playfair Display", "Cormorant Garamond", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(2.6rem, 7vw, 6rem)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              marginBottom: '1.75rem',
            }}
          >
            In the core
            <br />
            of every era,
            <br />
            <span
              style={{
                background:
                  'linear-gradient(90deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              there is a CORE.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            style={{
              fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.9,
              maxWidth: 660,
              margin: '0 auto 2.5rem',
            }}
          >
            時代がどれだけ変わっても、人の中心にあるものは変わらない。
            <br />
            CORE は、その「核」となる体験を、テクノロジーで再定義する会社です。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55 }}
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <a href="#products" style={ctaHero}>
              Discover Products
            </a>
            <a href="#about" style={ctaGhost}>
              About CORE
            </a>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  MISSION                    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="mission"
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: 'linear-gradient(180deg,#000 0%,#070712 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <p style={sectionLabel}>MISSION</p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.7rem, 3.5vw, 2.6rem)',
              fontWeight: 500,
              lineHeight: 1.45,
              marginBottom: '1.75rem',
            }}
          >
            時代を超えて、
            <br />
            <span
              style={{
                background:
                  'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              人の核となるものを。
            </span>
          </motion.h2>

          <p
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: 'clamp(1rem, 1.6vw, 1.2rem)',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 2,
              fontStyle: 'italic',
            }}
          >
            "We build what stays at the center —<br />
            in your work, in your voice, in your mind."
          </p>
          <p
            style={{
              fontSize: '0.95rem',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 2,
              marginTop: '1.5rem',
              maxWidth: 720,
              margin: '1.5rem auto 0',
            }}
          >
            私たちは、流行や形ではなく
            <strong style={{ color: '#fff' }}>本質に届くプロダクト</strong>を作ります。
            技術は手段にすぎない。中心にあるのは、いつの時代も「人」です。
          </p>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  PRODUCTS                  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="products"
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: '#070712',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={sectionLabel}>PRODUCTS</p>
            <h2
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
                fontWeight: 500,
                lineHeight: 1.2,
                marginBottom: '1rem',
              }}
            >
              Two halves of the same light.
            </h2>
            <p
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '1rem',
                maxWidth: 640,
                margin: '0 auto',
                lineHeight: 1.8,
              }}
            >
              ひとつは光を分散し、もうひとつは光を受け止める。
              <br />
              対をなす 2 つの AI が、人の核を照らし出します。
            </p>
          </div>

          <div className="lp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <ProductCard
              brand="prism"
              tagline="Disperse the light."
              jaTagline="光を、分散させる。"
              description="ひとりの人間に宿る複数の人格を、AI エージェントとして外に取り出す OS。経営者・営業・財務・創造者 ─ 役割の数だけ、思考が要る。"
              accentGradient="linear-gradient(135deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)"
              accentColor="#a78bfa"
              url="/"
            />
            <ProductCard
              brand="iris"
              tagline="Receive the light."
              jaTagline="光を、受け止める。"
              description="あらゆる情報・感情・反応を受け取り、解像度の高い洞察に変えるクリエイター AI。インフルエンサーの 6 つの仕事を、ひとつのアプリで。"
              accentGradient="linear-gradient(135deg,#FCB045,#E1306C,#833AB4)"
              accentColor="#E1306C"
              url="/iris"
            />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  PHILOSOPHY (Prism + Iris) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: 'linear-gradient(180deg,#070712 0%,#000 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={sectionLabel}>PHILOSOPHY</p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)',
              fontWeight: 500,
              lineHeight: 1.4,
              marginBottom: '2rem',
            }}
          >
            Light disperses.
            <br />
            Light is received.
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Both, the CORE.
            </span>
          </motion.h2>

          <p
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
              lineHeight: 2,
              maxWidth: 720,
              margin: '0 auto',
            }}
          >
            ひとりの中に複数の役割を解き放つ
            <strong style={{ color: '#a78bfa' }}> Prism</strong>。<br />
            あらゆる情報を受け取り、伝わる形に変える
            <strong style={{ color: '#E1306C' }}> Iris</strong>。<br />
            <br />
            この 2 つは、対立するように見えて、ひとつの真理の両面です。
            <br />
            それが、<strong style={{ color: '#fff' }}>CORE</strong> という会社の核。
          </p>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  ABOUT (会社概要)            */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="about"
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: '#000',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <p style={{ ...sectionLabel, textAlign: 'center' }}>ABOUT</p>
          <h2
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.85rem, 3.5vw, 2.6rem)',
              fontWeight: 500,
              textAlign: 'center',
              marginBottom: '3rem',
            }}
          >
            Company Information
          </h2>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 0,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <InfoRow label="Company" labelJa="会社名" value={COMPANY.nameEn} subValue={COMPANY.nameJa} />
            <InfoRow label="Founded" labelJa="設立" value={COMPANY.founded} subValue="2026 年設立予定" />
            <InfoRow
              label="CEO"
              labelJa="代表取締役"
              value={COMPANY.ceo}
              subValue={COMPANY.ceoJa}
            />
            <InfoRow
              label="Headquarters"
              labelJa="本社所在地"
              value={COMPANY.address}
              subValue={COMPANY.addressJa}
            />
            <InfoRow
              label="Business"
              labelJa="事業内容"
              value="AI Agent OS — Development & Operation"
              subValue="エージェント AI を中心とした SaaS の開発・運営"
            />
            <InfoRow
              label="Products"
              labelJa="提供サービス"
              value="CORE Prism, CORE Iris"
              subValue="事業家向け / クリエイター向け AI"
              isLast
            />
          </dl>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  CONTACT                    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="contact"
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.15) 0%, #000 70%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>CONTACT</p>
          <h2
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.85rem, 3.8vw, 2.75rem)',
              fontWeight: 500,
              marginBottom: '1.5rem',
              lineHeight: 1.3,
            }}
          >
            Let&apos;s build the core,
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#ff9842,#a78bfa,#f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              together.
            </span>
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '1rem',
              lineHeight: 1.9,
              marginBottom: '2.25rem',
            }}
          >
            法人契約・カスタム導入・取材・資本提携など、
            <br />
            お問い合わせは下記までご連絡ください。
          </p>
          <a
            href={`mailto:${COMPANY.email}`}
            style={{
              ...ctaHero,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            ✉ {COMPANY.email}
          </a>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  FOOTER                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer
        style={{
          background: '#000',
          padding: '3rem 1.5rem 2rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <div>
            <p
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                letterSpacing: '0.4em',
                fontFamily: '"Cormorant Garamond", serif',
                marginBottom: '0.5rem',
              }}
            >
              CORE
            </p>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.7,
              }}
            >
              In the core of every era,<br />
              there is a CORE.
            </p>
          </div>
          <div>
            <p style={footHead}>PRODUCTS</p>
            <a href="/" style={footLink}>CORE Prism</a>
            <a href="/iris" style={footLink}>CORE Iris</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <a href="#mission" style={footLink}>Mission</a>
            <a href="#about" style={footLink}>About</a>
            <a href="#contact" style={footLink}>Contact</a>
          </div>
          <div>
            <p style={footHead}>CONTACT</p>
            <a href={`mailto:${COMPANY.email}`} style={footLink}>{COMPANY.email}</a>
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, marginTop: '0.5rem' }}>
              {COMPANY.addressJa}
            </p>
          </div>
        </div>
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            letterSpacing: '0.1em',
          }}
        >
          © {new Date().getFullYear()} CORE Inc. — Founding in 2026.
        </div>
      </footer>
    </div>
  );
}

// ============================================================
//  CoreOrb — 中心の白光が虹色に分散するヒーロー演出
// ============================================================
function CoreOrb() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {/* 中央の核 */}
      <motion.div
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '40%',
          width: 360,
          height: 360,
          marginLeft: -180,
          marginTop: -180,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.15) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      {/* 7 色の光線 (左右対称、外側に伸びる) */}
      {SPECTRUM.map((c, i) => {
        const angle = -75 + i * 25;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.18, 0.4, 0.18] }}
            transition={{
              duration: 4 + i * 0.3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.15,
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '40%',
              width: 4,
              height: '70vh',
              transformOrigin: 'top center',
              transform: `translateX(-50%) rotate(${angle}deg)`,
              background: `linear-gradient(180deg, ${c}cc 0%, ${c}00 80%)`,
              filter: 'blur(10px)',
            }}
          />
        );
      })}
      {/* 周縁グロー */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: '#a78bfa',
          opacity: 0.1,
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          left: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: '#E1306C',
          opacity: 0.08,
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

// ============================================================
//  ProductCard — Prism / Iris のカード
// ============================================================
function ProductCard({
  brand,
  tagline,
  jaTagline,
  description,
  accentGradient,
  accentColor,
  url,
}: {
  brand: 'prism' | 'iris';
  tagline: string;
  jaTagline: string;
  description: string;
  accentGradient: string;
  accentColor: string;
  url: string;
}) {
  const Logo = brand === 'iris' ? IrisLogo : PrismLogo;
  const productName = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';

  return (
    <motion.a
      href={url}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'block',
        position: 'relative',
        padding: '2.5rem 2rem',
        background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        textDecoration: 'none',
        color: '#fff',
        overflow: 'hidden',
        minHeight: 360,
      }}
    >
      {/* 装飾オーラ */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: accentColor,
          opacity: 0.18,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ marginBottom: '1.5rem', filter: `drop-shadow(0 4px 16px ${accentColor}55)` }}>
          <Logo size={52} withWordmark={false} />
        </div>

        <p
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.3em',
            fontWeight: 700,
            background: accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem',
          }}
        >
          {productName.toUpperCase()}
        </p>

        <h3
          style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.6rem, 2.6vw, 2rem)',
            fontWeight: 500,
            marginBottom: '0.4rem',
            lineHeight: 1.2,
          }}
        >
          {tagline}
        </h3>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.55)',
            marginBottom: '1.5rem',
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
          }}
        >
          {jaTagline}
        </p>

        <p
          style={{
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.85,
            marginBottom: '2rem',
          }}
        >
          {description}
        </p>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: accentColor,
            letterSpacing: '0.05em',
          }}
        >
          Learn more →
        </span>
      </div>
    </motion.a>
  );
}

// ============================================================
//  InfoRow — 会社概要の行
// ============================================================
function InfoRow({
  label,
  labelJa,
  value,
  subValue,
  isLast = false,
}: {
  label: string;
  labelJa: string;
  value: string;
  subValue?: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        padding: '1.25rem 1.5rem',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        alignItems: 'center',
        gap: '1rem',
      }}
      className="lp-info-row"
    >
      <div>
        <p
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 700,
          }}
        >
          {label.toUpperCase()}
        </p>
        <p
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.35)',
            marginTop: 2,
          }}
        >
          {labelJa}
        </p>
      </div>
      <div>
        <p style={{ fontSize: '0.95rem', color: '#fff', lineHeight: 1.6 }}>{value}</p>
        {subValue && (
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.6 }}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

// ───────────── スタイル ─────────────
const navLink: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'rgba(255,255,255,0.7)',
  textDecoration: 'none',
  fontWeight: 500,
  letterSpacing: '0.05em',
};
const ctaSmall: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#fff',
  textDecoration: 'none',
  padding: '0.55rem 1.1rem',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 999,
  letterSpacing: '0.05em',
};
const ctaHero: React.CSSProperties = {
  display: 'inline-block',
  background:
    'linear-gradient(135deg,#ff5757,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)',
  backgroundSize: '300% 100%',
  color: '#000',
  padding: '1.05rem 2.25rem',
  borderRadius: 14,
  fontSize: '1rem',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 12px 36px rgba(167,139,250,0.45)',
  letterSpacing: '0.04em',
};
const ctaGhost: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  padding: '1.05rem 2rem',
  borderRadius: 14,
  fontSize: '0.95rem',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.15)',
  letterSpacing: '0.04em',
};
const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.4em',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 700,
  marginBottom: '1rem',
};
const footHead: React.CSSProperties = {
  fontSize: '0.65rem',
  letterSpacing: '0.25em',
  color: 'rgba(255,255,255,0.45)',
  marginBottom: '0.75rem',
  fontWeight: 700,
};
const footLink: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.65)',
  fontSize: '0.85rem',
  textDecoration: 'none',
  marginBottom: '0.5rem',
};
