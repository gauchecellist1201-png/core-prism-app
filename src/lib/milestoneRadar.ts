// ============================================================
// milestoneRadar — 「節目が来たら、こちらから言う」「あるはずの物が無いことに気づく」
//                   (2026-08-01)
//
// なぜ要るか（競合3社から連続で同じ指摘）:
//   Notion AI / freee / マネーフォワード の3社とも「人が開かなくても、
//   節目（月末・締切・支払日・請求日）で自分から動く」を売りにしている。
//   Prism は「開いた時に1日1回」提案を作るだけで、8月1日に開いても
//   「おはよう」としか言わなかった。7月が締まった日なのに。
//
// 設計の芯（ここを崩さないこと）:
//   ・**AIを一切使わない。** すべて日付とデータからコードで確定させる。
//     節目や「入金ゼロ」は、外したら信用が消える種類の情報なので、
//     文章生成にゆだねない（＝ありもしない締切を作らない）。
//   ・**誤報を出すくらいなら黙る。** 判定できない時は必ず空を返す。
//     月初に「今月の入金が0円です」と言うのは誤報（当たり前だから）。
//     → 5日以降まで待つガードを入れている。
//   ・戻り値が0件なら、呼び出し側はカードごと出さない（空の器を作らない）。
// ============================================================

export type RadarKind =
  | 'month-open'    // 前の月が締まった（月初）
  | 'month-close'   // 今月の締めが近い（月末）
  | 'cal-deadline'  // カレンダーにある、お金・期限の予定
  | 'revenue-zero'  // 先月はあったのに、今月の入金がまだ0円
  | 'stalled-reply'; // 相手の発言で止まっていて、こちらが返していない

export interface RadarRow {
  kind: RadarKind;
  tone: 'alert' | 'idea';
  title: string;
  detail: string;
  /** 見出しの右に小さく出す（「あと3日」など） */
  when?: string;
  /** 「タスクに入れる」で入る文言 */
  task: string;
}

// ─── 日付まわり（すべて端末のローカル時刻＝使う人の暦で判定する） ───

