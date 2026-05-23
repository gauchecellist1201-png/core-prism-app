// ============================================================
// Privacy Policy / Terms of Service 共通レイアウト
// ダーク基調 + 中立アクセント (Prism #A78BFA / Iris #E1306C どちらにも馴染む)
// 最大幅 700px、章ごとに id でアンカー対応
// ============================================================
import type { ReactNode } from 'react';

export interface TocItem {
  id: string;
  label: string;
}

interface Props {
  /** ヘッダーの小さい上書きラベル (例: "CORE PRISM / IRIS") */
  eyebrow?: string;
  /** ページタイトル */
  title: string;
  /** 最終更新日 (例: "2026年5月22日") */
  updatedAt: string;
  /** 目次の項目 (id は本文の <section id="..."> と一致させる) */
  toc: TocItem[];
  /** 本文 */
  children: ReactNode;
}

const COLORS = {
  bg: '#0A0E1A',
  bgSoft: '#10162A',
  border: 'rgba(255,255,255,0.08)',
  text: '#E6E9F2',
  textSub: 'rgba(230,233,242,0.72)',
  textMute: 'rgba(230,233,242,0.5)',
  accent: '#A78BFA',
  accentSoft: 'rgba(167,139,250,0.12)',
};

export default function LegalPageLayout({ eyebrow = 'CORE', title, updatedAt, toc, children }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
        lineHeight: 1.85,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* グラデの上部装飾 */}
      <div
        style={{
          height: 4,
          background: 'linear-gradient(90deg, #A78BFA 0%, #E1306C 100%)',
        }}
      />

      <main
        style={{
          maxWidth: 700,
          margin: '0 auto',
          padding: '3rem 1.25rem 4rem',
        }}
      >
        {/* ヘッダー */}
        <header style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.2em',
              color: COLORS.accent,
              fontWeight: 700,
              marginBottom: '0.6rem',
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
              fontWeight: 900,
              margin: '0 0 0.8rem',
              letterSpacing: '0.02em',
              color: COLORS.text,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: '0.85rem', color: COLORS.textMute, margin: 0 }}>
            最終更新日: {updatedAt}
          </p>
        </header>

        {/* 目次 */}
        <nav
          aria-label="目次"
          style={{
            background: COLORS.bgSoft,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '1.25rem 1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              color: COLORS.accent,
              fontWeight: 700,
              marginBottom: '0.8rem',
            }}
          >
            目次
          </div>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              counterReset: 'toc',
            }}
          >
            {toc.map((item, i) => (
              <li
                key={item.id}
                style={{
                  marginBottom: '0.4rem',
                  fontSize: '0.92rem',
                }}
              >
                <a
                  href={`#${item.id}`}
                  style={{
                    color: COLORS.textSub,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = COLORS.accent)}
                  onMouseOut={(e) => (e.currentTarget.style.color = COLORS.textSub)}
                >
                  <span style={{ color: COLORS.textMute, marginRight: '0.6em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 本文 */}
        <article className="legal-article">{children}</article>

        {/* お問い合わせブロック */}
        <section
          style={{
            marginTop: '3rem',
            padding: '1.5rem 1.75rem',
            background: COLORS.accentSoft,
            border: `1px solid ${COLORS.accent}33`,
            borderRadius: 12,
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              margin: '0 0 0.5rem',
              color: COLORS.accent,
            }}
          >
            お問い合わせ窓口
          </h3>
          <p style={{ fontSize: '0.9rem', color: COLORS.textSub, margin: '0 0 0.4rem' }}>
            本ポリシー / 規約や、個人情報の開示・訂正・削除等のご請求は下記までご連絡ください。
          </p>
          <p style={{ fontSize: '0.95rem', margin: 0 }}>
            <a
              href="mailto:gauche.cellist1201@gmail.com"
              style={{ color: COLORS.text, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              gauche.cellist1201@gmail.com
            </a>
          </p>
          <p style={{ fontSize: '0.78rem', color: COLORS.textMute, margin: '0.8rem 0 0' }}>
            運営: 株式会社CORE (日本・東京) / 代表: 井出 直毅 / 所在地は請求があれば遅滞なく開示します
          </p>
        </section>

        {/* 戻るボタン */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.8rem 2rem',
              background: COLORS.accent,
              color: '#0A0E1A',
              fontWeight: 700,
              fontSize: '0.95rem',
              borderRadius: 999,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            ← Prism に戻る
          </a>
        </div>
      </main>

      {/* 本文 (h2/p/ul/...) の共通スタイル */}
      <style>{`
        .legal-article section {
          scroll-margin-top: 1.5rem;
          margin-bottom: 2.25rem;
        }
        .legal-article h2 {
          font-size: 1.15rem;
          font-weight: 800;
          color: ${COLORS.text};
          margin: 0 0 0.9rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid ${COLORS.border};
          letter-spacing: 0.01em;
        }
        .legal-article h2 .num {
          color: ${COLORS.accent};
          margin-right: 0.5em;
          font-size: 0.85em;
          letter-spacing: 0.1em;
        }
        .legal-article p {
          font-size: 0.95rem;
          color: ${COLORS.textSub};
          margin: 0 0 0.9rem;
        }
        .legal-article ul, .legal-article ol {
          font-size: 0.93rem;
          color: ${COLORS.textSub};
          margin: 0 0 1rem;
          padding-left: 1.4rem;
        }
        .legal-article li { margin-bottom: 0.35rem; }
        .legal-article strong { color: ${COLORS.text}; font-weight: 700; }
        .legal-article a { color: ${COLORS.accent}; text-decoration: underline; text-underline-offset: 2px; }
        .legal-article code {
          background: ${COLORS.bgSoft};
          border: 1px solid ${COLORS.border};
          border-radius: 4px;
          padding: 0.1em 0.4em;
          font-size: 0.85em;
          color: ${COLORS.text};
          font-family: "SF Mono", Menlo, monospace;
        }
        .legal-article .note {
          background: ${COLORS.bgSoft};
          border-left: 3px solid ${COLORS.accent};
          padding: 0.8rem 1rem;
          margin: 0.8rem 0;
          font-size: 0.88rem;
          border-radius: 0 6px 6px 0;
          color: ${COLORS.textSub};
        }
        .legal-article table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          margin: 0.5rem 0 1rem;
        }
        .legal-article th, .legal-article td {
          border: 1px solid ${COLORS.border};
          padding: 0.55rem 0.8rem;
          text-align: left;
          vertical-align: top;
          color: ${COLORS.textSub};
        }
        .legal-article th {
          background: ${COLORS.bgSoft};
          color: ${COLORS.text};
          font-weight: 700;
          width: 38%;
        }
      `}</style>
    </div>
  );
}
