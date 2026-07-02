// ============================================================
// CORE Inc. — 法人 LP (Corporate Landing)
// 「すべての時代の、核となるものを。」
// 配置: /corp ルート、noindex で検索エンジンには載せない
// ============================================================
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import LegalModal, { type LegalKind } from '../components/LegalModal';
import { Mail as MailIcon } from 'lucide-react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo, GuildLogo, CoreLogo, CrystalLogo } from '../components/Logo';

const COMPANY = {
  nameJa: '株式会社コア',
  nameEn: 'CORE Inc.',
  founded: '2026年 設立予定',
  ceoJa: '井出 直毅',
  ceoEn: 'Naoki Ide',
  addressJa: '〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号',
  addressEn: '7-11-7 Uozaki-Minamimachi, Higashinada-ku, Kobe, Hyogo 658-0025, Japan',
  email: 'core.inc.guild@gmail.com',
};

// 荘厳系フォント
const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SERIF_EN = '"EB Garamond", "Cormorant Garamond", "Noto Serif JP", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';


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
        Prism ・ Iris ・ Guild ・ Resonance ・ Lume ・ Crystal —— 六つのプロダクト、ベータ公開中
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
            <a href="#journey" style={navLink} className="lp-nav-link">歩み</a>
            <a href="#about" style={navLink} className="lp-nav-link">会社概要</a>
            <a href="#contact" style={ctaSmall}>お問い合わせ</a>
          </nav>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  HERO                       */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HeroVideo />

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
            Instagram の <strong style={{ color: '#E1306C', fontWeight: 600 }}>Iris</strong> が反応をつかみ、リンクの <strong style={{ color: '#FFA42A', fontWeight: 600 }}>Lume</strong> が興味を映し、LINE の <strong style={{ color: '#06C755', fontWeight: 600 }}>Resonance</strong> が一人ひとりに届ける。
            <br />
            集まった声は、司令塔 <strong style={{ color: '#a78bfa', fontWeight: 600 }}>Prism</strong> へ。13 名の AI 役員が、次の一手まで描く。
            <br />
            そして <strong style={{ color: '#2dd4bf', fontWeight: 600 }}>Guild</strong> が、お客様を“ファン”から、ともに動く“仲間”へ変える。
            <br />
            五つは、別々の道具ではない。掛け合わさって、ひとつの知性になる。
            <br />
            <strong style={{ color: '#fff', fontWeight: 700 }}>あなたは、最後に確認するだけ。</strong>
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
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.85rem',
                maxWidth: 1180,
                margin: '0 auto',
                textAlign: 'left',
              }}
            >
              <FlowStep n="01" color="#FFA42A" tool="Lume" Logo={LumeLogo} body="ファンが、あなたのどのリンクを踏んだのかが分かる。" />
              <FlowStep n="02" color="#E1306C" tool="Iris" Logo={IrisLogo} body="その人の Instagram での反応を、AIが解析する。" />
              <FlowStep n="03" color="#06C755" tool="Resonance" Logo={ResonanceLogo} body="いま響く一文を、LINE でその人だけに届ける。" />
              <FlowStep n="04" color="#a78bfa" tool="Prism" Logo={PrismLogo} body="すべてを記録し、13 名の AI 役員が次の一手を出す。" />
              <FlowStep n="05" color="#2dd4bf" tool="Guild" Logo={GuildLogo} body="決まった一手を、貢献で動くチーム〈ギルド〉が実行する。" last />
            </div>

            <p style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.95rem, 1.4vw, 1.08rem)',
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 2,
              marginTop: '2.75rem',
              fontWeight: 400,
            }}>
              五つのサービスが連携し、ひとつの流れになる。
              <br />
              <strong style={{ color: '#fff', fontWeight: 700 }}>あなたは、最後に確認するだけ。</strong>
            </p>
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

          {/* GUILD — 貢献で決める組織 OS（5サービスの中央） */}
          <FeatureProduct
            brand="guild"
            badge="チーム ／ 貢献で決める組織 OS"
            tagline="肩書きではなく、貢献で動く。"
            taglineEn="Run your team by contribution."
            description="社員・副業・フリーランス・AI を、ひとつの「ギルド」へ。意思決定は提案と投票で透明に行い、決まったことは改ざんできない記録として刻まれます。Prism が率いる 13 名の AI 役員も、このギルドの一員として動きます。"
            features={[
              '提案 → 投票で、チーム全員が意思決定に参加',
              '決定は改ざん検知つきのタイムラインに記録',
              '社員・副業・フリーランス・AI を一つのギルドに',
            ]}
            accentColor="#2DD4BF"
            accentGradient="linear-gradient(135deg,#5EEAD4,#22D3EE,#2DD4BF)"
            url="https://guild-gauches-projects.vercel.app/?lp=1"
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
            url="https://resonancebot-ivory.vercel.app/lp"
            reversed
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
          />

          {/* CRYSTAL — 話しかけるだけの AI コンシェルジュ (第6のプロダクト) */}
          <FeatureProduct
            brand="crystal"
            badge="AI コンシェルジュ ／ サイトに1行で"
            tagline="話しかけるだけで、すべて解決。"
            taglineEn="Speak, and it is handled."
            description="画面いっぱいに咲くクリスタルの花に、声で話しかけるだけ。あなたのサイトを訪れたお客様を 24 時間お迎えし、質問に答え、見込みの高い方から商談の日程まで受け取る、白と金の AI コンシェルジュです。"
            features={[
              '会社案内を貼るだけで学習・FAQ も自動生成',
              '有望なお客様を見極めて日程と連絡先を獲得',
              '設置は HTML にタグ1行、多言語で自動応対',
            ]}
            accentColor="#C9A96E"
            accentGradient="linear-gradient(135deg,#FFFFFF,#D9E4F5,#C9A96E)"
            url="/crystal"
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
            そして、その全部が息づく場が、貢献で動く組織
            <strong style={{ color: '#2dd4bf', fontWeight: 600 }}> Guild</strong>〈ギルド〉。
            <br />
            <br />
            四つの道具と、それを使う人々が、ひとつの〈ギルド〉に集う。
            <br />
            別々ではなく、ひとつの核でつながり、
            <br />
            つくる人も、使う人も、やがてひとつの組織になる。
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
            <InfoRow label="提供サービス" subLabel="Products"   value="CORE Prism（事業家向け）／ CORE Iris（インフルエンサー向け）／ CORE Resonance（店舗・サロン・教室向け）／ CORE Lume（クリエイター向け）／ Crystal（AI コンシェルジュ・接客サイト向け）" isLast />
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
              { label: '法人 / 導入相談', desc: 'チーム導入・請求書払い・カスタム要件', subject: '法人導入の相談' },
              { label: '取材 / プレス', desc: 'メディア掲載・登壇依頼・資料請求', subject: '取材依頼' },
              { label: '採用 / 業務委託', desc: 'エンジニア・デザイナー・パートナー', subject: '採用に関心があります' },
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
            <a href="https://guild-gauches-projects.vercel.app/?lp=1" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Guild</a>
            <a href="https://resonancebot-ivory.vercel.app/lp" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Resonance</a>
            <a href="https://lume-deploy-five.vercel.app/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Lume</a>
            <a href="/crystal" style={footLink} className="lp-tap-link">Crystal</a>
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
function HeroVideo() {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  // スマホ縦は横長動画だと左右が見切れるため、縦(9:16)再編集版に切り替える。
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const src = portrait ? '/corp-hero-portrait.mp4' : '/corp-hero.mp4';
  const poster = portrait ? '/corp-hero-portrait-poster.jpg' : '/corp-hero-poster.jpg';
  const toggle = () => {
    const v = vref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) void v.play().catch(() => {});
  };
  return (
    <section
      id="top"
      className="lp-safe"
      style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: '#000' }}
    >
      <video
        key={src}
        ref={vref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.82) 100%)' }}
      />
      <button
        onClick={toggle}
        aria-label={muted ? '音を出す' : '消音'}
        className="lp-tap-link"
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 5rem)', right: '1.1rem', zIndex: 4, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', borderRadius: 999, cursor: 'pointer', background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', fontSize: '0.78rem', backdropFilter: 'blur(6px)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {muted ? <line x1="22" y1="9" x2="16" y2="15" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
        </svg>
        {muted ? '音を出す' : '消音'}
      </button>
      <div
        style={{ position: 'relative', zIndex: 3, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3.5rem)', textAlign: 'center', width: '100%' }}
      >
        <a href="#products" style={ctaHero}>プロダクトを見る</a>
        <div aria-hidden style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <span style={{ width: 20, height: 20, borderRight: '2px solid rgba(255,255,255,0.55)', borderBottom: '2px solid rgba(255,255,255,0.55)', transform: 'rotate(45deg)' }} />
        </div>
      </div>
    </section>
  );
}


