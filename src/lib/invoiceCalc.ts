// ============================================================
// 請求書の税計算 — インボイス制度準拠 (税率ごと1回端数処理)
// ============================================================
import type { InvoiceLine, InvoiceTotals } from '../types/invoice';

export function computeTotals(lines: InvoiceLine[]): InvoiceTotals {
  let subtotal10 = 0, subtotal8 = 0, subtotal0 = 0;
  for (const l of lines) {
    const sub = (l.quantity || 0) * (l.unitPrice || 0);
    if (l.taxRate === 10) subtotal10 += sub;
    else if (l.taxRate === 8) subtotal8 += sub;
    else subtotal0 += sub;
  }
  // インボイス制度: 税率ごとに1回 端数処理 (切り捨て / 切り上げ / 四捨五入は事業者選択。ここでは切り捨て)
  const tax10 = Math.floor(subtotal10 * 0.10);
  const tax8 = Math.floor(subtotal8 * 0.08);
  const subtotal = subtotal10 + subtotal8 + subtotal0;
  const totalTax = tax10 + tax8;
  const total = subtotal + totalTax;
  return { subtotal10, subtotal8, subtotal0, tax10, tax8, subtotal, totalTax, total };
}

export function fmtJpy(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

export function fmtJpyPlain(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

/** 連番採番: 人格 + 年で次の番号を計算 */
export function nextInvoiceNumber(existing: { number: string; personaId: string }[], personaId: string, personaSlug: string, year: number): string {
  const prefix = `INV-${personaSlug.toUpperCase()}-${year}-`;
  const sameYear = existing.filter(e => e.personaId === personaId && e.number.startsWith(prefix));
  const max = sameYear.reduce((m, e) => {
    const n = Number(e.number.slice(prefix.length)) || 0;
    return Math.max(m, n);
  }, 0);
  return prefix + String(max + 1).padStart(3, '0');
}

/** 月末締翌月末払いなど、よくある支払期限を自動計算 */
export function calcDueDate(issueDate: string, kind: 'eom-next' | 'plus30' | 'plus14' | 'plus60' = 'eom-next'): string {
  const d = new Date(issueDate);
  if (isNaN(d.getTime())) return issueDate;
  if (kind === 'plus14') { d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); }
  if (kind === 'plus30') { d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); }
  if (kind === 'plus60') { d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); }
  // 月末締・翌月末払い
  const next = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  return next.toISOString().slice(0, 10);
}

/** 人格名から英字スラッグを生成 (請求書番号用) */
export function personaSlug(name: string): string {
  // ASCII の英数字のみ抽出。なければ "P"
  const ascii = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (ascii.length > 0) return ascii.slice(0, 8);
  // 日本語名なら最初の文字を Unicode 16進化
  return 'PERSONA';
}
