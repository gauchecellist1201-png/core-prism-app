import type { Invoice } from '../types/invoice';
import { computeTotals, fmtJpy, fmtJpyPlain } from '../lib/invoiceCalc';

/** 印刷用レイアウト (A4縦)。window.print() でそのまま PDF 化できるように
 *  クラス "invoice-print-root" を持ち、@media print で他要素を非表示にする。
 */
export function InvoicePrintView({ invoice }: { invoice: Invoice }) {
  const t = computeTotals(invoice.lines);
  const issuer = invoice.issuerSnapshot;
  const client = invoice.clientSnapshot;
  return (
    <div className="invoice-print-root mx-auto" style={{
      width: '210mm', minHeight: '297mm',
      padding: '20mm 18mm',
      background: '#FFFFFF',
      color: '#1A1A1A',
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
      fontSize: '11pt',
      boxSizing: 'border-box',
    }}>
      {/* タイトル */}
      <div style={{ textAlign: 'center', marginBottom: '8mm' }}>
        <h1 style={{ fontSize: '26pt', letterSpacing: '0.4em', margin: 0, fontWeight: 600 }}>請求書</h1>
        <div style={{ height: '1.5pt', background: '#1A1A1A', width: '60mm', margin: '4mm auto 0' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
        {/* 宛先 */}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '14pt', fontWeight: 500, borderBottom: '0.8pt solid #1A1A1A', paddingBottom: '2mm', display: 'inline-block', minWidth: '70mm' }}>
            {client.name || '＿＿＿＿＿＿＿＿＿＿＿＿＿＿'}
          </p>
          {client.contactName && (
            <p style={{ margin: '2mm 0 0', fontSize: '10pt' }}>{client.contactName}</p>
          )}
          {client.postalCode && (
            <p style={{ margin: '1mm 0 0', fontSize: '9pt', color: '#444' }}>〒{client.postalCode}</p>
          )}
          {client.address && (
            <p style={{ margin: '0', fontSize: '9pt', color: '#444' }}>{client.address}</p>
          )}
        </div>

        {/* 発行情報 */}
        <div style={{ textAlign: 'right', minWidth: '60mm' }}>
          <div style={{ fontSize: '10pt' }}>
            <div>請求書番号: <strong>{invoice.number}</strong></div>
            <div>発行日: {invoice.issueDate}</div>
            <div>支払期限: <strong>{invoice.dueDate}</strong></div>
          </div>
        </div>
      </div>

      {/* 件名 + 合計 */}
      <div style={{ marginBottom: '8mm' }}>
        <p style={{ margin: '0 0 3mm', fontSize: '12pt' }}>
          {invoice.subject || ''}　下記のとおりご請求申し上げます。
        </p>
        <div style={{
          display: 'inline-block',
          padding: '4mm 6mm',
          border: '1.5pt solid #1A1A1A',
          borderRadius: '2mm',
        }}>
          <span style={{ fontSize: '11pt', marginRight: '4mm' }}>ご請求金額</span>
          <strong style={{ fontSize: '20pt', letterSpacing: '0.05em' }}>{fmtJpy(t.total)}</strong>
          <span style={{ fontSize: '10pt', marginLeft: '2mm' }}>（税込）</span>
        </div>
      </div>

      {/* 明細 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginBottom: '6mm' }}>
        <thead>
          <tr style={{ background: '#F4F1EB' }}>
            <th style={th()}>品目・内容</th>
            <th style={{ ...th(), width: '14mm', textAlign: 'right' }}>数量</th>
            <th style={{ ...th(), width: '12mm', textAlign: 'center' }}>単位</th>
            <th style={{ ...th(), width: '24mm', textAlign: 'right' }}>単価</th>
            <th style={{ ...th(), width: '14mm', textAlign: 'center' }}>税率</th>
            <th style={{ ...th(), width: '28mm', textAlign: 'right' }}>金額（税抜）</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => {
            const sub = (l.quantity || 0) * (l.unitPrice || 0);
            return (
              <tr key={l.id} style={{ borderBottom: '0.4pt solid #DDD' }}>
                <td style={td()}>
                  {l.description}{l.reducedTax && <span style={{ color: '#9A2B2B', fontSize: '9pt' }}> ※軽減</span>}
                </td>
                <td style={{ ...td(), textAlign: 'right' }}>{l.quantity}</td>
                <td style={{ ...td(), textAlign: 'center' }}>{l.unit || '式'}</td>
                <td style={{ ...td(), textAlign: 'right' }}>{fmtJpyPlain(l.unitPrice)}</td>
                <td style={{ ...td(), textAlign: 'center' }}>{l.taxRate === 0 ? '非' : `${l.taxRate}%`}</td>
                <td style={{ ...td(), textAlign: 'right' }}>{fmtJpyPlain(sub)}</td>
              </tr>
            );
          })}
          {/* 空行で最低 5 行確保 */}
          {Array.from({ length: Math.max(0, 4 - invoice.lines.length) }, (_, i) => (
            <tr key={`empty-${i}`} style={{ borderBottom: '0.4pt solid #DDD' }}>
              <td style={td()}>&nbsp;</td><td style={td()}></td><td style={td()}></td>
              <td style={td()}></td><td style={td()}></td><td style={td()}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 小計 / 税 / 合計 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '10pt', minWidth: '80mm' }}>
          <tbody>
            <tr><td style={tdSum()}>小計（税抜）</td><td style={tdSumR()}>{fmtJpy(t.subtotal)}</td></tr>
            {t.subtotal10 > 0 && (
              <tr><td style={tdSum()}>10%対象</td><td style={tdSumR()}>{fmtJpy(t.subtotal10)} （消費税 {fmtJpy(t.tax10)}）</td></tr>
            )}
            {t.subtotal8 > 0 && (
              <tr><td style={tdSum()}>軽減 8%対象</td><td style={tdSumR()}>{fmtJpy(t.subtotal8)} （消費税 {fmtJpy(t.tax8)}）</td></tr>
            )}
            {t.subtotal0 > 0 && (
              <tr><td style={tdSum()}>非課税</td><td style={tdSumR()}>{fmtJpy(t.subtotal0)}</td></tr>
            )}
            <tr><td style={tdSum()}>消費税合計</td><td style={tdSumR()}>{fmtJpy(t.totalTax)}</td></tr>
            <tr style={{ background: '#F4F1EB' }}>
              <td style={{ ...tdSum(), fontWeight: 'bold', fontSize: '12pt' }}>合計（税込）</td>
              <td style={{ ...tdSumR(), fontWeight: 'bold', fontSize: '14pt' }}>{fmtJpy(t.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 備考・支払条件 */}
      {(invoice.notes || invoice.paymentTerms) && (
        <div style={{ marginBottom: '6mm', padding: '3mm 4mm', border: '0.4pt solid #BBB', borderRadius: '1mm', fontSize: '9.5pt' }}>
          {invoice.paymentTerms && <p style={{ margin: '0 0 1.5mm' }}><strong>支払条件:</strong> {invoice.paymentTerms}</p>}
          {invoice.notes && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>}
        </div>
      )}

      {/* 発行者情報 */}
      <div style={{ marginTop: '6mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '0.4pt solid #BBB', paddingTop: '4mm', position: 'relative' }}>
        <div style={{ flex: 1, fontSize: '9.5pt', lineHeight: 1.6 }}>
          {issuer.logoDataUrl && (
            <img src={issuer.logoDataUrl} alt="logo" style={{ maxHeight: '14mm', maxWidth: '40mm', display: 'block', marginBottom: '2mm' }} />
          )}
          <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{issuer.companyName || '（発行者名未設定）'}</p>
          {issuer.representativeName && <p style={{ margin: '0.5mm 0 0' }}>{issuer.representativeName}</p>}
          {issuer.postalCode && <p style={{ margin: '0.5mm 0 0' }}>〒{issuer.postalCode}</p>}
          {issuer.address && <p style={{ margin: 0 }}>{issuer.address}</p>}
          {issuer.phone && <p style={{ margin: 0 }}>TEL: {issuer.phone}</p>}
          {issuer.email && <p style={{ margin: 0 }}>Email: {issuer.email}</p>}
          {issuer.registrationNumber && (
            <p style={{ margin: '1mm 0 0', fontWeight: 600 }}>適格請求書発行事業者登録番号: {issuer.registrationNumber}</p>
          )}
          {issuer.bankInfo && (
            <p style={{ margin: '2mm 0 0', padding: '1.5mm 2mm', background: '#F4F1EB', borderRadius: '1mm', fontSize: '9pt' }}>
              <strong>振込先:</strong> {issuer.bankInfo}
            </p>
          )}
        </div>

        {issuer.sealDataUrl && (
          <div style={{ width: '24mm', height: '24mm', marginLeft: '4mm', flexShrink: 0 }}>
            <img src={issuer.sealDataUrl} alt="seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
      </div>

      {/* 印刷用 CSS — 他要素を非表示にしつつ A4 にフィット */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
          .invoice-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: '2.5mm 2mm', textAlign: 'left', borderBottom: '1pt solid #1A1A1A', fontWeight: 600, fontSize: '9.5pt' };
}
function td(): React.CSSProperties {
  return { padding: '2mm 2mm', verticalAlign: 'top', fontSize: '9.5pt' };
}
function tdSum(): React.CSSProperties {
  return { padding: '1.5mm 4mm', textAlign: 'right', borderBottom: '0.4pt solid #DDD' };
}
function tdSumR(): React.CSSProperties {
  return { padding: '1.5mm 4mm', textAlign: 'right', borderBottom: '0.4pt solid #DDD', minWidth: '36mm' };
}
