// ============================================================
// CORE Inc. — 法人 LP (Corporate Landing)
// 「すべての時代の、核となるものを。」
// 配置: /corp ルート、noindex で検索エンジンには載せない
// ============================================================
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail as MailIcon } from 'lucide-react';
import { PrismLogo, IrisLogo, CoreLogo } from '../components/Logo';

const COMPANY = {
  nameJa: '株式会社コア',
  nameEn: 'CORE Inc.',
  founded: '2026年 設立予定',
  ceoJa: '井出 直毅',
  ceoEn: 'Naoki Ide',
  addressJa: '〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11-7',
  addressEn: '7-11-7 Uozaki-Minamimachi, Higashinada-ku, Kobe, Hyogo 658-0026, Japan',
  email: 'hello@core-inc.jp',
};

// 荘厳系フォント
const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SERIF_EN = '"EB Garamond", "Cormorant Garamond", "Noto Serif JP", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

const SPECTRUM = ['#ff5757', '#ff9842', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'];

export default function CoreSite() {
  useEffect(() => {
    document.title = '株式会社コア — すべての時代の、核となるものを。';

    // theme-color
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#0a0e1a');

    // favicon を CORE 専用に
    const links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    links.forEach(l => l.parentElement?.removeChild(l));
    const setLink = (rel: string, href: string, type?: string, sizes?: string) => {
      const l = document.createElement('link');
      l.rel = rel; l.href = href;
      if (type) l.type = type;
      if (sizes) l.setAttribute('sizes', sizes);
      document.head.appendChild(l);
    };
    setLink('icon', '/core-icon.svg', 'image/svg+xml');
    setLink('icon', '/core-192.png', 'image/png', '192x192');
    setLink('icon', '/core-512.png', 'image/png', '512x512');
    setLink('apple-touch-icon', '/core-180.png', undefined, '180x180');

    // OG / Twitter Card メタを CORE 専用に
    const setMeta = (selector: string, attr: string, value: string) => {
      let m = document.querySelector(selector);
      if (!m) {
        m = document.createElement('meta');
        const s = selector.match(/\[(?:property|name)="([^"]+)"\]/);
        if (s) m.setAttribute(selector.includes('property=') ? 'property' : 'name', s[1]);
        document.head.appendChild(m);
      }
      m.setAttribute(attr, value);
    };
    setMeta('meta[property="og:title"]', 'content', '株式会社コア — CORE Inc.');
    setMeta('meta[property="og:description"]', 'content', 'すべての時代の、核となるものを。AI エージェント OS を提供する CORE。');
    setMeta('meta[property="og:image"]', 'content', 'https://core-prism-app.vercel.app/og-core.png');
    setMeta('meta[property="og:url"]', 'content', 'https://core-prism-app.vercel.app/corp');
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:image"]', 'content', 'https://core-prism-app.vercel.app/og-core.png');
    setMeta('meta[name="twitter:title"]', 'content', '株式会社コア — CORE Inc.');
    setMeta('meta[name="twitter:description"]', 'content', 'すべての時代の、核となるものを。');
    setMeta('meta[name="description"]', 'content', '株式会社コア (CORE Inc.) — すべての時代の、核となるものを。AI エージェント OS を提供する会社。');

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
        fontFamily: FONT_SANS,
        overflowX: 'hidden',
      }}
    >
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  ベータ公開告知バー         */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{
        background: 'linear-gradient(90deg, #6FA8FF, #B07BD9, #FF6FA9)',
        color: '#fff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        position: 'relative',
        zIndex: 60,
      }}>
        ◎ 2026/05/12 — CORE Prism / Iris ベータ同時公開
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  HEADER                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="lp-safe"
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '1.15rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a
            href="#top"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            aria-label="株式会社コア"
          >
            <CoreLogo size={36} withWordmark />
          </a>
          <nav style={{ display: 'flex', gap: '1.6rem', alignItems: 'center' }}>
            <a href="#products" style={navLink} className="lp-nav-link">プロダクト</a>
            <a href="#mission" style={navLink} className="lp-nav-link">理念</a>
            <a href="#about" style={navLink} className="lp-nav-link">会社概要</a>
            <a href="#contact" style={ctaSmall}>お問い合わせ</a>
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
          padding: '7.5rem 1.5rem 7rem',
          overflow: 'hidden',
          textAlign: 'center',
          minHeight: '88vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CoreOrb />
        <CoreWatermark />

        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 3, width: '100%' }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '0.75rem',
              letterSpacing: '0.55em',
              fontWeight: 600,
              marginBottom: '2.25rem',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            CORE&nbsp;&nbsp;INC.&nbsp;&nbsp;/&nbsp;&nbsp;EST.&nbsp;2026
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.15 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(2.4rem, 6.5vw, 5.4rem)',
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '0.04em',
              marginBottom: '1.5rem',
              color: '#fff',
            }}
          >
            すべての時代の、
            <br />
            <span
              style={{
                background:
                  'linear-gradient(90deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              核となるものを。
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: '2.25rem',
              fontStyle: 'italic',
            }}
          >
            In the core of every era, there is a CORE.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.55 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.95rem, 1.45vw, 1.15rem)',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 2.1,
              maxWidth: 660,
              margin: '0 auto 2.75rem',
              fontWeight: 400,
            }}
          >
            時代がどれだけ変わっても、人の中心にあるものは変わらない。
            <br />
            私たちは、その<strong style={{ color: '#fff', fontWeight: 600 }}>「核」となる体験</strong>を、
            <br />
            次の世代に届けるための会社です。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
            style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <a href="#products" style={ctaHero}>
              プロダクトを見る
            </a>
            <a href="#about" style={ctaGhost}>
              会社概要
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
          padding: '7rem 1.5rem',
          background: 'linear-gradient(180deg,#000 0%,#070712 100%)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>理&nbsp;念</span>
            <span style={sectionLabelSub}>MISSION</span>
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.85rem, 3.6vw, 2.85rem)',
              fontWeight: 700,
              lineHeight: 1.6,
              marginBottom: '2.25rem',
              letterSpacing: '0.04em',
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
                fontWeight: 900,
              }}
            >
              人の核となるものを。
            </span>
          </motion.h2>

          <p
            style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: 'clamp(0.9rem, 1.4vw, 1.05rem)',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 2,
              fontStyle: 'italic',
              letterSpacing: '0.06em',
              marginBottom: '2rem',
            }}
          >
            "We build what stays at the center —<br />
            in your work, in your voice, in your mind."
          </p>
          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 2.2,
              maxWidth: 720,
              margin: '0 auto',
              fontWeight: 400,
            }}
          >
            私たちが目指すのは、流行や形を追うことではありません。
            <br />
            <strong style={{ color: '#fff' }}>本質に届くプロダクトを、静かに、確かに。</strong>
            <br />
            技術は手段にすぎず、いつの時代も中心にあるのは「人」です。
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
          padding: '7rem 1.5rem',
          background: '#070712',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>プロダクト</span>
              <span style={sectionLabelSub}>PRODUCTS</span>
            </p>
            <h2
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
                fontWeight: 700,
                lineHeight: 1.5,
                marginBottom: '1.25rem',
                letterSpacing: '0.04em',
              }}
            >
              ひとつの光が、二つの形に。
            </h2>
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
                maxWidth: 640,
                margin: '0 auto',
                lineHeight: 2,
                fontWeight: 400,
              }}
            >
              ひとつは光を分散し、もうひとつは光を受け止める。
              <br />
              対をなす二つのAIが、人の核を照らし出します。
            </p>
          </div>

          {/* PRISM (主力プロダクト・大きく) */}
          <FeatureProduct
            brand="prism"
            badge="フラッグシップ"
            tagline="光を、分散させる。"
            taglineEn="Disperse the light."
            description="ひとりの人間に宿る複数の人格を、エージェントAIとして外に取り出すOS。経営者・営業・財務・創造者 ── 役割の数だけ、思考が要る。すべての事業家のための、新しい知性のかたち。"
            features={[
              '7つの人格・7つの専属AIエージェント',
              '商談、議事録、財務、契約書まで一気通貫',
              '横断検索ひとつで、すべての文脈にアクセス',
            ]}
            accentColor="#a78bfa"
            accentGradient="linear-gradient(135deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)"
            url="/"
          />

          {/* IRIS (二番手・ペアで配置) */}
          <FeatureProduct
            brand="iris"
            badge="クリエイター向け"
            tagline="光を、受け止める。"
            taglineEn="Receive the light."
            description="あらゆる情報・反応・感情を受け取り、解像度の高い洞察に変えるクリエイターのためのAI。インフルエンサーの六つの仕事を、ひとつのアプリで束ねます。"
            features={[
              '案件管理・分析・創作・交渉まで一気通貫',
              'Instagram 解析と投稿AIで戦略を自動化',
              '美意識を共有する、招待制コミュニティ',
            ]}
            accentColor="#E1306C"
            accentGradient="linear-gradient(135deg,#FCB045,#E1306C,#833AB4)"
            url="/iris"
            reversed
          />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  PHILOSOPHY                */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: 'linear-gradient(180deg,#070712 0%,#000 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景の薄い光 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 600,
            height: 600,
            marginLeft: -300,
            marginTop: -300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: 940, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>思&nbsp;想</span>
            <span style={sectionLabelSub}>PHILOSOPHY</span>
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.85rem, 3.6vw, 2.75rem)',
              fontWeight: 700,
              lineHeight: 1.7,
              marginBottom: '2.25rem',
              letterSpacing: '0.05em',
            }}
          >
            光は、分かれる。
            <br />
            光は、受け止められる。
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              そのどちらもが、核。
            </span>
          </motion.h2>

          <p
            style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
              color: 'rgba(255,255,255,0.45)',
              fontStyle: 'italic',
              letterSpacing: '0.1em',
              marginBottom: '2rem',
            }}
          >
            Light disperses. Light is received. Both, the CORE.
          </p>

          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
              lineHeight: 2.2,
              maxWidth: 760,
              margin: '0 auto',
              fontWeight: 400,
            }}
          >
            ひとりの中に、複数の役割を解き放つ
            <strong style={{ color: '#a78bfa', fontWeight: 600 }}> Prism</strong>。
            <br />
            あらゆる情報を受け取り、伝わる形に変える
            <strong style={{ color: '#E1306C', fontWeight: 600 }}> Iris</strong>。
            <br />
            <br />
            この二つは、対立するように見えて、ひとつの真理の両面です。
            <br />
            それが、<strong style={{ color: '#fff', fontWeight: 700, fontFamily: FONT_DISPLAY, letterSpacing: '0.15em' }}>CORE</strong> という会社の核。
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
          padding: '7rem 1.5rem',
          background: '#000',
        }}
      >
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>会社概要</span>
              <span style={sectionLabelSub}>ABOUT</span>
            </p>
            <h2
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.5vw, 2.6rem)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              わたしたちについて
            </h2>
          </div>

          {/* CEO 紹介ブロック */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2.5rem',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '3.5rem',
              padding: '2.5rem',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <picture>
              <source srcSet="/ceo-naoki-ide.webp" type="image/webp" />
              <img
                src="/ceo-naoki-ide.jpg"
                alt="井出 直毅 / Naoki Ide — Founder & CEO"
                width={240}
                height={320}
                loading="lazy"
                decoding="async"
                style={{
                  width: 240,
                  height: 320,
                  objectFit: 'cover',
                  borderRadius: 16,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            </picture>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '0.78rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                  marginBottom: '0.6rem',
                }}
              >
                Founder &amp; CEO
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_JA,
                  fontSize: 'clamp(1.4rem, 2.2vw, 1.75rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: '0.2rem',
                  color: '#fff',
                }}
              >
                井出 直毅
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '1rem',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.06em',
                  marginBottom: '1.25rem',
                }}
              >
                Naoki Ide
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '0.95rem',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                }}
              >
                Multidisciplinary creator at the intersection of business, music, dentistry, and AI.
              </p>
            </div>
          </div>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 0,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <InfoRow label="会社名"     subLabel="Company"      value={COMPANY.nameJa}  subValue={COMPANY.nameEn} />
            <InfoRow label="設立"       subLabel="Founded"      value={COMPANY.founded} />
            <InfoRow label="代表取締役" subLabel="CEO"           value={COMPANY.ceoJa}    subValue={COMPANY.ceoEn} />
            <InfoRow label="本社所在地" subLabel="Headquarters" value={COMPANY.addressJa} subValue={COMPANY.addressEn} />
            <InfoRow label="事業内容"   subLabel="Business"     value="エージェントAIを中心とした SaaS の開発・運営" />
            <InfoRow label="提供サービス" subLabel="Products"   value="CORE Prism（事業家向け）, CORE Iris（クリエイター向け）" isLast />
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
          padding: '7rem 1.5rem',
          background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.18) 0%, #000 70%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>お問い合わせ</span>
            <span style={sectionLabelSub}>CONTACT</span>
          </p>
          <h2
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.95rem, 3.8vw, 2.85rem)',
              fontWeight: 700,
              marginBottom: '1.75rem',
              lineHeight: 1.5,
              letterSpacing: '0.05em',
            }}
          >
            核を、共に。
          </h2>
          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              color: 'rgba(255,255,255,0.65)',
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
              lineHeight: 2.1,
              marginBottom: '2.5rem',
              fontWeight: 400,
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
              fontFamily: '"SF Mono", "Menlo", monospace',
              letterSpacing: '0.05em',
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <MailIcon size={17} strokeWidth={2.2} />
            {COMPANY.email}
          </a>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  FOOTER                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer
        style={{
          background: '#000',
          padding: '3.5rem 1.5rem 2.5rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2.5rem',
            marginBottom: '2.75rem',
          }}
        >
          <div>
            <CoreLogo size={32} withWordmark />
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.9,
                marginTop: '0.85rem',
              }}
            >
              すべての時代の、<br />核となるものを。
            </p>
          </div>
          <div>
            <p style={footHead}>プロダクト</p>
            <a href="/" style={footLink}>CORE Prism</a>
            <a href="/iris" style={footLink}>CORE Iris</a>
          </div>
          <div>
            <p style={footHead}>会社</p>
            <a href="#mission" style={footLink}>理念</a>
            <a href="#about" style={footLink}>会社概要</a>
            <a href="#contact" style={footLink}>お問い合わせ</a>
          </div>
          <div>
            <p style={footHead}>連絡先</p>
            <a href={`mailto:${COMPANY.email}`} style={footLink}>{COMPANY.email}</a>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.8,
                marginTop: '0.5rem',
                fontFamily: FONT_SERIF_JA,
              }}
            >
              {COMPANY.addressJa}
            </p>
          </div>
        </div>
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '1.75rem',
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.25em',
          }}
        >
          © {new Date().getFullYear()} CORE INC. — FOUNDING IN 2026
        </div>
      </footer>
    </div>
  );
}

