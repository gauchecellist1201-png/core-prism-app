// ============================================================
// monthlyCsvExport.ts — 「あなたの会社の今月の数字」を 1 CSV にまとめて出力
//
// オーナー指示 (2026-06-03 第 9 波 PP):
//   IdentityDashboard のメニューから 1 タップで CSV ダウンロード。
//   Stripe 売上 / CRM Deals / SNS フォロワー / 経費 等を 1 ファイルに。
//
// クライアント側 (localStorage 集約 + Stripe は /api/cron/daily-stripe-slack を流用しない、
// 直接 ダッシュボードから fetch しない — 個人デバイスから Stripe API を叩かない)。
// → サーバー集約版はオーナー宛 朝メールに任せ、ここはローカル数字に絞る。
// ============================================================

type SectionRow = string[];

interface CsvSection {
  title: string;
  headers: string[];
  rows: SectionRow[];
}

function todayJst(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 9 * 3600 * 1000);
}

function safe(s: unknown): string {
  const t = String(s ?? '');
  // Excel/Numbers セル interpretation 攻撃を避ける (先頭が = + - @ のとき)
  const escaped = /^[=+\-@]/.test(t) ? "'" + t : t;
  if (/[",\n]/.test(escaped)) return `"${escaped.replace(/"/g, '""')}"`;
  return escaped;
}

function buildCsv(sections: CsvSection[]): string {
  const lines: string[] = [];
  // UTF-8 BOM (Excel が文字化けしないように)
  for (const sec of sections) {
    lines.push(`# ${sec.title}`);
    lines.push(sec.headers.map(safe).join(','));
    for (const row of sec.rows) lines.push(row.map(safe).join(','));
    lines.push(''); // セクション区切り
  }
  return '﻿' + lines.join('\n');
}

// ─── データ収集 ──────────────────────────────────

function readCrmDeals(personaId: string): SectionRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('core_crm_deals_v1') || '[]');
    const all = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
    const rows: SectionRow[] = [];
    for (const d of all) {
      if ((d as { personaId?: string }).personaId !== personaId) continue;
      rows.push([
        String(d.id || ''),
        String(d.title || d.companyName || ''),
        String(d.contact || ''),
        String((d as { stage?: string }).stage || ''),
        String((d as { valueJpy?: number }).valueJpy ?? ''),
        String((d as { updatedAt?: string }).updatedAt || ''),
      ]);
    }
    return rows;
  } catch { return []; }
}

function readMonthlyTasks(personaId: string, year: number, month: number): SectionRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('core_tasks_v1') || '[]');
    const all = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
    const rows: SectionRow[] = [];
    for (const t of all) {
      if ((t as { personaId?: string }).personaId !== personaId) continue;
      const updated = String((t as { updatedAt?: string }).updatedAt || (t as { createdAt?: string }).createdAt || '');
      if (!updated.startsWith(`${year}-${String(month).padStart(2, '0')}`)) continue;
      rows.push([
        String(t.id || ''),
        String((t as { title?: string }).title || ''),
        String((t as { status?: string }).status || ''),
        updated,
      ]);
    }
    return rows;
  } catch { return []; }
}

function readCashflowEntries(personaId: string, year: number, month: number): SectionRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('core_cashflow_v1') || '[]');
    const all = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
    const rows: SectionRow[] = [];
    for (const e of all) {
      if ((e as { personaId?: string }).personaId !== personaId) continue;
      const date = String((e as { date?: string }).date || '');
      if (!date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) continue;
      rows.push([
        date,
        String((e as { kind?: string }).kind || ''),
        String((e as { label?: string }).label || ''),
        String((e as { amountJpy?: number }).amountJpy ?? ''),
      ]);
    }
    return rows;
  } catch { return []; }
}

function readIgSnapshot(): SectionRow[] {
  try {
    const raw = localStorage.getItem('core_iris_ig_profile_v1');
    if (!raw) return [];
    const p = JSON.parse(raw);
    return [[
      String(p.handle ?? ''),
      String(p.followers ?? ''),
      String(p.avgLikes ?? ''),
      String(p.avgComments ?? ''),
      String(p.bestPostTime ?? ''),
      String(p.updatedAt ?? ''),
    ]];
  } catch { return []; }
}

// ─── public ─────────────────────────────────────────

export interface ExportOptions {
  personaId: string;
  personaName: string;
  /** 1-indexed (1..12). 省略時は今月 (JST) */
  year?: number;
  month?: number;
}

export function buildMonthlyCsv(opts: ExportOptions): { filename: string; content: string } {
  const now = todayJst();
  const year = opts.year ?? now.getUTCFullYear();
  const month = opts.month ?? (now.getUTCMonth() + 1);
  const periodLabel = `${year}-${String(month).padStart(2, '0')}`;

  const sections: CsvSection[] = [];

  // ヘッダ
  sections.push({
    title: 'CORE Prism — 今月の数字 サマリ',
    headers: ['Field', 'Value'],
    rows: [
      ['期間', periodLabel],
      ['ペルソナ', opts.personaName],
      ['ペルソナ ID', opts.personaId],
      ['出力日時 (JST)', now.toISOString().replace('T', ' ').slice(0, 19)],
    ],
  });

  // CRM Deals
  sections.push({
    title: 'CRM Deals',
    headers: ['Deal ID', 'タイトル / 会社', '連絡先', 'ステージ', '想定金額 (JPY)', '更新日時'],
    rows: readCrmDeals(opts.personaId),
  });

  // タスク
  sections.push({
    title: `今月のタスク (${periodLabel})`,
    headers: ['Task ID', 'タイトル', 'ステータス', '更新日時'],
    rows: readMonthlyTasks(opts.personaId, year, month),
  });

  // キャッシュフロー
  sections.push({
    title: `今月の収支エントリ (${periodLabel})`,
    headers: ['日付', '種類 (income/expense)', 'ラベル', '金額 (JPY)'],
    rows: readCashflowEntries(opts.personaId, year, month),
  });

  // SNS スナップショット (Iris ig profile)
  sections.push({
    title: 'SNS スナップショット (Instagram)',
    headers: ['handle', 'followers', 'avgLikes', 'avgComments', 'bestPostTime', 'updatedAt'],
    rows: readIgSnapshot(),
  });

  // 注記
  sections.push({
    title: 'Stripe 売上 (※ サーバー情報)',
    headers: ['注記'],
    rows: [
      ['Stripe 売上は端末からは取得しません。'],
      ['オーナー宛 朝メール (毎日 JST 6:30) で同期 / Slack 通知 cron で確認可'],
      ['詳細は https://dashboard.stripe.com'],
    ],
  });

  const filename = `core-prism_${opts.personaName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${periodLabel}.csv`;
  return { filename, content: buildCsv(sections) };
}

/** ブラウザでダウンロードさせる */
export function downloadMonthlyCsv(opts: ExportOptions): void {
  const { filename, content } = buildMonthlyCsv(opts);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