export interface MonthParts {
  year: number;
  month: number;      // 1-12
  day: number;        // 1-31
  lastDay: number;    // 今月の最終日
  daysLeft: number;   // 今月の最終日まであと何日（最終日なら0）
  prevYear: number;
  prevMonth: number;  // 1-12
  /** 'YYYY-MM' */
  key: string;
  prevKey: string;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

export function monthParts(now: Date): MonthParts {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const lastDay = new Date(year, month, 0).getDate();
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return {
    year, month, day, lastDay,
    daysLeft: lastDay - day,
    prevYear, prevMonth,
    key: `${year}-${pad2(month)}`,
    prevKey: `${prevYear}-${pad2(prevMonth)}`,
  };
}

/** 「今日」「明日」「あと3日」。過ぎている物はここへ渡さない。 */
export function relativeDayLabel(days: number): string {
  if (days <= 0) return '今日';
  if (days === 1) return '明日';
  return `あと${days}日`;
}

/** 日付だけの差（時刻は無視）。カレンダー予定の「あと何日」用。 */
export function calendarDayDiff(now: Date, target: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

// ─── ① 月の節目（連携ゼロでも必ず出せる。ここが「自分から動く」の土台） ───

/** 月初の何日目まで「前の月が締まりました」を出すか */
const MONTH_OPEN_WINDOW = 5;
/** 月末の何日前から「締めが近い」を出すか */
const MONTH_CLOSE_WINDOW = 3;

export function monthMilestoneRows(now: Date): RadarRow[] {
  const p = monthParts(now);
  const out: RadarRow[] = [];

  if (p.day <= MONTH_OPEN_WINDOW) {
    out.push({
      kind: 'month-open',
      tone: 'idea',
      when: `${p.month}/${p.day}`,
      title: `${p.prevMonth}月が締まりました`,
      detail:
        `${p.prevMonth}月ぶんの請求は、もう全部出し終わっていますか。` +
        `出し忘れた1件は、誰も教えてくれないまま取りっぱぐれになります。`,
      task: `${p.prevMonth}月ぶんの請求もれがないか確認する`,
    });
  }

  if (p.daysLeft <= MONTH_CLOSE_WINDOW && p.day > MONTH_OPEN_WINDOW) {
    const isLast = p.daysLeft === 0;
    out.push({
      kind: 'month-close',
      tone: 'idea',
      when: isLast ? '今日' : `あと${p.daysLeft}日`,
      title: isLast
        ? `今日が${p.month}月の最終日です`
        : `${p.month}月の締めまで、あと${p.daysLeft}日`,
      detail:
        `${p.month}月${p.lastDay}日で今月が終わります。` +
        `まだ出していない請求書があれば、今月のうちに出すと入金が1ヶ月早くなります。`,
      task: `${p.month}月ぶんの請求書を今月中に出す`,
    });
  }

  return out;
}

// ─── ② カレンダーにある「お金と期限」の予定 ───

export interface RadarCalEvent {
  id: string;
  summary: string;
  start: string; // ISO
}

/** 予定名にこれが入っていたら「節目」とみなす（種類ごとに言い方を変える） */
const DEADLINE_GROUPS: { words: string[]; note: string }[] = [
  {
    words: ['請求', '納品', '締切', '締め切り', '〆切', '〆', '期限', '提出'],
    note: '期限のある予定です。前日までに終わらせておくと、当日あわてません。',
  },
  {
    words: ['支払', '入金', '振込', '振替', '引き落とし', '決済', '返済'],
    note: 'お金が動く予定です。残高を先に確かめておくと安全です。',
  },
  {
    words: ['契約', '更新', '解約', '満了'],
    note: '契約の節目です。条件を見直すなら、この日より前にしか動けません。',
  },
  {
    words: ['決算', '確定申告', '納税', '申告'],
    note: '税と決算の予定です。必要な書類が手元にそろっているか、今日のうちに確かめておきましょう。',
  },
];

function matchDeadline(summary: string): string | null {
  for (const g of DEADLINE_GROUPS) {
    if (g.words.some((w) => summary.includes(w))) return g.note;
  }
  return null;
}

/** 直近 withinDays 日ぶんの予定から、お金・期限に関わるものを拾う */
export function calendarMilestoneRows(
  now: Date,
  events: RadarCalEvent[],
  withinDays = 7,
  max = 3,
): RadarRow[] {
  const rows: { days: number; row: RadarRow }[] = [];

  for (const ev of events) {
    const summary = (ev.summary || '').trim();
    if (!summary) continue;
    const note = matchDeadline(summary);
    if (!note) continue;

    const at = new Date(ev.start);
    if (Number.isNaN(at.getTime())) continue;
    const days = calendarDayDiff(now, at);
    if (days < 0 || days > withinDays) continue;

    rows.push({
      days,
      row: {
        kind: 'cal-deadline',
        tone: days <= 1 ? 'alert' : 'idea',
        when: relativeDayLabel(days),
        title: summary.length > 40 ? `${summary.slice(0, 40)}…` : summary,
        detail: `カレンダーの予定です（${at.getMonth() + 1}月${at.getDate()}日）。${note}`,
        task: `${summary} の準備をする`,
      },
    });
  }

  rows.sort((a, b) => a.days - b.days);
  return rows.slice(0, max).map((r) => r.row);
}

// ─── ③ 欠け: 先月はあったのに、今月の入金がまだ0円 ───

export interface RadarMonthlyPoint { month: string; mrrJpy: number }

/**
 * 月初は「まだ0円」が当たり前なので、REVENUE_ZERO_FROM_DAY 日を過ぎるまで黙る。
 * ここを外すと毎月1日に必ず誤報が出て、カード全体が信用されなくなる。
 */
const REVENUE_ZERO_FROM_DAY = 5;

export function revenueGapRow(
  now: Date,
  monthly: RadarMonthlyPoint[] | null | undefined,
  fmtJpy: (n: number) => string,
): RadarRow | null {
  if (!monthly || monthly.length === 0) return null;
  const p = monthParts(now);
  if (p.day < REVENUE_ZERO_FROM_DAY) return null;

  const prev = monthly.find((m) => m.month === p.prevKey);
  if (!prev || prev.mrrJpy <= 0) return null; // 比べる相手がいない＝何も言わない

  const cur = monthly.find((m) => m.month === p.key);
  if (cur && cur.mrrJpy > 0) return null;

  return {
    kind: 'revenue-zero',
    tone: 'alert',
    when: `${p.month}/${p.day}時点`,
    title: `${p.prevMonth}月はあったのに、${p.month}月の入金がまだ0円です`,
    detail:
      `${p.prevMonth}月は ${fmtJpy(prev.mrrJpy)} 入っていました。` +
      `請求の出し忘れ・解約・入金の遅れのどれかです。${p.day}日で0円は、確かめたほうがいい合図です。`,
    task: `${p.month}月の入金が0円の理由を確かめる（請求もれ／解約／入金待ち）`,
  };
}

// ─── ④ 欠け: 返事が止まっている相手 ───

export interface StalledThread {
  threadId: string;
  /** 相手の表示名（無ければメールアドレス） */
  who: string;
  subject: string;
  /** 相手の最後の発言からの日数 */
  days: number;
}

export function stalledReplyRows(threads: StalledThread[], max = 2): RadarRow[] {
  return [...threads]
    .sort((a, b) => b.days - a.days)
    .slice(0, max)
    .map((t) => ({
      kind: 'stalled-reply' as const,
      tone: t.days >= 7 ? ('alert' as const) : ('idea' as const),
      when: `${t.days}日`,
      title: `${t.who} さんに、まだ返せていません`,
      detail:
        `件名「${t.subject || '(件名なし)'}」。` +
        `最後に発言したのは相手で、${t.days}日たっています。返事が止まると、その話はそのまま消えます。`,
      task: `${t.who} さんへ返信する（件名: ${t.subject || '(件名なし)'}）`,
    }));
}

// ─── まとめ（優先順位つき・出しすぎない） ───

/** 上ほど先に出す。困っている物 → 期限が近い物 → 節目、の順 */
const KIND_ORDER: RadarKind[] = [
  'revenue-zero',
  'cal-deadline',
  'stalled-reply',
  'month-close',
  'month-open',
];

export function sortRadarRows(rows: RadarRow[]): RadarRow[] {
  return [...rows].sort((a, b) => {
    // 今日・明日の予定は、どの種類よりも先に出す
    const urgent = (r: RadarRow) =>
      r.kind === 'cal-deadline' && (r.when === '今日' || r.when === '明日') ? 0 : 1;
    const u = urgent(a) - urgent(b);
    if (u !== 0) return u;
    return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  });
}

export interface RadarInput {
  now: Date;
  events?: RadarCalEvent[];
  monthly?: RadarMonthlyPoint[] | null;
  stalled?: StalledThread[];
  fmtJpy: (n: number) => string;
}

/** 画面に出す最大件数。多すぎると全部読まれなくなる */
export const RADAR_MAX_ROWS = 4;

export function buildRadar(input: RadarInput): RadarRow[] {
  const rows: RadarRow[] = [
    ...monthMilestoneRows(input.now),
    ...calendarMilestoneRows(input.now, input.events || []),
    ...stalledReplyRows(input.stalled || []),
  ];
  const gap = revenueGapRow(input.now, input.monthly, input.fmtJpy);
  if (gap) rows.push(gap);

  return sortRadarRows(rows).slice(0, RADAR_MAX_ROWS);
}