// ============================================================
//  CoreWatermark — 巨大な「CORE」の透かし背景文字
// ============================================================

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
  brand: 'prism' | 'iris' | 'guild' | 'resonance' | 'lume' | 'crystal';
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
    brand === 'guild' ? GuildLogo :
    brand === 'resonance' ? ResonanceLogo :
    brand === 'lume' ? LumeLogo :
    brand === 'crystal' ? CrystalLogo :
    PrismLogo;
  const productName =
    brand === 'iris' ? 'CORE Iris' :
    brand === 'guild' ? 'CORE Guild' :
    brand === 'resonance' ? 'CORE Resonance' :
    brand === 'lume' ? 'CORE Lume' :
    brand === 'crystal' ? 'Crystal' :
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

// ============================================================
//  ConnectedSuite — 司令塔 Prism + 3 つの SNS チャネルのつながり図
// ============================================================
function ConnectedSuite() {
  // 衛星ノード（正方形コンテナ内の % 座標。左右対称＝Prism を完全中央に）
  // GUILD の「場」(六角フィールド) に収まるよう、やや内側に配置。
  const sats = [
    { key: 'iris', Logo: IrisLogo, name: 'Iris', role: 'Instagram', color: '#E1306C', x: 50, y: 18 },
    { key: 'resonance', Logo: ResonanceLogo, name: 'Resonance', role: 'LINE', color: '#06C755', x: 24, y: 80 },
    { key: 'lume', Logo: LumeLogo, name: 'Lume', role: 'リンク', color: '#FFA42A', x: 76, y: 80 },
  ];
  // GUILD の場（4プロダクトを包む）のティール
  const GUILD = '#2dd4bf';

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
      {/* ── HUB (デスクトップ / タブレット)：GUILD の「場」が 4 プロダクトを包む ── */}
      <div className="lp-connect-hub" style={{ position: 'relative', width: 'min(90vw, 560px)', aspectRatio: '1 / 1', margin: '2.6rem auto 0' }}>
        {/* GUILD の場：4 つを内包する六角フィールド（DAO＝組織そのもの・ノードではなく“場”） */}
        <motion.svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}>
          <defs>
            <linearGradient id="guildField" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="55%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
            <radialGradient id="guildFill" cx="50%" cy="44%" r="62%">
              <stop offset="0%" stopColor="rgba(45,212,191,0.12)" />
              <stop offset="68%" stopColor="rgba(45,212,191,0.035)" />
              <stop offset="100%" stopColor="rgba(45,212,191,0)" />
            </radialGradient>
          </defs>
          {/* 外周の六角メンブレン（場の境界） */}
          <path d="M25 8.4 L75 8.4 L98 50 L75 91.6 L25 91.6 L2 50 Z"
            fill="url(#guildFill)" stroke="url(#guildField)" strokeWidth="0.7" strokeOpacity="0.85" strokeLinejoin="round" />
          {/* 内側の流れる薄いライン（生きた場） */}
          <path d="M28 13 L72 13 L92 50 L72 87 L28 87 L8 50 Z"
            fill="none" stroke="url(#guildField)" strokeWidth="0.3" strokeOpacity="0.4" strokeLinejoin="round" strokeDasharray="2 2.4">
            <animate attributeName="stroke-dashoffset" from="9" to="0" dur="3.4s" repeatCount="indefinite" />
          </path>
        </motion.svg>

        {/* Prism → 各プロダクトの接続線 */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 1 }}>
          {sats.map(s => (
            <line key={s.key} x1="50" y1="50" x2={s.x} y2={s.y} stroke={s.color}
              strokeWidth="0.5" strokeOpacity="0.6" strokeDasharray="1.6 1.8" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="7" to="0" dur="1.4s" repeatCount="indefinite" />
            </line>
          ))}
        </svg>

        {/* GUILD ネームプレート（場のタイトル・上端中央） */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', zIndex: 4,
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.42rem 0.95rem', borderRadius: 999,
          background: 'rgba(6,18,16,0.88)', border: `1px solid ${GUILD}88`,
          boxShadow: `0 0 24px ${GUILD}55`, backdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
        }}>
          <GuildLogo size={20} withWordmark={false} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.34em', color: '#7ef0dd', fontWeight: 700, paddingLeft: '0.34em' }}>GUILD</span>
        </div>
        {/* 場の意味（下端中央） */}
        <div style={{
          position: 'absolute', bottom: '-1.7rem', left: '50%', transform: 'translateX(-50%)', zIndex: 4,
          fontFamily: FONT_SERIF_JA, fontSize: '0.74rem', color: 'rgba(126,240,221,0.82)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
        }}>
          貢献で動く、ひとつの場〈DAO〉
        </div>
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

      {/* ── STACK (モバイル)：GUILD の「場」の中に Prism → 3チャネルを内包 ── */}
      <div className="lp-connect-stack" aria-hidden>
        <div style={{
          position: 'relative', width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '2rem 0.9rem 1.4rem', borderRadius: 24,
          border: `1px solid ${GUILD}55`,
          background: `radial-gradient(circle at 50% 0%, ${GUILD}16, transparent 70%)`,
          boxShadow: `inset 0 0 34px ${GUILD}1a, 0 0 24px ${GUILD}1f`,
        }}>
          {/* GUILD ヘッダ（場の名前） */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.32rem 0.82rem', borderRadius: 999,
            background: '#06120f', border: `1px solid ${GUILD}88`, boxShadow: `0 0 18px ${GUILD}44`, whiteSpace: 'nowrap',
          }}>
            <GuildLogo size={16} withWordmark={false} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.56rem', letterSpacing: '0.3em', color: '#7ef0dd', fontWeight: 700, paddingLeft: '0.3em' }}>GUILD</span>
          </div>

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
          <div style={{ marginTop: '1rem', fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(126,240,221,0.82)', letterSpacing: '0.06em' }}>
            貢献で動く、ひとつの場〈DAO〉
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────── 一気通貫フローの 1 ステップ ─────────────
function FlowStep({ n, color, tool, body, Logo, last }: { n: string; color: string; tool: string; body: string; Logo: React.ComponentType<{ size?: number; withWordmark?: boolean }>; last?: boolean }) {
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
        <span style={{ display: 'inline-flex', flexShrink: 0 }}><Logo size={22} withWordmark={false} /></span>
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
