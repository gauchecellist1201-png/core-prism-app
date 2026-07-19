import { site } from "../config/site";

/** 最終CTA。フッター直前に置く一枚バンド。 */
export function Cta() {
  return (
    <section
      className="section"
      style={{ background: "var(--primary)", color: "var(--primary-ink)", textAlign: "center" }}
    >
      <div className="container" style={{ maxWidth: 680 }}>
        <h2
          className="section-title"
          style={{ color: "var(--primary-ink)", marginBottom: 14 }}
        >
          {site.cta.title}
        </h2>
        <p style={{ opacity: 0.8, marginBottom: 36 }}>{site.cta.lead}</p>
        <a
          className="btn"
          href={site.cta.href}
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {site.cta.label}
        </a>
      </div>
    </section>
  );
}
