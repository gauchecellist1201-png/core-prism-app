import { site } from "../config/site";

/** お問い合わせ。メール/電話/住所を静的表示 (フォームAPIが無くても成立)。 */
export function Contact() {
  const { contact } = site;
  return (
    <section className="section" id="contact" style={{ background: "var(--surface)" }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <p className="section-label">Contact</p>
        <h2 className="section-title">お問い合わせ</h2>
        <p className="section-lead">{contact.lead}</p>
        <div className="card" style={{ border: "1px solid var(--line)", boxShadow: "none" }}>
          <dl style={{ display: "grid", gap: 18 }}>
            <div>
              <dt style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--sage)" }}>MAIL</dt>
              <dd style={{ marginTop: 4 }}>
                <a href={`mailto:${contact.email}`} style={{ fontSize: 17, wordBreak: "break-all" }}>
                  {contact.email}
                </a>
              </dd>
            </div>
            {contact.tel !== "" && (
              <div>
                <dt style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--sage)" }}>TEL</dt>
                <dd style={{ marginTop: 4 }}>
                  <a href={`tel:${contact.tel}`} style={{ fontSize: 17 }}>
                    {contact.tel}
                  </a>
                </dd>
              </div>
            )}
            {contact.address !== "" && (
              <div>
                <dt style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--sage)" }}>
                  ADDRESS
                </dt>
                <dd style={{ marginTop: 4, fontSize: 15, color: "var(--ink-muted)" }}>
                  {contact.address}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
