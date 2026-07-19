import { site } from "../config/site";

/** ファーストビュー。ナビ + キャッチコピー + 主/副CTA。 */
export function Hero() {
  return (
    <header
      style={{
        background: "var(--primary)",
        color: "var(--primary-ink)",
        minHeight: "88svh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ナビ */}
      <nav
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 22,
          paddingBottom: 22,
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 17,
            letterSpacing: "0.12em",
            whiteSpace: "nowrap",
          }}
        >
          {site.name}
        </span>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{ color: "var(--primary-ink)", fontSize: 13, opacity: 0.85, padding: "8px 0" }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* コピー */}
      <div
        className="container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 48,
          paddingBottom: 72,
        }}
      >
        <p style={{ fontSize: 12, letterSpacing: "0.3em", opacity: 0.7, marginBottom: 20 }}>
          {site.hero.kicker}
        </p>
        <h1
          style={{
            fontSize: "clamp(34px, 7.5vw, 60px)",
            color: "var(--primary-ink)",
            whiteSpace: "pre-line",
            marginBottom: 26,
          }}
        >
          {site.hero.title}
        </h1>
        <p style={{ maxWidth: 560, opacity: 0.85, marginBottom: 40 }}>{site.hero.lead}</p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a
            className="btn"
            href={site.hero.ctaHref}
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {site.hero.ctaLabel}
          </a>
          <a
            className="btn"
            href={site.hero.subCtaHref}
            style={{
              background: "transparent",
              color: "var(--primary-ink)",
              border: "1px solid rgba(247,245,240,0.45)",
            }}
          >
            {site.hero.subCtaLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