// ============================================================
//  CoreOrb — 中央の白光と虹色光線 (荘厳に、控えめに)
// ============================================================
function CoreOrb() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <motion.div
        animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 420,
          height: 420,
          marginLeft: -210,
          marginTop: -210,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 40%, transparent 70%)',
          filter: 'blur(24px)',
        }}
      />
      {SPECTRUM.map((c, i) => {
        const angle = -75 + i * 25;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.14, 0.32, 0.14] }}
            transition={{
              duration: 5 + i * 0.3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.18,
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 4,
              height: '90vh',
              transformOrigin: 'top center',
              transform: `translateX(-50%) rotate(${angle}deg)`,
              background: `linear-gradient(180deg, ${c}cc 0%, ${c}00 80%)`,
              filter: 'blur(11px)',
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: '#a78bfa', opacity: 0.08, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: '#E1306C', opacity: 0.06, filter: 'blur(80px)' }} />
    </div>
  );
}

// ============================================================
//  CoreWatermark — 巨大な「CORE」の透かし背景文字
// ============================================================
function CoreWatermark() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}
    >
      <motion.span
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 'clamp(8rem, 28vw, 26rem)',
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,0.06)',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        CORE
      </motion.span>
    </div>
  );
}

// ============================================================
//  FeatureProduct — Prism / Iris をフィーチャーする横長カード
// ============================================================
function FeatureProduct({
  brand,
  badge,
  tagline,
  taglineEn,
  description,
  features,
  accentColor,
  accentGradient,
  url,
  reversed,
}: {
  brand: 'prism' | 'iris';
  badge: string;
  tagline: string;
  taglineEn: string;
  description: string;
  features: string[];
  accentColor: string;
  accentGradient: string;
  url: string;
  reversed?: boolean;
}) {
  const Logo = brand === 'iris' ? IrisLogo : PrismLogo;
  const productName = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7 }}
      className="lp-feature-product"
      style={{
        position: 'relative',
        marginBottom: '2rem',
        padding: 'clamp(2rem, 4vw, 3.5rem)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: reversed ? '1fr 0.85fr' : '0.85fr 1fr',
        gap: 'clamp(2rem, 4vw, 4rem)',
        alignItems: 'center',
      }}
    >
      {/* 装飾オーラ */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -100,
          [reversed ? 'left' : 'right']: -100,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: accentColor,
          opacity: 0.18,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* ロゴ + 視覚要素 */}
      <div
        style={{
          order: reversed ? 2 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            filter: `drop-shadow(0 12px 32px ${accentColor}66)`,
          }}
        >
          <Logo size={140} withWordmark={false} />
        </motion.div>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 'clamp(1.25rem, 2vw, 1.6rem)',
            fontWeight: 700,
            letterSpacing: '0.4em',
            marginTop: '1.5rem',
            background: accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            paddingLeft: '0.4em',
          }}
        >
          {brand.toUpperCase()}
        </p>
        <p
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.2em',
            marginTop: 4,
            fontFamily: FONT_SERIF_EN,
            fontStyle: 'italic',
          }}
        >
          {productName}
        </p>
      </div>

      {/* テキストコンテンツ */}
      <div style={{ order: reversed ? 1 : 2, position: 'relative', zIndex: 2 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.7rem',
            letterSpacing: '0.25em',
            fontWeight: 700,
            padding: '0.35rem 0.85rem',
            borderRadius: 999,
            background: `${accentColor}25`,
            border: `1px solid ${accentColor}50`,
            color: accentColor,
            marginBottom: '1rem',
            fontFamily: FONT_SERIF_JA,
          }}
        >
          {badge}
        </span>
        <h3
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(1.85rem, 3.4vw, 2.5rem)',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: '0.5rem',
            letterSpacing: '0.04em',
          }}
        >
          {tagline}
        </h3>
        <p
          style={{
            fontFamily: FONT_SERIF_EN,
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.45)',
            fontStyle: 'italic',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
          }}
        >
          {taglineEn}
        </p>

        <p
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(0.92rem, 1.4vw, 1rem)',
            color: 'rgba(255,255,255,0.72)',
            lineHeight: 2.1,
            marginBottom: '1.5rem',
            fontWeight: 400,
          }}
        >
          {description}
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem' }}>
          {features.map((f, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontFamily: FONT_SERIF_JA,
                fontSize: '0.92rem',
                color: 'rgba(255,255,255,0.72)',
                lineHeight: 1.9,
                marginBottom: '0.5rem',
              }}
            >
              <span
                style={{
                  color: accentColor,
                  flexShrink: 0,
                  fontSize: '0.7rem',
                  marginTop: '0.45rem',
                }}
              >
                ●
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <a
          href={url}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: FONT_SERIF_JA,
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            padding: '0.85rem 1.75rem',
            borderRadius: 12,
            background: accentGradient,
            boxShadow: `0 8px 24px ${accentColor}55`,
            letterSpacing: '0.08em',
          }}
        >
          {productName} を見る →
        </a>
      </div>
    </motion.div>
  );
}

