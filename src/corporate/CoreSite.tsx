// ============================================================
// CORE Inc. — 法人 LP (Corporate Landing)
// 「すべての時代の、核となるものを。」
// 配置: /corp ルート、noindex で検索エンジンには載せない
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import LegalModal, { type LegalKind } from '../components/LegalModal';
import { Mail as MailIcon, Compass, Heart, Shield, BadgeCheck, MessagesSquare, Scale } from 'lucide-react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo, CoreLogo } from '../components/Logo';

const COMPANY = {
  nameJa: '株式会社コア',
  nameEn: 'CORE Inc.',
  founded: '2026年 設立予定',
  ceoJa: '井出 直毅',
  ceoEn: 'Naoki Ide',
  addressJa: '〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11-7',
  addressEn: '7-11-7 Uozaki-Minamimachi, Higashinada-ku, Kobe, Hyogo 658-0025, Japan',
  email: 'hello@core-inc.jp',
};

// 荘厳系フォント
const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SERIF_EN = '"EB Garamond", "Cormorant Garamond", "Noto Serif JP", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

const SPECTRUM = ['#ff5757', '#ff9842', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'];

export default function CoreSite() {
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
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
    setMeta('meta[property="og:image"]', 'content', 'https://core-prism-app.vercel.app/og-core-v4.png');
    setMeta('meta[property="og:url"]', 'content', 'https://core-prism-app.vercel.app/corp');
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:image"]', 'content', 'https://core-prism-app.vercel.app/og-core-v4.png');
    setMeta('meta[name="twitter:title"]', 'content', '株式会社コア — CORE Inc.');
    setMeta('meta[name="twitter:description"]', 'content', 'すべての時代の、核となるものを。');
    setMeta('meta[name="description"]', 'content', '株式会社コア (CORE Inc.) — あなたの仕事と SNS を、AI エージェントで一気通貫に。司令塔 Prism に、Instagram の Iris・LINE の Resonance・リンクの Lume がつながる、ひとつの AI エージェント OS。');

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
        minHeight: '100dvh',
        fontFamily: FONT_SANS,
        // 修正 (オーナー報告 2026-05-27 / 28):
        // overflowX: 'hidden' + overflowY: 'visible' は CSS 仕様で「両方 auto」に
        // 解釈され、iOS Safari でルート要素がスクロール容器化してフッターまで
        // たどり着けない不具合を引き起こす。
        // 解決: overflowX を 'clip' (modern alternative) に変更。clip は反対軸を
        // 触らないので、body 側の通常スクロールが完全に効く。
        overflowX: 'clip',
        overflowY: 'visible',
        // iOS Safari 慣性スクロール
        WebkitOverflowScrolling: 'touch',
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
        Prism ・ Iris ・ Resonance ・ Lume —— 四つのプロダクト、ベータ公開中
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
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
            aria-label="株式会社コア"
            className="lp-tap-link"
          >
            <CoreLogo size={36} withWordmark />
          </a>
          <nav style={{ display: 'flex', gap: '1.6rem', alignItems: 'center' }}>
            <a href="#products" style={navLink} className="lp-nav-link">プロダクト</a>
            <a href="#connect" style={navLink} className="lp-nav-link">つながり</a>
            <a href="#values" style={navLink} className="lp-nav-link">信条</a>
            <a href="#mission" style={navLink} className="lp-nav-link">理念</a>
            <a href="#journey" style={navLink} className="lp-nav-link">歩み</a>
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
          minHeight: '88dvh',
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
                  'linear-gradient(100deg,#E0F2FE,#7DD3FC,#38BDF8,#0EA5E9)',
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

          {/* 4プロダクトのチップ (一目でスイートが分かる) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.85 }}
            style={{ display: 'flex', gap: '0.55rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}
          >
            {[
              { t: 'Prism', d: '事業', c: '#a78bfa' },
              { t: 'Iris', d: 'Instagram', c: '#E1306C' },
              { t: 'Resonance', d: 'LINE', c: '#06C755' },
              { t: 'Lume', d: 'リンク', c: '#FFA42A' },
            ].map((p, i) => (
              <a
                key={i}
                href="#products"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.5rem 0.95rem', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.c}44`,
                  textDecoration: 'none',
                }}
                className="lp-tap-link"
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.c, boxShadow: `0 0 8px ${p.c}` }} />
                <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.86rem', fontWeight: 600, fontStyle: 'italic', color: '#fff' }}>{p.t}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)' }}>{p.d}</span>
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  CONNECT (一気通貫 / つながり)  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="connect"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: 'linear-gradient(180deg,#000 0%,#070713 45%,#000 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>つ&nbsp;な&nbsp;が&nbsp;り</span>
            <span style={sectionLabelSub}>ONE&nbsp;FLOW</span>
          </p>

          <motion.h2
            initial={{ y: 22 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(2rem, 5vw, 3.6rem)',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '0.04em',
              marginBottom: '1.5rem',
            }}
          >
            機能の、足し算ではない。
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#f0abfc,#a78bfa,#60a5fa,#5eead4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              掛け合わせて、ひとつの知性へ。
            </span>
          </motion.h2>

          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.98rem, 1.45vw, 1.12rem)',
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 2.2,
              maxWidth: 720,
              margin: '0 auto 3.5rem',
              fontWeight: 400,
            }}
          >
            Instagram（Iris）・LINE（Resonance）・リンク（Lume）が集めた、お客様の動きのすべて。
            それは司令塔 <strong style={{ color: '#fff', fontWeight: 600 }}>Prism</strong> にひとつに流れ込み、
            13 名の AI エージェントが次の一手まで動かします。
            <br />
            あなたの仕事も SNS も、もう別々ではありません。
          </p>

          {/* つながりの図 (司令塔 Prism + 3 つの SNS チャネル) */}
          <ConnectedSuite />

          {/* 一気通貫のシナリオ (ループ) */}
          <div style={{ marginTop: '4rem' }}>
            <p style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              marginBottom: '0.6rem',
            }}>
              A Day, Connected
            </p>
            <h3 style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.3rem, 2.4vw, 1.85rem)',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.04em',
              marginBottom: '2.5rem',
            }}>
              つながると、何が変わるか。
            </h3>

            <div
              className="lp-flow-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.85rem',
                maxWidth: 1000,
                margin: '0 auto',
                textAlign: 'left',
              }}
            >
              <FlowStep n="01" color="#FFA42A" tool="Lume" body="ファンが、あなたのどのリンクを踏んだのかが分かる。" />
              <FlowStep n="02" color="#E1306C" tool="Iris" body="その人の Instagram での反応を、AIが解析する。" />
              <FlowStep n="03" color="#06C755" tool="Resonance" body="いま響く一文を、LINE でその人だけに届ける。" />
              <FlowStep n="04" color="#a78bfa" tool="Prism" body="すべてを記録し、13 名の AI 役員が次の一手を出す。" last />
            </div>

            <p style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.95rem, 1.4vw, 1.08rem)',
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 2,
              marginTop: '2.75rem',
              fontWeight: 400,
            }}>
              四つのサービスが連携し、ひとつの流れになる。
              <br />
              <strong style={{ color: '#fff', fontWeight: 700 }}>あなたは、最後に確認するだけ。</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  VALUES (信条 / 道徳)        */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="values"
        className="lp-section-pad"
        style={{
          padding: '6rem 1.5rem',
          background: 'linear-gradient(180deg,#000 0%,#050510 60%,#000 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景の細い水平アクセント */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 720,
            height: 720,
            marginLeft: -360,
            marginTop: -360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(252,176,69,0.07) 0%, transparent 65%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>信&nbsp;条</span>
            <span style={sectionLabelSub}>PHILOSOPHY&nbsp;/&nbsp;VALUES</span>
          </p>

          {/* ゴールドの細い水平線 */}
          <div
            aria-hidden
            style={{
              width: 64,
              height: 1,
              margin: '1.5rem auto 2.5rem',
              background: 'linear-gradient(90deg, transparent, #FCB045, transparent)',
            }}
          />

          {/* メインステートメント */}
          <motion.h2
            initial={{ y: 24 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '0.05em',
              marginBottom: '2.25rem',
              color: '#fff',
            }}
          >
            変わらないものに、
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#FCB045,#FBBF24,#F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              向き合う。
            </span>
          </motion.h2>

          {/* リード文 */}
          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.98rem, 1.4vw, 1.1rem)',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 2.3,
              maxWidth: 760,
              margin: '0 auto 4.5rem',
              fontWeight: 400,
            }}
          >
            時代は加速する。テクノロジーは古びる。流行は通り過ぎる。
            <br />
            けれど、人間が人間であるかぎり、変わらないものがある。
            <br />
            人を愛し、仲間を信じ、誠実であること。
            <br />
            株式会社 CORE は、その
            <strong style={{ color: '#fff', fontWeight: 600 }}>「変わらない核」</strong>
            を中心に据える会社です。
          </p>

          {/* 3 つの柱 */}
          <div
            className="lp-values-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '2rem',
              maxWidth: 1080,
              margin: '0 auto 3.75rem',
              textAlign: 'left',
            }}
          >
            <ValuePillar
              icon={<Compass size={28} strokeWidth={1.8} color="#FCB045" />}
              accentColor="#FCB045"
              titleEn="THE UNCHANGING CORE"
              titleJa="変わらない核"
              body="時代がどれほど変わっても、人を想う気持ち、信じる勇気、誠実であろうとする意志は変わらない。私たちは、その普遍を見失わないために存在する。"
            />
            <ValuePillar
              icon={<Heart size={28} strokeWidth={1.8} color="#E1306C" />}
              accentColor="#E1306C"
              titleEn="LOVE & FELLOWSHIP"
              titleJa="人を愛し、仲間を大切に"
              body="すべての事業は、人と人の信頼の上にある。顧客もチームメンバーも、出会うすべての人を尊び、共に育つこと。それが私たちの最初の決まりごと。"
            />
            <ValuePillar
              icon={<Shield size={28} strokeWidth={1.8} color="#4ADE80" />}
              accentColor="#4ADE80"
              titleEn="INTEGRITY FIRST"
              titleJa="道徳を、利益より先に"
              body="効率や速さは尊い。けれど、誠実さの前に置いてはならない。私たちは「正しいか」を「速いか」より先に問う。時代が早くなるほど、その順序を守り続ける。"
            />
          </div>

          {/* フッターステートメント (引用デザイン) */}
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '2.25rem 1.75rem',
              borderTop: '1px solid rgba(252,176,69,0.25)',
              borderBottom: '1px solid rgba(252,176,69,0.25)',
              position: 'relative',
            }}
          >
            <p
              style={{
                fontFamily: FONT_SERIF_EN,
                fontSize: 'clamp(1.05rem, 1.8vw, 1.4rem)',
                fontStyle: 'italic',
                letterSpacing: '0.05em',
                color: '#FCB045',
                lineHeight: 1.6,
                marginBottom: '0.85rem',
                fontWeight: 500,
              }}
            >
              評判を築くには二十年かかる。それを失うのは、五分だ。
            </p>
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(0.9rem, 1.3vw, 1rem)',
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.06em',
                fontWeight: 400,
                lineHeight: 1.9,
              }}
            >
              — ウォーレン・バフェット（投資家）
            </p>
          </div>
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
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
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
              margin: '0 auto 3.5rem',
              fontWeight: 400,
            }}
          >
            私たちが追い求めるのは、流行でも、目新しさでもありません。
            <br />
            <strong style={{ color: '#fff' }}>人の本質に届くものを、静かに、確かに。</strong>
            <br />
            技術はあくまで手段であり、時代がどれほど移ろうとも、その中心にあるのは「人」である——私たちは、そう信じています。
          </p>

          {/* 3 つの約束 (具体的な指針) */}
          <div
            className="lp-promise-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              maxWidth: 880,
              margin: '0 auto',
              textAlign: 'left',
            }}
          >
            {[
              {
                accent: '#fbbf24',
                en: 'CORE 1',
                jaTitle: '時間という資産を、経営に。',
                body: '経営者の時間は、組織でもっとも希少な資産です。13 名の AI エージェントが日々の実務と情報収集を引き受け、本来向き合うべき意思決定のための時間を生み出します。',
              },
              {
                accent: '#a78bfa',
                en: 'CORE 2',
                jaTitle: '意思決定を、確信へ。',
                body: '散在する情報と文脈を即座に統合し、根拠とともに選択肢を提示します。迷いの時間を最小化し、決断の精度を高める。最終的な判断は、つねに経営者の手に委ねられます。',
              },
              {
                accent: '#60a5fa',
                en: 'CORE 3',
                jaTitle: '言葉の仕事を、自動化する。',
                body: '商談メール、議事録、提案書。時間を要する文書を、AI が草案まで仕上げます。人が担うのは、最終確認と意思の表明のみ。本質的な仕事に、集中できます。',
              },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '1.5rem 1.4rem',
                  background: `linear-gradient(160deg, ${p.accent}10, transparent 70%)`,
                  border: `1px solid ${p.accent}28`,
                  borderRadius: 14,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '0.7rem',
                  letterSpacing: '0.28em',
                  color: p.accent,
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                }}>
                  {p.en}
                </div>
                <div style={{
                  fontFamily: FONT_SERIF_JA,
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  color: '#fff',
                  marginBottom: '0.7rem',
                  letterSpacing: '0.04em',
                }}>
                  {p.jaTitle}
                </div>
                <p style={{
                  fontFamily: FONT_SERIF_JA,
                  fontSize: '0.86rem',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.95,
                  margin: 0,
                }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
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
              四つの専門。ひとつの、頭脳。
            </h2>
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
                maxWidth: 700,
                margin: '0 auto',
                lineHeight: 2,
                fontWeight: 400,
              }}
            >
              経営の司令塔 <strong style={{ color: '#fff', fontWeight: 600 }}>Prism</strong> に、
              Instagram・LINE・リンクの三つの SNS ツールがつながる。
              <br />
              あなたの仕事も SNS も、ひとつの AI エージェントの流れで動きます。
            </p>
          </div>

          {/* PRISM — 全事業の司令塔 */}
          <FeatureProduct
            brand="prism"
            badge="司令塔 ／ 全事業を一元管理"
            tagline="すべての事業を、ひとつの頭脳で。"
            taglineEn="One mind for your whole business."
            description="営業・財務・契約・議事録 —— 経営のすべてを 13 名の AI エージェントが引き受ける司令塔。Iris・Resonance・Lume が SNS で掴んだお客様の動きも、最後はここにすべて集まり、次の一手まで提案します。"
            features={[
              '七つの役割に、七人の専属エージェント',
              '商談・財務・契約をひと続きに自動化',
              '三つの SNS ツールの結果も、ここに集約',
            ]}
            accentColor="#a78bfa"
            accentGradient="linear-gradient(135deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)"
            url="/?lp=1"
          />

          {/* IRIS — Instagram を AI で */}
          <FeatureProduct
            brand="iris"
            badge="Instagram を、AI エージェントに"
            tagline="Instagram を、AIと育てる。"
            taglineEn="Run Instagram with an AI agent."
            description="投稿・分析・案件管理・DM 返信 —— Instagram 運用のすべてを AI が担います。ここで掴んだファンの反応は、そのまま Resonance の LINE 配信や、Prism の経営判断へと流れていきます。"
            features={[
              '投稿AI × Instagram 解析で戦略を自動化',
              '案件管理・DM 返信まで下書きを用意',
              '反応データを Resonance・Prism へ連携',
            ]}
            accentColor="#E1306C"
            accentGradient="linear-gradient(135deg,#FCB045,#E1306C,#833AB4)"
            url="/iris?lp=1"
            reversed
          />

          {/* RESONANCE — LINE を AI で */}
          <FeatureProduct
            brand="resonance"
            badge="LINE を、AI エージェントに"
            tagline="LINE のご縁を、AIが温める。"
            taglineEn="Run LINE with an AI agent."
            description="名簿の一人ひとりに、その人のための一文を AI が書き分け、LINE で手紙のように届ける個別配信。Iris や Lume が見つけた「いま関心のある人」へ、最適なタイミングで届きます。"
            features={[
              '一人ひとりに、AIが文面を書き分ける',
              '送る前に必ず全件を確認できる安心設計',
              'Iris・Lume の来訪データで宛先を最適化',
            ]}
            accentColor="#06C755"
            accentGradient="linear-gradient(135deg,#34D399,#06C755,#0EA5E9)"
            url="https://resonancebot-ivory.vercel.app/"
          />

          {/* LUME — すべてのリンクを束ねるハブ */}
          <FeatureProduct
            brand="lume"
            badge="すべてのリンクを、ひとつに"
            tagline="すべてのリンクを、ひとつに。"
            taglineEn="Every link, in one place."
            description="プロフィールのたった一行に、あなたのすべてのリンクを束ねるハブ。誰が、どこから、どのリンクに触れたのか —— そのクリックの流れは、Iris・Resonance・Prism すべての判断材料になります。"
            features={[
              '全リンクを、ひとつのプロフィールに集約',
              'クリックの偏りを熱で可視化するヒートマップ',
              '来訪データを Prism・Iris・Resonance へ',
            ]}
            accentColor="#FFA42A"
            accentGradient="linear-gradient(135deg,#FFD86B,#FFA42A,#FF7A18)"
            url="https://lume-deploy-five.vercel.app/"
            reversed
          />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  USE CASES (誰のための CORE か) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="who"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: 'linear-gradient(180deg,#070712 0%,#000 100%)' }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.75rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>使い方</span>
              <span style={sectionLabelSub}>WHO&nbsp;IT&apos;S&nbsp;FOR</span>
            </p>
            <h2 style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
              fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.04em', marginBottom: '1.1rem',
            }}>
              組み合わせ方は、あなた次第。
            </h2>
            <p style={{
              fontFamily: FONT_SERIF_JA, color: 'rgba(255,255,255,0.65)',
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', maxWidth: 660, margin: '0 auto', lineHeight: 2,
            }}>
              四つは、ひとつずつでも、すべて一緒でも。
              <br />
              あなたの仕事に合わせて、必要なところから始められます。
            </p>
          </div>

          <div
            className="lp-usecase-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}
          >
            <UseCaseCard
              persona="個人事業主・経営者"
              headline="経営も、SNSも、片手間に。"
              body="判断・営業・財務・事務は Prism の AI 役員 13 名へ。集客の Instagram・LINE もつなげば、現場の反応がそのまま経営判断に届きます。"
              tools={[{ t: 'Prism', c: '#a78bfa' }, { t: 'Iris', c: '#E1306C' }, { t: 'Resonance', c: '#06C755' }]}
              lead="Prism"
            />
            <UseCaseCard
              persona="インフルエンサー・クリエイター"
              headline="発信から収益まで、一本の線に。"
              body="Iris で Instagram を伸ばし、Lume で全リンクをひとつのプロフィールに束ねる。どの投稿が、どのリンクのクリックを生んだかまで見えます。"
              tools={[{ t: 'Iris', c: '#E1306C' }, { t: 'Lume', c: '#FFA42A' }]}
              lead="Iris"
            />
            <UseCaseCard
              persona="店舗・サロン・教室"
              headline="一度きりを、また会いたいへ。"
              body="Resonance が LINE のご縁を一人ひとり温め、Lume が予約や各リンクへの動線を可視化。来店につながる流れを、AI が静かに育てます。"
              tools={[{ t: 'Resonance', c: '#06C755' }, { t: 'Lume', c: '#FFA42A' }]}
              lead="Resonance"
            />
          </div>
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
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
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
            光は、分かれる。受けとめられる。灯る。
            <br />
            そして、
            <span
              style={{
                background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              響きあう。
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
            Light disperses, is received, is kindled — and resonates.
          </p>

          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
              lineHeight: 2.4,
              maxWidth: 760,
              margin: '0 auto',
              fontWeight: 400,
            }}
          >
            すべての事業を束ねる司令塔
            <strong style={{ color: '#a78bfa', fontWeight: 600 }}> Prism</strong>。
            Instagram を AI と育てる
            <strong style={{ color: '#E1306C', fontWeight: 600 }}> Iris</strong>。
            <br />
            LINE のご縁を温める
            <strong style={{ color: '#06C755', fontWeight: 600 }}> Resonance</strong>。
            すべてのリンクをひとつに束ねる
            <strong style={{ color: '#FFA42A', fontWeight: 600 }}> Lume</strong>。
            <br />
            <br />
            四つは別々の道具ではなく、ひとつの核でつながっています。
            <br />
            あなたの仕事と SNS を、ひとつの流れで動かすこと。
            <br />
            それが、<strong style={{ color: '#fff', fontWeight: 700, fontFamily: FONT_DISPLAY, letterSpacing: '0.15em' }}>CORE</strong> という会社の核。
          </p>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  JOURNEY (歩み)              */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="journey"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: 'linear-gradient(180deg,#000 0%,#040410 60%,#000 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>歩&nbsp;み</span>
              <span style={sectionLabelSub}>JOURNEY</span>
            </p>
            <motion.h2
              initial={{ y: 20 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9 }}
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.5vw, 2.65rem)',
                fontWeight: 700,
                lineHeight: 1.5,
                letterSpacing: '0.05em',
              }}
            >
              はじまりから、その先へ。
            </motion.h2>
            <p style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
              color: 'rgba(255,255,255,0.45)',
              fontStyle: 'italic',
              letterSpacing: '0.08em',
              marginTop: '0.85rem',
            }}>
              From the first day, toward what stays.
            </p>
          </div>

          {/* 縦タイムライン */}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, position: 'relative' }}>
            {/* 縦線 */}
            <div aria-hidden style={{
              position: 'absolute',
              left: 'calc(1.1rem - 1px)',
              top: 6,
              bottom: 6,
              width: 2,
              background: 'linear-gradient(180deg, rgba(252,176,69,0.4), rgba(167,139,250,0.4), rgba(96,165,250,0.4), rgba(255,255,255,0.05))',
            }} />
            {[
              {
                year: '2026',
                title: '株式会社 CORE 創業',
                body: '「すべての時代の、核となるものを」を理念に創業。事業家のための Prism を起点に、Iris・Resonance・Lume を加えた四つのプロダクトと、13 名の AI 役員で、中小経営者と個人事業主を支える土台を築きます。',
                accent: '#FCB045',
              },
              {
                year: '2026 後期',
                title: '四プロダクトの本格ローンチ',
                body: '日本の個人事業主・中小経営者へ正式リリース。使ったぶんだけ支払い、上限を超えたぶんは買い足す。気づかぬうちに高額にならない、公正な料金設計で届けます。',
                accent: '#FBBF24',
              },
              {
                year: '2027',
                title: '法人プランとチーム機能',
                body: 'メンバー招待、共有ダッシュボード、外部ツール連携を整え、5〜50 名の組織にも導入できる体験へ。経営者と現場をつなぐ「橋」を、AI が担います。',
                accent: '#A78BFA',
              },
              {
                year: '2028 —',
                title: '国境を越える「核」',
                body: '英語・韓国語・台湾繁体字に対応し、東アジアの中小経営者へ。やさしい言葉でいつでも頼れる AI 役員を、誰の手元にも届けます。',
                accent: '#60A5FA',
              },
            ].map((m, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  paddingLeft: 0,
                  marginBottom: '2.5rem',
                  alignItems: 'flex-start',
                  position: 'relative',
                }}
              >
                {/* ドット (核を象る同心円) */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.accent} 0%, ${m.accent}22 70%, transparent 72%)`,
                  border: `1px solid ${m.accent}66`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 0 18px ${m.accent}44, 0 0 0 4px #000`,
                  position: 'relative',
                  zIndex: 2,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: `0 0 8px ${m.accent}`,
                  }} />
                </div>
                <div style={{ flex: 1, paddingTop: '0.2rem' }}>
                  <div style={{
                    fontFamily: FONT_SERIF_EN,
                    fontSize: '0.78rem',
                    letterSpacing: '0.22em',
                    color: m.accent,
                    fontWeight: 700,
                    marginBottom: '0.4rem',
                  }}>
                    {m.year}
                  </div>
                  <div style={{
                    fontFamily: FONT_SERIF_JA,
                    fontSize: 'clamp(1.15rem, 1.85vw, 1.4rem)',
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '0.6rem',
                    letterSpacing: '0.04em',
                  }}>
                    {m.title}
                  </div>
                  <p style={{
                    fontFamily: FONT_SERIF_JA,
                    fontSize: 'clamp(0.9rem, 1.3vw, 1rem)',
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.95,
                    margin: 0,
                  }}>
                    {m.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>

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

          {/* AI 役員 13 名 — 「これがチームです」 */}
          <div style={{ marginBottom: '3.5rem' }}>
            <p style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: '0.6rem',
            }}>
              The 13 AI Officers
            </p>
            <h3 style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.3rem, 2.2vw, 1.7rem)',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '0.6rem',
              color: '#fff',
              letterSpacing: '0.04em',
            }}>
              AI 役員 13 名が、あなたを支えます
            </h3>
            <p style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              lineHeight: 1.85,
              maxWidth: 640,
              margin: '0 auto 2rem',
            }}>
              四つのプロダクトすべてに、13 名の専門エージェントが控えています。経営、営業、財務、創造、データ、人材、法務 —— 経営者ひとりの頭脳に、13 の参謀が並走する設計です。
            </p>
            <div
              className="lp-officer-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                gap: '0.6rem',
                maxWidth: 720,
                margin: '0 auto',
              }}
            >
              {[
                { t: 'CEO', d: '経営戦略' },
                { t: 'CTO', d: '技術' },
                { t: 'CPO', d: '製品' },
                { t: 'CDO', d: 'デザイン' },
                { t: 'CMO', d: 'マーケ' },
                { t: 'CSO', d: '営業' },
                { t: 'CFO', d: '財務' },
                { t: 'COO', d: '運営' },
                { t: 'CDS', d: 'データ' },
                { t: 'CLO', d: '法務' },
                { t: 'UIE', d: 'UI' },
                { t: 'UXE', d: 'UX' },
                { t: 'QAE', d: '品質' },
              ].map((o, i) => (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem 0.4rem',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  textAlign: 'center',
                  gap: 5,
                }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', letterSpacing: '0.14em', fontFamily: FONT_SERIF_EN }}>{o.t}</span>
                  <span aria-hidden style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.25)' }} />
                  <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.55)', fontFamily: FONT_SERIF_JA, letterSpacing: '0.04em' }}>{o.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 私たちの文化 — 3 つの約束 */}
          <div style={{ marginBottom: '3.5rem' }}>
            <p style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: '0.6rem',
            }}>
              Our Culture
            </p>
            <h3 style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.3rem, 2.2vw, 1.7rem)',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '2rem',
              color: '#fff',
              letterSpacing: '0.04em',
            }}>
              わたしたちが守る 3 つの約束
            </h3>
            <div
              className="lp-culture-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {[
                {
                  icon: <BadgeCheck size={24} strokeWidth={1.8} color="#FCB045" />,
                  accent: '#FCB045',
                  title: '偽りの数字は、載せない',
                  body: 'まだ実績がないものには「—」と記す。架空の数字や水増しした成果は、信頼を一瞬で失わせる最大の不誠実だと考えています。',
                },
                {
                  icon: <MessagesSquare size={24} strokeWidth={1.8} color="#60A5FA" />,
                  accent: '#60A5FA',
                  title: 'やさしい言葉で、語る',
                  body: '専門用語や横文字は、できるかぎり日常の言葉に言い換える。「初心者のため」ではなく、「すべての人のため」に。',
                },
                {
                  icon: <Scale size={24} strokeWidth={1.8} color="#4ADE80" />,
                  accent: '#4ADE80',
                  title: '使ったぶんだけ、いただく',
                  body: '月額には上限を設け、超えたぶんは買い足す方式。知らぬ間に高額にならない、公正な料金のかたちを守り続けます。',
                },
              ].map((c, i) => (
                <div key={i} style={{
                  padding: '1.5rem 1.4rem',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `radial-gradient(circle, ${c.accent}22 0%, transparent 70%)`,
                    border: `1px solid ${c.accent}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '0.85rem',
                  }} aria-hidden>{c.icon}</div>
                  <div style={{
                    fontFamily: FONT_SERIF_JA,
                    fontWeight: 700,
                    fontSize: '1.02rem',
                    color: '#fff',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.03em',
                  }}>{c.title}</div>
                  <p style={{
                    fontFamily: FONT_SERIF_JA,
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.85,
                    margin: 0,
                  }}>{c.body}</p>
                </div>
              ))}
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
            <InfoRow label="提供サービス" subLabel="Products"   value="CORE Prism（事業家向け）／ CORE Iris（インフルエンサー向け）／ CORE Resonance（店舗・サロン・教室向け）／ CORE Lume（クリエイター向け）" isLast />
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
        <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>お問い合わせ</span>
            <span style={sectionLabelSub}>CONTACT</span>
          </p>
          <h2
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(1.95rem, 3.8vw, 2.85rem)',
              fontWeight: 700,
              marginBottom: '1.25rem',
              lineHeight: 1.5,
              letterSpacing: '0.05em',
              textAlign: 'center',
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
              marginBottom: '3rem',
              fontWeight: 400,
              textAlign: 'center',
            }}
          >
            一通一通、丁寧にお返事します。
            <br />
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              通常 24 時間以内にご返信 (土日祝は翌営業日)
            </span>
          </p>

          {/* 3 つの窓口 */}
          <div
            className="lp-contact-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              marginBottom: '2.5rem',
            }}
          >
            {[
              { icon: '🤝', label: '法人 / 導入相談', desc: 'チーム導入・請求書払い・カスタム要件', subject: '法人導入の相談' },
              { icon: '📰', label: '取材 / プレス', desc: 'メディア掲載・登壇依頼・資料請求', subject: '取材依頼' },
              { icon: '💼', label: '採用 / 業務委託', desc: 'エンジニア・デザイナー・パートナー', subject: '採用に関心があります' },
            ].map((c, i) => (
              <a
                key={i}
                href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(c.subject)}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1.5rem 1.25rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  textDecoration: 'none',
                  color: 'inherit',
                  textAlign: 'center',
                  transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(167,139,250,0.10)';
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.35)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{c.icon}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontWeight: 600, fontSize: '0.95rem', color: '#fff', letterSpacing: '0.02em' }}>{c.label}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{c.desc}</span>
              </a>
            ))}
          </div>

          {/* 直接連絡 */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em', marginBottom: '0.85rem', fontFamily: FONT_SERIF_EN, textTransform: 'uppercase' }}>
              Direct
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
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: '1.25rem', fontFamily: FONT_SERIF_JA }}>
              よくある質問は <a href="/faq" style={{ color: 'rgba(167,139,250,0.85)', textDecoration: 'underline', textUnderlineOffset: 3 }}>FAQ ページ</a> で先にご確認いただけます。
            </p>
          </div>
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
            <a href="/?lp=1" style={footLink} className="lp-tap-link">CORE Prism</a>
            <a href="/iris?lp=1" style={footLink} className="lp-tap-link">CORE Iris</a>
            <a href="https://resonancebot-ivory.vercel.app/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Resonance</a>
            <a href="https://lume-deploy-five.vercel.app/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Lume</a>
          </div>
          <div>
            <p style={footHead}>会社</p>
            <a href="#mission" style={footLink} className="lp-tap-link">理念</a>
            <a href="#about" style={footLink} className="lp-tap-link">会社概要</a>
            <a href="#contact" style={footLink} className="lp-tap-link">お問い合わせ</a>
          </div>
          <div>
            <p style={footHead}>連絡先</p>
            <a href={`mailto:${COMPANY.email}`} style={footLink} className="lp-tap-link">{COMPANY.email}</a>
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
          <div>
            <p style={footHead}>法務</p>
            {([
              { k: 'tokushou', label: '特定商取引法に基づく表記' },
              { k: 'terms', label: '利用規約' },
              { k: 'privacy', label: 'プライバシーポリシー' },
            ] as { k: LegalKind; label: string }[]).map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setLegalKind(k)}
                style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                className="lp-tap-link"
              >
                {label}
              </button>
            ))}
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
      {legalKind && (
        <LegalModal key={`legal-${legalKind}`} kind={legalKind} onClose={() => setLegalKind(null)} />
      )}
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
  brand: 'prism' | 'iris' | 'resonance' | 'lume';
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
  const Logo =
    brand === 'iris' ? IrisLogo :
    brand === 'resonance' ? ResonanceLogo :
    brand === 'lume' ? LumeLogo :
    PrismLogo;
  const productName =
    brand === 'iris' ? 'CORE Iris' :
    brand === 'resonance' ? 'CORE Resonance' :
    brand === 'lume' ? 'CORE Lume' :
    'CORE Prism';

  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
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
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(1.5rem, 3vw, 2.25rem)',
        alignItems: 'center',
        textAlign: 'center',
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
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 680, width: '100%', margin: '0 auto' }}>
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
          {...(url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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

// ───────────── 価値観の柱 ─────────────
function ValuePillar({
  icon,
  accentColor,
  titleEn,
  titleJa,
  body,
}: {
  icon: React.ReactNode;
  accentColor: string;
  titleEn: string;
  titleJa: string;
  body: string;
}) {
  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      style={{
        padding: '2rem 1.75rem',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
      }}
      className="lp-value-pillar"
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          border: `1px solid ${accentColor}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '0.7rem',
            letterSpacing: '0.28em',
            color: accentColor,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {titleEn}
        </p>
        <p
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(1.05rem, 1.5vw, 1.18rem)',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1.5,
          }}
        >
          {titleJa}
        </p>
      </div>
      <p
        style={{
          fontFamily: FONT_SERIF_JA,
          fontSize: 'clamp(0.88rem, 1.15vw, 0.95rem)',
          color: 'rgba(255,255,255,0.72)',
          lineHeight: 2,
          fontWeight: 400,
        }}
      >
        {body}
      </p>
    </motion.div>
  );
}

