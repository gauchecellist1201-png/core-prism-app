import { site } from "../config/site";

/** FAQ。details/summary によるアコーディオン (JS 不要・アクセシブル)。 */
export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="container" style={{ maxWidth: 760 }}>
        <p className="section-label">FAQ</p>
        <h2 className="section-title">よくある質問</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 40 }}>
          {site.faq.map((item) => (
            <details
              key={item.q}
              className="card"
              style={{ padding: 0, border: "1px solid var(--line)", boxShadow: "none" }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  padding: "18px 24px",
                  fontWeight: 600,
                  fontSize: 15,
                  listStyle: "none",
                  minHeight: 44,
                }}
              >
                {item.q}
              </summary>
              <p
                style={{
                  padding: "0 24px 20px",
                  fontSize: 14.5,
                  color: "var(--ink-muted)",
                }}
              >
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
