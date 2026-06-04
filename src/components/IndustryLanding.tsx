// ============================================================
// IndustryLanding — 業界別 LP 6 種の共通テンプレート
//
// オーナー指示 (2026-06-03):
//   業界の悩みから入り、数字で ROI、7 日無料・カード登録なし へ
//   骨格: Hero / Pain / Solution / Proof / Pricing / FAQ / CTA
//
// URL: /lp/<slug> → INDUSTRIES[slug] を読み込んで描画
// ============================================================
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { INDUSTRIES, type IndustryConfig } from '../lp/industries';
import IndustryWeekTimeline from './IndustryWeekTimeline';
import IndustryVideoSection from './IndustryVideoSection';
import OnboardingVideoEmbed from './OnboardingVideoEmbed';

const FONT_SERIF_JA = '"Noto Serif JP", "Yu Mincho", serif';
const FONT_SERIF_EN = '"Cinzel", "Cormorant Garamond", serif';
const FONT_SANS = '"Inter", system-ui, -apple-system, sans-serif';

interface Props {
  slug: string;
}

export default function IndustryLanding({ slug }: Props) {
  const config = INDUSTRIES[slug];

  useEffect(() => {
    if (!config) return;
    document.title = config.pageTitle;

    // ── SEO + OG meta タグを動的に注入 (オーナー指示 2026-06-03) ──
    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const [attr, val] = selector.replace(/[\[\]"]/g, '').split('=');
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    // KKKK (2026-06-04): 業界別 OG 画像 (IIII で生成した /og/industry-<slug>.png) を優先
    //   config.metaOgImage > /og/industry-<slug>.png > /og/<slug>.png (旧)
    const ogPath = config.metaOgImage
      || `/og/industry-${config.slug}.png`;
    const ogImageUrl = ogPath.startsWith('http')
      ? ogPath
      : `https://core-prism-app.vercel.app${ogPath}`;
    const pageUrl = `https://core-prism-app.vercel.app/lp/${config.slug}`;

    setMeta('meta[name="description"]', config.metaDescription);
    setMeta('meta[property="og:title"]', config.pageTitle);
    setMeta('meta[property="og:description"]', config.metaDescription);
    setMeta('meta[property="og:image"]', ogImageUrl);
    setMeta('meta[property="og:url"]', pageUrl);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[name="twitter:card"]', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', config.pageTitle);
    setMeta('meta[name="twitter:description"]', config.metaDescription);
    setMeta('meta[name="twitter:image"]', ogImageUrl);
    // KKKK (2026-06-04): og:image:width / height + alt も明示 (FB/X クローラ用)
    setMeta('meta[property="og:image:width"]', '1200');
    setMeta('meta[property="og:image:height"]', '630');
    setMeta('meta[property="og:image:alt"]', `${config.industryLabel} 向け — CORE Prism / Iris の業界別 LP`);
    setMeta('meta[name="twitter:image:alt"]', `${config.industryLabel} 向け — CORE Prism / Iris の業界別 LP`);

    // YYYYY (2026-06-04): JSON-LD (構造化データ) を 動的注入 — Google リッチカード狙い
    const SCRIPT_ID = `jsonld-industry-${config.slug}`;
    let scriptEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = SCRIPT_ID;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CORE Prism', item: 'https://core-prism-app.vercel.app/' },
        { '@type': 'ListItem', position: 2, name: '業界 LP', item: 'https://core-prism-app.vercel.app/' },
        { '@type': 'ListItem', position: 3, name: config.industryLabel, item: pageUrl },
      ],
    };
    const organization = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '株式会社CORE',
      url: 'https://core-prism-app.vercel.app/',
      logo: 'https://core-prism-app.vercel.app/og-prism-v3.png',
      sameAs: ['https://x.com/'],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'gauche.cellist1201@gmail.com',
      },
    };
    const videoObject = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'CORE Prism — 75 秒 で わかる',
      description: '5 シーン (LP → 料金 → ダッシュボード → AI 役員チャット → Iris) を 75 秒 にまとめた 公式オンボ動画。',
      thumbnailUrl: ['https://core-prism-app.vercel.app/onboarding-poster.jpg'],
      contentUrl: 'https://core-prism-app.vercel.app/onboarding-video.mp4',
      uploadDate: '2026-06-04',
      duration: 'PT1M15S',
    };
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: config.pageTitle,
      description: config.metaDescription,
      brand: { '@type': 'Brand', name: 'CORE Prism' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'JPY',
        price: '3000',
        url: 'https://core-prism-app.vercel.app/pricing',
        availability: 'https://schema.org/InStock',
      },
    };
    scriptEl.text = JSON.stringify([breadcrumb, organization, videoObject, product]);
  }, [config]);

  if (!config) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080812', color: '#fff', fontFamily: FONT_SANS }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 24, marginBottom: 16 }}>業界 LP が見つかりません</h1>
          <a href="/" style={{ color: '#FBBF24' }}>トップに戻る</a>
        </div>
      </div>
    );
  }

  // ブランドアクセント
  const accentLeft = config.brandHint === 'iris' ? '#E1306C' : '#9333EA';
  const accentRight = config.accentRight;

  return (
    <div style={{
      background: '#080812',
      color: '#fff',
      minHeight: '100dvh',
      fontFamily: FONT_SANS,
      overflowX: 'clip',
    }}>
      <Hero config={config} accentLeft={accentLeft} accentRight={accentRight} />
      {/* NNNNN (2026-06-04): /onboarding-video.mp4 が存在する時のみ 表示 (onError で 自動非表示) */}
      <OnboardingVideoEmbed accentLeft={accentLeft} accentRight={accentRight} />
      <Pain config={config} accentLeft={accentLeft} />
      <Solution config={config} accentLeft={accentLeft} accentRight={accentRight} />
      <Proof config={config} accentLeft={accentLeft} accentRight={accentRight} />
      {/* DDDD (2026-06-04): YouTube 説明動画 (config.video があれば表示) */}
      <IndustryVideoSection config={config} accentLeft={accentLeft} accentRight={accentRight} />
      <Cases config={config} accentLeft={accentLeft} accentRight={accentRight} />
      {/* WWW (2026-06-04): 導入後の典型 1 週間 (Hero と比較表の間) */}
      <IndustryWeekTimeline accent={accentLeft} />
      <Comparison config={config} accentLeft={accentLeft} accentRight={accentRight} />
      <Pricing config={config} accentLeft={accentLeft} accentRight={accentRight} />
      <Faq config={config} accentLeft={accentLeft} />
      <FinalCta config={config} accentLeft={accentLeft} accentRight={accentRight} />
      <Footer />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HERO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Hero({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  return (
    <section style={{
      position: 'relative',
      padding: '6rem 1.5rem 5rem',
      textAlign: 'center',
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 720, height: 720, borderRadius: '50%',
        background: `radial-gradient(circle, ${accentLeft}33 0%, transparent 60%)`,
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: `${accentLeft}22`,
            border: `1px solid ${accentLeft}55`,
            fontFamily: FONT_SERIF_EN,
            fontSize: 11, letterSpacing: '0.25em',
            color: accentLeft, fontWeight: 700,
            marginBottom: '2rem',
          }}
        >
          {config.industryLabel}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          style={{
            fontFamily: FONT_SERIF_JA,
            // 業界 LP のキャッチが iPhone (390px) で見切れる問題を修正
            // (オーナー報告 2026-06-03 ダブルチェック: /lp/solo 等)
            fontSize: 'clamp(1.3rem, 4.8vw, 3.4rem)',
            fontWeight: 700,
            lineHeight: 1.4,
            letterSpacing: '0.01em',
            marginBottom: '1.5rem',
            whiteSpace: 'pre-line',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            maxWidth: '94vw',
            marginLeft: 'auto', marginRight: 'auto',
          }}
        >
          {config.heroMain.split('\n').map((line, i) => (
            <span key={i} style={{ display: 'block' }}>
              {line.includes('AI') || line.includes('1/7') ? (
                <span style={{
                  background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{line}</span>
              ) : line}
            </span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.95,
            marginBottom: '2.5rem',
            maxWidth: 680,
            marginLeft: 'auto', marginRight: 'auto',
          }}
        >
          {config.heroSub}
        </motion.p>

        {/* 巨大数字 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            borderRadius: 18,
            background: `linear-gradient(135deg, ${accentLeft}15, ${accentRight}15)`,
            border: `1px solid ${accentRight}55`,
            marginBottom: '2rem',
          }}
        >
          <div style={{ fontSize: 11, color: accentRight, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 4 }}>
            {config.heroHeroNumber.label}
          </div>
          <div style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, color: '#fff' }}>
            {config.heroHeroNumber.value}
          </div>
        </motion.div>

        {/* TTTTT (2026-06-04): 「公式 動画 75 秒」 バッジ — #video アンカーで OnboardingVideoEmbed へ */}
        <a
          href="#video"
          aria-label="75 秒 で わかる 公式 動画 を 再生"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999,
            background: `linear-gradient(135deg, ${accentLeft}22, ${accentRight}22)`,
            border: `1px solid ${accentRight}66`,
            color: '#fff', textDecoration: 'none',
            fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
            marginTop: 16, marginBottom: 16,
            boxShadow: `0 8px 18px ${accentRight}22`,
            transition: 'transform 0.18s, box-shadow 0.18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 26px ${accentRight}44`; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 8px 18px ${accentRight}22`; }}
        >
          <span aria-hidden="true" style={{
            width: 24, height: 24, borderRadius: 12,
            background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, lineHeight: 1,
          }}>▶</span>
          75 秒 で わかる
        </a>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <a href="#demo" style={ctaPrimary(accentLeft, accentRight)}>
            7 日間 無料で試す →
          </a>
          <a href="#pricing" style={ctaGhost}>
            プランを見る
          </a>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>
          カード登録なし ・ いつでも解約可
        </p>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAIN — 業界の生々しい悩み 4 つ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Pain({ config, accentLeft }: { config: IndustryConfig; accentLeft: string }) {
  return (
    <section style={{ padding: '5rem 1.5rem', background: '#080812' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={sectionTitle}>こんな悩み、ありませんか?</h2>
        <p style={sectionLead}>
          多くの{getPainAudience(config.slug)}が抱えている、実際の声です。
        </p>
        <div style={{
          marginTop: '3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}>
          {config.pain.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              style={{
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${accentLeft}33`,
                borderRadius: 14,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{p.emoji}</span>
              <p style={{ fontSize: 14.5, color: '#fff', lineHeight: 1.7, margin: 0, fontFamily: FONT_SERIF_JA }}>
                {p.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getPainAudience(slug: string): string {
  return ({
    'sme': '中小企業の社長',
    'realestate-finance': '不動産・金融営業の方',
    'consulting': 'コンサル・士業の方',
    'solo': '個人事業主・一人社長',
    'creator': 'クリエイター',
    'freelance-pro': '上位フリーランス',
  } as Record<string, string>)[slug] || 'お客様';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOLUTION — AI が肩代わりすること 3 つ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Solution({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  const totalHours = config.features.reduce((sum, f) => sum + (f.savesHours || 0), 0);
  return (
    <section style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          fontFamily: FONT_SERIF_EN,
          fontSize: 11, letterSpacing: '0.3em', color: accentRight,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          SOLUTION
        </div>
        <h2 style={sectionTitle}>AI が代わりにやること</h2>
        <p style={sectionLead}>
          あなたは「確認」と「送信」だけ。下書きはぜんぶ AI が作ります。
        </p>
        <div style={{
          marginTop: '3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {config.features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              style={{
                padding: '2rem 1.5rem',
                background: `linear-gradient(180deg, ${accentLeft}10, transparent)`,
                border: `1px solid ${accentLeft}33`,
                borderRadius: 18,
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: 14,
                background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: '1.25rem',
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 18, fontWeight: 800, lineHeight: 1.5, marginBottom: 12,
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, margin: 0,
                fontFamily: FONT_SERIF_JA,
              }}>
                {f.body}
              </p>
              {f.savesHours && (
                <div style={{
                  marginTop: 16,
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: `${accentRight}22`,
                  color: accentRight,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                }}>
                  月 約 {f.savesHours} 時間 節約
                </div>
              )}
            </motion.div>
          ))}
        </div>
        {totalHours > 0 && (
          <div style={{
            marginTop: '3rem',
            textAlign: 'center',
            padding: '1.5rem',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accentLeft}15, ${accentRight}15)`,
            border: `1px solid ${accentRight}55`,
            maxWidth: 600,
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              合計
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: accentRight }}>
              月 約 {totalHours} 時間
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              があなたに戻ってきます
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROOF — 数字で示す ROI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Proof({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  return (
    <section style={{ padding: '5rem 1.5rem', background: '#080812' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          fontFamily: FONT_SERIF_EN,
          fontSize: 11, letterSpacing: '0.3em', color: accentLeft,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          PROOF
        </div>
        <h2 style={sectionTitle}>数字で見る効果</h2>
        <div style={{
          marginTop: '3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
        }}>
          {config.proofStats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                padding: '2rem 1.5rem',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${accentRight}44`,
                borderRadius: 18,
                textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900,
                background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: 8,
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
                fontFamily: FONT_SERIF_JA, fontWeight: 600,
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: 10,
                color: s.caveat === 'owner-experience' ? '#34D399' : s.caveat === 'actual' ? '#FBBF24' : 'rgba(255,255,255,0.4)',
                marginTop: 10, fontWeight: 700, letterSpacing: '0.1em',
              }}>
                {s.caveat === 'owner-experience' ? '★ オーナー実体験' : s.caveat === 'actual' ? '✓ 実値' : '※ 想定値'}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CASES — 業界別 導入事例 (※ 模擬・想定)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Cases({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  if (!config.cases || config.cases.length === 0) return null;
  return (
    <section style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{
          fontFamily: FONT_SERIF_EN,
          fontSize: 11, letterSpacing: '0.3em', color: accentLeft,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          USE CASES
        </div>
        <h2 style={sectionTitle}>こんな風に使われています</h2>
        <p style={sectionLead}>※ 想定の使い方 / 効果です。実利用での効果は環境により変動します。</p>
        <div style={{
          marginTop: '3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '1.25rem',
        }}>
          {config.cases.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${accentLeft}33`,
                borderRadius: 16,
                position: 'relative',
              }}
            >
              <div style={{
                fontSize: 10, letterSpacing: '0.2em', color: accentRight,
                fontWeight: 800, marginBottom: 10,
              }}>
                CASE 0{i + 1}
              </div>
              <p style={{
                fontFamily: FONT_SERIF_JA, fontSize: 13.5, fontWeight: 700,
                color: '#fff', lineHeight: 1.6, marginBottom: 14,
                paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                {c.persona}
              </p>
              <div style={{
                fontSize: 11, color: accentLeft, fontWeight: 700,
                letterSpacing: '0.1em', marginBottom: 6,
              }}>使い方</div>
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7,
                marginBottom: 14, fontFamily: FONT_SERIF_JA,
              }}>
                {c.usage}
              </p>
              <div style={{
                fontSize: 11, color: accentRight, fontWeight: 700,
                letterSpacing: '0.1em', marginBottom: 6,
              }}>効果</div>
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7,
                marginBottom: 16, fontFamily: FONT_SERIF_JA, fontWeight: 600,
              }}>
                {c.result}
              </p>
              <div style={{
                padding: '10px 12px',
                background: `${accentLeft}10`,
                borderLeft: `2px solid ${accentLeft}`,
                borderRadius: '0 8px 8px 0',
                fontSize: 12, color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.7, fontStyle: 'italic',
                fontFamily: FONT_SERIF_JA,
              }}>
                {c.quote}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPARISON — 他の選択肢との比較
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Comparison({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  // 業界別に「自分でやる」「外注」「他 SaaS」のスコア
  const isB2B = config.recommendedPlan.startsWith('v2-btoB');
  const monthlyCost = ({
    'v2-btoC-light': 3000, 'v2-btoC-standard': 5000, 'v2-btoC-pro': 15000,
    'v2-btoB-entry': 20000, 'v2-btoB-standard': 30000, 'v2-btoB-pro': 50000,
  } as Record<string, number>)[config.recommendedPlan] || 30000;

  const altColumn = isB2B ? 'コンサル外注' : '社員雇用 (1 人)';
  const altCost = isB2B ? '月 ¥200 万〜' : '月 ¥30 万〜';

  const rows = [
    { label: '月額コスト', core: `月 ¥${monthlyCost.toLocaleString('ja-JP')}`, alt: altCost, self: '¥0', other: '月 ¥10,000〜' },
    { label: '稼働時間', core: '24h / 365 日', alt: '営業時間のみ', self: 'あなたの時間に依存', other: '稼働時間内' },
    { label: '専門範囲', core: '13 領域 (CEO〜CHR)', alt: '1 領域', self: 'あなたの得意のみ', other: '1 機能' },
    { label: '反応速度', core: '10 秒〜数分', alt: '数日〜数週間', self: 'いまの心の状態次第', other: '1〜数時間' },
    { label: 'スケール', core: '同時 13 タスク', alt: '案件数で線形に増える', self: '体力の限界', other: 'プランで段階' },
    { label: '導入時間', core: '7 日間 無料 + 5 分', alt: '商談 → 契約 → 開始 で数週間', self: '即日', other: '数時間〜数日' },
  ];

  return (
    <section id="comparison" aria-labelledby="comparison-heading" style={{ padding: '5rem 1.5rem', background: '#080812' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{
          fontFamily: FONT_SERIF_EN,
          fontSize: 11, letterSpacing: '0.3em', color: accentRight,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          COMPARISON
        </div>
        <h2 id="comparison-heading" style={sectionTitle}>他の選択肢と何が違うか</h2>
        <p style={sectionLead}>「外注」「雇用」「自分で全部」と比べたときの位置づけ</p>

        <div style={{ marginTop: '2.5rem', overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 13, color: 'rgba(255,255,255,0.85)',
            minWidth: 640,
          }}>
            <caption style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
              CORE Prism / Iris と {altColumn} / {isB2B ? '社員雇用' : '自分でやる'} / 他 SaaS の機能・価格 比較表
            </caption>
            <thead>
              <tr>
                <th scope="col" style={thStyle()}></th>
                <th scope="col" style={thStyle(accentLeft, accentRight, true)}>★ CORE</th>
                <th scope="col" style={thStyle()}>{altColumn}</th>
                <th scope="col" style={thStyle()}>{isB2B ? '社員雇用' : '自分でやる'}</th>
                <th scope="col" style={thStyle()}>他 SaaS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row" style={tdStyle(true)}>{r.label}</th>
                  <td style={tdStyle(false, accentLeft)}>
                    <strong style={{ color: '#fff' }}>{r.core}</strong>
                  </td>
                  <td style={tdStyle()}>{r.alt}</td>
                  <td style={tdStyle()}>{r.self}</td>
                  <td style={tdStyle()}>{r.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center',
          marginTop: 12, lineHeight: 1.7,
        }}>
          ※ 一般的な相場感の比較。実際のコスト・効果は使い方により変動します。
        </p>
      </div>
    </section>
  );
}

function thStyle(left?: string, right?: string, isCore?: boolean): React.CSSProperties {
  return {
    padding: '12px 10px',
    textAlign: 'left',
    fontWeight: 800,
    fontSize: 11.5,
    letterSpacing: '0.05em',
    color: isCore ? '#fff' : 'rgba(255,255,255,0.55)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: isCore && left ? `linear-gradient(180deg, ${left}25, transparent)` : 'transparent',
    whiteSpace: 'nowrap',
    ...(right ? { boxShadow: `inset 0 -2px 0 ${right}` } : {}),
  };
}
function tdStyle(isLabel?: boolean, accent?: string): React.CSSProperties {
  return {
    padding: '12px 10px',
    fontSize: 13, lineHeight: 1.6,
    color: isLabel ? '#fff' : 'rgba(255,255,255,0.75)',
    fontWeight: isLabel ? 700 : 500,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontFamily: FONT_SERIF_JA,
    background: accent ? `${accent}10` : 'transparent',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICING — 業界別 3 プラン (推奨を中央 highlight)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PLAN_INFO: Record<string, { name: string; price: number; subtitle: string; envKey: string }> = {
  'v2-btoC-light':    { name: 'ライト',      price: 3000,  subtitle: 'お試し・副業',           envKey: 'VITE_STRIPE_PRISM_V2_BTOC_LIGHT_URL' },
  'v2-btoC-standard': { name: 'スタンダード', price: 5000,  subtitle: '個人事業主・一人社長',   envKey: 'VITE_STRIPE_PRISM_V2_BTOC_STANDARD_URL' },
  'v2-btoC-pro':      { name: 'プロ',        price: 15000, subtitle: '高単価フリーランス',     envKey: 'VITE_STRIPE_PRISM_V2_BTOC_PRO_URL' },
  'v2-btoB-entry':    { name: 'エントリー',  price: 20000, subtitle: '法人 試験導入',          envKey: 'VITE_STRIPE_PRISM_V2_BTOB_ENTRY_URL' },
  'v2-btoB-standard': { name: 'スタンダード', price: 30000, subtitle: '中小企業 / 高 ROI',     envKey: 'VITE_STRIPE_PRISM_V2_BTOB_STANDARD_URL' },
  'v2-btoB-pro':      { name: 'プロ',        price: 50000, subtitle: '法人 上位',              envKey: 'VITE_STRIPE_PRISM_V2_BTOB_PRO_URL' },
};

function Pricing({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={sectionTitle}>料金プラン</h2>
        <p style={sectionLead}>{config.pricingTagline}</p>

        {/* 月額 / 年額 切替 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          marginTop: '2rem', marginBottom: '2rem',
        }}>
          <button
            onClick={() => setYearly(false)}
            style={{
              padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              background: !yearly ? `linear-gradient(135deg, ${accentLeft}, ${accentRight})` : 'rgba(255,255,255,0.06)',
              color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >月額</button>
          <button
            onClick={() => setYearly(true)}
            style={{
              padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              background: yearly ? `linear-gradient(135deg, ${accentLeft}, ${accentRight})` : 'rgba(255,255,255,0.06)',
              color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >年額 (2 ヶ月分お得)</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          {config.planLineup.map(planId => {
            const info = PLAN_INFO[planId];
            const isRecommended = planId === config.recommendedPlan;
            const displayPrice = yearly ? info.price * 10 : info.price;
            const url = getStripeUrl(planId, yearly);
            return (
              <PlanCard
                key={planId}
                name={info.name}
                subtitle={info.subtitle}
                price={displayPrice}
                yearly={yearly}
                isRecommended={isRecommended}
                accentLeft={accentLeft}
                accentRight={accentRight}
                stripeUrl={url}
              />
            );
          })}
        </div>
        <p style={{
          textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.6)',
          marginTop: '2rem',
        }}>
          ※ 表示価格は税別。法人は請求書払い (口座振込) も対応。
        </p>
      </div>
    </section>
  );
}

function getStripeUrl(planId: string, yearly: boolean): string {
  const info = PLAN_INFO[planId];
  const envKey = yearly ? info.envKey.replace('_URL', '_YEARLY_URL') : info.envKey;
  // import.meta.env で取得
  const envObj = (import.meta as { env?: Record<string, string> })?.env || {};
  return envObj[envKey] || '/';
}

function PlanCard({ name, subtitle, price, yearly, isRecommended, accentLeft, accentRight, stripeUrl }: {
  name: string; subtitle: string; price: number; yearly: boolean;
  isRecommended: boolean; accentLeft: string; accentRight: string; stripeUrl: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'relative',
        padding: '2rem 1.5rem',
        background: isRecommended
          ? `linear-gradient(180deg, ${accentLeft}20, ${accentRight}08)`
          : 'rgba(255,255,255,0.03)',
        border: isRecommended
          ? `1px solid ${accentRight}88`
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18,
        boxShadow: isRecommended ? `0 16px 48px ${accentRight}33` : 'none',
      }}
    >
      {isRecommended && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
          color: '#fff', fontSize: 10, fontWeight: 800,
          padding: '4px 14px', borderRadius: 999, letterSpacing: '0.15em',
        }}>
          ★ 推奨
        </div>
      )}
      <p style={{ fontSize: 11, color: accentRight, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
        {subtitle}
      </p>
      <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        {name}
      </h3>
      <p style={{ fontSize: 36, fontWeight: 900, marginBottom: 4 }}>
        ¥{price.toLocaleString('ja-JP')}
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginLeft: 4 }}>
          / {yearly ? '年' : '月'}
        </span>
      </p>
      <a
        href={stripeUrl}
        target={stripeUrl.startsWith('https://') ? '_blank' : undefined}
        rel="noopener noreferrer"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          padding: '12px 16px',
          marginTop: 18,
          borderRadius: 12,
          background: isRecommended
            ? `linear-gradient(135deg, ${accentLeft}, ${accentRight})`
            : 'rgba(255,255,255,0.06)',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 800,
          fontSize: 13.5,
          border: isRecommended ? 'none' : '1px solid rgba(255,255,255,0.15)',
        }}
      >
        7 日 無料で始める
      </a>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAQ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Faq({ config, accentLeft }: { config: IndustryConfig; accentLeft: string }) {
  return (
    <section style={{ padding: '5rem 1.5rem', background: '#080812' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={sectionTitle}>よくある質問</h2>
        <div style={{ marginTop: '2.5rem' }}>
          {config.faq.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} accent={accentLeft} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, accent }: { q: string; a: string; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          color: '#fff',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          fontFamily: FONT_SERIF_JA,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <span>{q}</span>
        <span style={{ color: accent, fontSize: 20, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
      </button>
      {open && (
        <div style={{
          padding: '0 20px 16px',
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.85,
          fontFamily: FONT_SERIF_JA,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINAL CTA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function FinalCta({ config, accentLeft, accentRight }: { config: IndustryConfig; accentLeft: string; accentRight: string }) {
  const info = PLAN_INFO[config.recommendedPlan];
  const envObj = (import.meta as { env?: Record<string, string> })?.env || {};
  const url = envObj[info.envKey] || '/';
  return (
    <section id="demo" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{
          ...sectionTitle,
          fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
        }}>
          まず 7 日間、無料で。
        </h2>
        <p style={{ ...sectionLead, marginBottom: '2rem' }}>
          カード登録は不要。続けるか続けないかは、7 日後に決めてください。
        </p>
        <a
          href={url}
          target={url.startsWith('https://') ? '_blank' : undefined}
          rel="noopener noreferrer"
          style={{ ...ctaPrimary(accentLeft, accentRight), fontSize: 16, padding: '16px 32px' }}
        >
          無料で始める →
        </a>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>
          推奨: {info.name} (月 ¥{info.price.toLocaleString('ja-JP')}) ・ いつでも解約
        </p>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOOTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Footer() {
  return (
    <footer style={{
      padding: '3rem 1.5rem',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
      fontFamily: FONT_SERIF_JA,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginBottom: '1rem', fontSize: 12 }}>
        <a href="/corp" style={footerLink}>会社概要</a>
        <a href="/pricing" style={footerLink}>料金</a>
        <a href="/faq" style={footerLink}>FAQ</a>
        <a href="/privacy" style={footerLink}>プライバシー</a>
        <a href="/terms" style={footerLink}>利用規約</a>
        <a href="/tokushoho" style={footerLink}>特定商取引法</a>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        © 2026 株式会社 CORE
      </p>
    </footer>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textAlign: 'center',
  marginBottom: '0.85rem',
  lineHeight: 1.4,
};

const sectionLead: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: 'clamp(0.92rem, 1.3vw, 1.02rem)',
  color: 'rgba(255,255,255,0.65)',
  textAlign: 'center',
  maxWidth: 640,
  margin: '0 auto',
  lineHeight: 1.95,
};

function ctaPrimary(accentLeft: string, accentRight: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '13px 22px', borderRadius: 999,
    background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
    color: '#fff', fontWeight: 800, fontSize: 14,
    textDecoration: 'none',
    boxShadow: `0 8px 24px ${accentRight}55`,
    border: 'none', cursor: 'pointer',
  };
}

const ctaGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '12px 20px', borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontWeight: 700, fontSize: 13.5,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.15)',
};

const footerLink: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  textDecoration: 'none',
};