// ============================================================
//  ConnectedSuite — 司令塔 Prism + 3 つの SNS チャネルのつながり図
// ============================================================
function ConnectedSuite() {
  // 衛星ノード（正方形コンテナ内の % 座標。左右対称＝Prism を完全中央に）
  const sats = [
    { key: 'iris', Logo: IrisLogo, name: 'Iris', role: 'Instagram', color: '#E1306C', x: 50, y: 9 },
    { key: 'resonance', Logo: ResonanceLogo, name: 'Resonance', role: 'LINE', color: '#06C755', x: 14, y: 86 },
    { key: 'lume', Logo: LumeLogo, name: 'Lume', role: 'リンク', color: '#FFA42A', x: 86, y: 86 },
  ];

  // 共通: 衛星カード（角丸スクエア・発光）
  const SatCard = ({ s, size = 46 }: { s: typeof sats[number]; size?: number }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      padding: '0.95rem 0.7rem 0.8rem', width: 116,
      background: `radial-gradient(circle at 50% 30%, ${s.color}1f, rgba(8,8,18,0.92))`,
      border: `1px solid ${s.color}66`, borderRadius: 18,
      boxShadow: `0 0 26px ${s.color}3a, inset 0 0 18px ${s.color}14`,
      backdropFilter: 'blur(6px)',
    }}>
      <s.Logo size={size} withWordmark={false} />
      <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.84rem', color: '#fff', fontWeight: 600, fontStyle: 'italic' }}>{s.name}</span>
      <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.64rem', color: s.color, fontWeight: 700, letterSpacing: '0.08em' }}>{s.role}</span>
    </div>
  );

  const PrismCard = ({ size = 60 }: { size?: number }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      padding: '1.25rem 1.35rem 1.05rem', width: 144,
      background: 'radial-gradient(circle at 50% 32%, rgba(167,139,250,0.28), rgba(8,8,18,0.94))',
      border: '1px solid rgba(167,139,250,0.6)', borderRadius: 22,
      boxShadow: '0 0 52px rgba(167,139,250,0.42), inset 0 0 26px rgba(167,139,250,0.14)',
    }}>
      <PrismLogo size={size} withWordmark={false} />
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>PRISM</span>
      <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: '#fff', fontWeight: 700, letterSpacing: '0.08em' }}>司令塔</span>
    </div>
  );

  return (
    <div className="lp-connect-wrap">
      {/* ── HUB (デスクトップ / タブレット)：Prism を完全中央に ── */}
      <div className="lp-connect-hub" style={{ position: 'relative', width: 'min(90vw, 560px)', aspectRatio: '1 / 1', margin: '0 auto' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {sats.map(s => (
            <line key={s.key} x1="50" y1="50" x2={s.x} y2={s.y} stroke={s.color}
              strokeWidth="0.5" strokeOpacity="0.6" strokeDasharray="1.6 1.8" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="7" to="0" dur="1.4s" repeatCount="indefinite" />
            </line>
          ))}
        </svg>
        <motion.div
          animate={{ scale: [1, 1.045, 1] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', left: '50%', top: '50%', x: '-50%', y: '-50%', zIndex: 3 }}>
          <PrismCard />
        </motion.div>
        {sats.map(s => (
          <div key={s.key} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)', zIndex: 2 }}>
            <SatCard s={s} />
          </div>
        ))}
      </div>

      {/* ── STACK (モバイル)：縦に Prism → 3チャネル ── */}
      <div className="lp-connect-stack" aria-hidden>
        <PrismCard size={52} />
        <span className="lp-connect-branch" />
        <div className="lp-connect-sats">
          {sats.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem',
              padding: '0.7rem 0.9rem', width: '100%',
              background: `radial-gradient(circle at 0% 50%, ${s.color}1c, rgba(8,8,18,0.9))`,
              border: `1px solid ${s.color}55`, borderRadius: 16 }}>
              <s.Logo size={38} withWordmark={false} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '1rem', color: '#fff', fontWeight: 600, fontStyle: 'italic' }}>{s.name}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: s.color, fontWeight: 700, letterSpacing: '0.06em' }}>{s.role}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────── 一気通貫フローの 1 ステップ ─────────────
