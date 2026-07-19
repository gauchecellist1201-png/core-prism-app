import { site } from "../config/site";

/** 価格セクション。highlighted: true のプランを主色で強調。 */
export function Pricing() {
  return (
    <section className="section" id="pricing" style={{ background: "var(--surface)" }}>
      <div className="container">
        <p className="section-label">Pricing</p>
        <h2 className="section-title">価格</h2>
        <p className="section-lead">{site.pricing.note}</p>
        <div className="grid grid-3">
          {site.pricing.plans.map((plan) => {
            const hl = plan.highlighted === true;
            return (
              <div
                key={plan.name}
                className="card"
                style={
                  hl
                    ? { background: "var(--primary)", color: "var(--primary-ink)" }
                    : { border: "1px solid var(--line)", boxShadow: "none" }
                }
              >
                <h3
                  style={{
                    fontSize: 17,
                    marginBottom: 18,
                    color: hl ? "var(--primary-ink)" : "var(--primary)",
                  }}
                >
                  {plan.name}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 34,
                    lineHeight: 1.2,
                    color: hl ? "var(--primary-ink)" : "var(--accent)",
                  }}
                >
                  {plan.price}
                </p>
                <p
                  style={{
                    fontSize: 12.5,
                    marginBottom: 20,
                    opacity: hl ? 0.75 : 1,
                    color: hl ? "var(--primary-ink)" : "var(--ink-muted)",
                  }}
                >
                  {plan.priceNote}
                </p>
                <ul style={{ listStyle: "none", display: "grid", gap: 10 }}>
                  {plan.points.map((pt) => (
                    <li
                      key={pt}
                      style={{
                        fontSize: 14,
                        paddingLeft: 18,
                        position: "relative",
                        opacity: hl ? 0.9 : 1,
                        color: hl ? "var(--primary-ink)" : "var(--ink)",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.75em",
                          width: 8,
                          height: 1.5,
                          background: "var(--accent)",
                        }}
                      />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