// ============================================================
//  InfoRow — 会社概要の行
// ============================================================
function InfoRow({
  label,
  subLabel,
  value,
  subValue,
  isLast = false,
}: {
  label: string;
  subLabel: string;
  value: string;
  subValue?: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        padding: '1.4rem 1.75rem',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
        alignItems: 'center',
        gap: '1rem',
      }}
      className="lp-info-row"
    >
      <div>
        <p
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '0.65rem',
            letterSpacing: '0.25em',
            color: 'rgba(255,255,255,0.35)',
            marginTop: 4,
            fontWeight: 600,
          }}
        >
          {subLabel.toUpperCase()}
        </p>
      </div>
      <div>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: '#fff', lineHeight: 1.7, fontWeight: 500 }}>
          {value}
        </p>
        {subValue && (
          <p
            style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.45)',
              marginTop: 4,
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

// ───────────── スタイル ─────────────
const navLink: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.88rem',
  color: 'rgba(255,255,255,0.75)',
  textDecoration: 'none',
  fontWeight: 500,
  letterSpacing: '0.1em',
};
const ctaSmall: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#fff',
  textDecoration: 'none',
  padding: '0.6rem 1.25rem',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 999,
  letterSpacing: '0.1em',
};
const ctaHero: React.CSSProperties = {
  display: 'inline-block',
  background:
    'linear-gradient(135deg,#ff5757,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)',
  backgroundSize: '300% 100%',
  color: '#000',
  padding: '1.1rem 2.4rem',
  borderRadius: 14,
  fontFamily: FONT_SERIF_JA,
  fontSize: '1rem',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 12px 36px rgba(167,139,250,0.45)',
  letterSpacing: '0.12em',
};
const ctaGhost: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  padding: '1.1rem 2.1rem',
  borderRadius: 14,
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.95rem',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.18)',
  letterSpacing: '0.1em',
};
const sectionLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  marginBottom: '1.25rem',
};
const sectionLabelMain: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.95rem',
  letterSpacing: '0.4em',
  color: 'rgba(255,255,255,0.85)',
  fontWeight: 700,
};
const sectionLabelSub: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.65rem',
  letterSpacing: '0.45em',
  color: 'rgba(255,255,255,0.35)',
  fontWeight: 600,
};
const footHead: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.7rem',
  letterSpacing: '0.3em',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '0.85rem',
  fontWeight: 700,
};
const footLink: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT_SERIF_JA,
  color: 'rgba(255,255,255,0.65)',
  fontSize: '0.85rem',
  textDecoration: 'none',
  marginBottom: '0.5rem',
};
