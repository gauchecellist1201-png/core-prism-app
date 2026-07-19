import { site } from "../config/site";

/** フッター。コピーライトと法務リンク。 */
export function Footer() {
  return (
    <footer
      style={{
        background: "var(--ink)",
        color: "var(--bg)",
        padding: "40px 0 calc(40px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontSize: 12.5, opacity: 0.7 }}>
          © {new Date().getFullYear()} {site.footer.copyright}
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {site.footer.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ color: "var(--bg)", fontSize: 12.5, opacity: 0.7, padding: "8px 0" }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
