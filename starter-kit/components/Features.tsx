import { site } from "../config/site";

/** 特長セクション。site.features を3カラム(モバイル1列)で表示。 */
export function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <p className="section-label">Features</p>
        <h2 className="section-title">選ばれる理由</h2>
        <p className="section-lead">{site.description}</p>
        <div className="grid grid-3">
          {site.features.map((f, i) => (
            <div className="card" key={f.title}>
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 13,
                  color: "var(--accent)",
                  letterSpacing: "0.2em",
                  marginBottom: 12,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 style={{ fontSize: 19, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14.5, color: "var(--ink-muted)" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
