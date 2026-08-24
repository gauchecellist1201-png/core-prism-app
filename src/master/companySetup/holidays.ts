// ============================================================
// /master/company-setup — 営業日計算 (土日 + 日本の祝日を除外)
// 祝日は当面の実務期間 (2026-08〜2027-02) のみ手動収録。
// それ以降の日付は土日のみ除外して計算する (祝日リストは適宜延長する)。
// ============================================================

const JP_HOLIDAYS_2026_2027: ReadonlySet<string> = new Set([
  '2026-09-21', // 敬老の日
  '2026-09-22', // 国民の休日 (敬老の日と秋分の日に挟まれた平日)
  '2026-09-23', // 秋分の日
  '2026-10-12', // スポーツの日
  '2026-11-03', // 文化の日
  '2026-11-23', // 勤労感謝の日
  '2027-01-01', // 元日
  '2027-01-11', // 成人の日
  '2027-02-11', // 建国記念の日
  '2027-02-23', // 天皇誕生日
]);

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  if (JP_HOLIDAYS_2026_2027.has(toIsoDate(d))) return false;
  return true;
}

export function isBusinessDayIso(iso: string): boolean {
  const d = parseIsoDate(iso);
  if (!d) return false;
  return isBusinessDay(d);
}

function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** startIso の翌日から数えて n 営業日後の日付を ISO で返す */
export function businessDaysLaterIso(startIso: string, n: number): string | null {
  const start = parseIsoDate(startIso);
  if (!start) return null;
  const cur = new Date(start.getTime());
  let counted = 0;
  while (counted < n) {
    cur.setDate(cur.getDate() + 1);
    if (isBusinessDay(cur)) counted += 1;
  }
  return toIsoDate(cur);
}

export function formatMonthDayJa(iso: string | null): string {
  if (!iso) return '未定';
  const d = parseIsoDate(iso);
  if (!d) return '未定';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
