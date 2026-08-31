// ============================================================
// Privacy Policy / Terms of Service 共通レイアウト
// ダーク基調 + 中立アクセント (Prism #A78BFA / Iris #E1306C どちらにも馴染む)
// 最大幅 700px、章ごとに id でアンカー対応
// ============================================================
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

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

// 目次の行は1行44px（指で押せる高さ）なので、章が多いページでは
// 読み込み直後の1画面が目次だけで埋まってしまう（/terms・/privacy=16章・/faq=18問）。
// 10章を超えるページだけ「先頭5行＋のこりを開く」に畳む（2026-08-18）
const TOC_COLLAPSE_OVER = 10;
const TOC_PREVIEW_COUNT = 5;

export default function LegalPageLayout({ eyebrow = 'CORE', title, updatedAt, toc, children }: Props) {
  const collapsible = toc.length > TOC_COLLAPSE_OVER;
  const [tocOpen, setTocOpen] = useState(false);
  const shownToc = collapsible && !tocOpen ? toc.slice(0, TOC_PREVIEW_COUNT) : toc;
  const restCount = toc.length - TOC_PREVIEW_COUNT;

  // タブの名前が「CORE Prism — すべての事業家に…」のままだと、
  // 規約・FAQ・特商法をタブで開いた人が、いま何のページを見ているのか分からない。
  // 共通レイアウトで直せば 4 ページまとめて直る（2026-07-31）
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — CORE`;
    return () => { document.title = prev; };
  }, [title]);

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
            id="legal-toc-list"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              counterReset: 'toc',
            }}
          >
            {shownToc.map((item, i) => (
              <li
                key={item.id}
                style={{
                  fontSize: '0.92rem',
                }}
              >
                {/* 目次は「指で押す」ための一覧。1行27pxでは狙いを外すので、
                    行そのものを44pxの高さにする（2026-08-17） */}
                <a
                  href={`#${item.id}`}
                  style={{
                    color: COLORS.textSub,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 44,
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

          {collapsible && (
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              aria-expanded={tocOpen}
              aria-controls="legal-toc-list"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4em',
                width: '100%',
                minHeight: 44,
                marginTop: '0.5rem',
                padding: '0 0.75rem',
                background: 'transparent',
                border: `1px solid ${COLORS.accent}55`,
                borderRadius: 10,
                color: COLORS.accent,
                fontSize: '0.85rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {tocOpen ? '目次をとじる' : `のこり${restCount}件を見る`}
              <ChevronDown
                size={16}
                aria-hidden="true"
                style={{
                  transform: tocOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>
          )}
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
              href="mailto:info@core-ai.jp"
              style={{
                color: COLORS.text,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
              }}
            >
              info@core-ai.jp
            </a>
          </p>
          <p style={{ fontSize: '0.78rem', color: COLORS.textMute, margin: '0.8rem 0 0' }}>
            運営: 株式会社CORE / 運営責任者: 井出 直毅 / 所在地は請求があれば遅滞なく開示します
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
        /*
         * 文の途中に出てくるリンク（料金ページ / プライバシーポリシー / メール宛先…）は
         * 高さ 20〜22px しかなく、指では狙えなかった（2026-08-17）。
         * ただし「面を44pxにする」LP のやり方をそのまま当てると文が割れる。
         * inline-flex にすると、リンクの箱ではなく **その行の高さ** が44pxに持ち上がるので
         *   - 文中のままで改行されない（atomic な箱なので文の途中で切れない）
         *   - 上下の行のリンクと当たり判定が重ならない（行間 >= 44px になるため）
         * 長いメールアドレスが狭い表の中で外にはみ出さないよう overflow-wrap も添える。
         */
        .legal-article a {
          color: ${COLORS.accent};
          text-decoration: underline;
          text-underline-offset: 2px;
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          overflow-wrap: anywhere;
        }
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