function FlowStep({ n, color, tool, body, last }: { n: string; color: string; tool: string; body: string; last?: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '1.4rem 1.2rem',
        background: `linear-gradient(165deg, ${color}14, transparent 75%)`,
        border: `1px solid ${color}33`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.7rem' }}>
        <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.74rem', letterSpacing: '0.2em', color, fontWeight: 700 }}>{n}</span>
        <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.98rem', fontStyle: 'italic', fontWeight: 600, color: '#fff' }}>{tool}</span>
        {!last && <span aria-hidden style={{ marginLeft: 'auto', color: `${color}cc`, fontSize: '1rem' }}>→</span>}
      </div>
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

// ───────────── ユースケース・カード ─────────────
function UseCaseCard({ persona, headline, body, tools, lead }: {
  persona: string; headline: string; body: string;
  tools: { t: string; c: string }[]; lead: string;
}) {
  const leadColor = tools.find(t => t.t === lead)?.c || tools[0].c;
  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      className="lp-usecase-card"
      style={{
        padding: '2rem 1.75rem',
        background: `linear-gradient(170deg, ${leadColor}12, rgba(255,255,255,0.015) 70%)`,
        border: `1px solid ${leadColor}33`,
        borderRadius: 18,
        display: 'flex', flexDirection: 'column', gap: '1.1rem',
      }}
    >
      <span style={{
        alignSelf: 'flex-start', fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.08em', padding: '0.35rem 0.85rem', borderRadius: 999,
        background: `${leadColor}22`, border: `1px solid ${leadColor}55`, color: leadColor,
      }}>
        {persona}
      </span>
      <h3 style={{
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', fontWeight: 700,
        color: '#fff', letterSpacing: '0.03em', lineHeight: 1.5, margin: 0,
      }}>
        {headline}
      </h3>
      <p style={{
        fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: 'rgba(255,255,255,0.68)',
        lineHeight: 2, margin: 0, flex: 1,
      }}>
        {body}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
        {tools.map((t, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontFamily: FONT_SERIF_EN, fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600, color: '#fff',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.c, boxShadow: `0 0 7px ${t.c}` }} />
            {t.t}
            {i < tools.length - 1 && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '0.3rem', fontStyle: 'normal' }}>＋</span>}
          </span>
        ))}
      </div>
    </motion.div>
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
  padding: '0.75rem 1.25rem',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 999,
  letterSpacing: '0.1em',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
};
const ctaHero: React.CSSProperties = {
  display: 'inline-block',
  // ロゴアイコンと同じスカイブルー基調（虹色をやめて上品に）
  background:
    'linear-gradient(135deg,#7DD3FC,#38BDF8,#0EA5E9)',
  backgroundSize: '200% 100%',
  color: '#04293A',
  padding: '1.1rem 2.4rem',
  borderRadius: 14,
  fontFamily: FONT_SERIF_JA,
  fontSize: '1rem',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 12px 36px rgba(56,189,248,0.40)',
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
