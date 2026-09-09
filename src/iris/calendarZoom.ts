// ============================================================
// CORE Iris ▸ 予約カレンダーの「全体 ↔ 精密」ズーム
// ------------------------------------------------------------
// BACKLOG「2本指ピンチで時間軸ズーム」(CapCut) の計算だけをここに置く。
// 画面 (IrisPostQueueView) には日付の当たり判定を1行も持たせない。
//
// 決めごと (壊すと嘘になるもの):
//   ・段は 月 → 週 → 日 の3つだけ。端では止まる (月から外へ・日から中へ行かない)
//   ・指の動きは「一定以上ひらいた/とじた時だけ」1段動く。
//     ちょっと触れただけで段が飛ぶと、見ている場所が勝手に変わる
//   ・段を変えても「見ている日」は変えない。週/日へ降りる時は
//     選んでいる日 → きょう → いま見ている場所、の順に寄せる
//     (どこでもない日へ飛ばさない)
//   ・日付は必ずローカル時刻で作る。ISO の文字列を切って使わない
//     (+9h ずれて前日になる。既存 localDayKey と同じ作法)
// ============================================================

/** 時間軸の段。狭いほど1件ずつ細かく見える */
export type CalZoom = 'month' | 'week' | 'day';

/** 広い → 狭い。両端で止まる */
export const ZOOM_ORDER: CalZoom[] = ['month', 'week', 'day'];

export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** ひらく = 細かく見る (月→週→日)。日より内側は無い */
export function zoomIn(z: CalZoom): CalZoom {
  const i = ZOOM_ORDER.indexOf(z);
  if (i < 0) return 'month';
  return ZOOM_ORDER[Math.min(i + 1, ZOOM_ORDER.length - 1)];
}

/** とじる = 全体を見る (日→週→月)。月より外側は無い */
export function zoomOut(z: CalZoom): CalZoom {
  const i = ZOOM_ORDER.indexOf(z);
  if (i < 0) return 'month';
  return ZOOM_ORDER[Math.max(i - 1, 0)];
}

/** 2本指の間の距離。座標が数でなければ 0 (＝ジェスチャ扱いしない) */
export function pinchDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  return Math.hypot(dx, dy);
}

/** ここまで開いたら1段細かく / ここまで閉じたら1段広く */
export const PINCH_IN_RATIO = 1.25;
export const PINCH_OUT_RATIO = 0.8;

/**
 * 指の開き具合から、動かす段数を返す。
 *   +1 = 細かく (ひらいた) / -1 = 広く (とじた) / 0 = まだ動かさない
 * 1回の判定で必ず1段まで。まとめて2段飛ばさない。
 */
export function pinchStep(startDistance: number, currentDistance: number): -1 | 0 | 1 {
  if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) return 0;
  if (startDistance <= 0 || currentDistance <= 0) return 0;
  const ratio = currentDistance / startDistance;
  if (ratio >= PINCH_IN_RATIO) return 1;
  if (ratio <= PINCH_OUT_RATIO) return -1;
  return 0;
}

/** その日の 00:00 (ローカル) */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** その週のはじまり = 日曜 00:00 (カレンダーの曜日ヘッダと同じ並び) */
export function weekStart(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/** その週の7日ぶん (日曜はじまり) */
export function weekCells(d: Date): Date[] {
  const s = weekStart(d);
  return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
}

/** ◀ ▶ で動く量は、いま見ている段の1つぶん (月なら1か月・週なら7日・日なら1日) */
export function shiftByZoom(cursor: Date, zoom: CalZoom, dir: number): Date {
  const n = Math.trunc(dir) || 0;
  if (zoom === 'month') return new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
  if (zoom === 'week') return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + n * 7);
  return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + n);
}

/** 'YYYY-MM-DD' → Date (ローカル)。読めなければ null */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  // 2026-02-31 のような「存在しない日」を弾く (Date が黙って3月へ繰り上げるため)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/**
 * 段を変えた時に「どの日を見ているか」を決める。
 * 月へ上がる時は動かさない。週/日へ降りる時は
 *   選んでいる日 → (いま見ている月の中の) きょう → いま見ている場所
 * の順。どこでもない日へ飛ばさない。
 */
export function anchorOnZoomChange(next: CalZoom, cursor: Date, selectedDayKey: string, today: Date): Date {
  if (next === 'month') return cursor;
  const picked = parseDayKey(selectedDayKey);
  if (picked) return picked;
  if (sameMonth(cursor, today)) return startOfDay(today);
  return startOfDay(cursor);
}

/** 見出し。月は「2026年9月」、週は「9月7日 - 9月13日」、日は「9月9日(火)」 */
export function zoomLabel(cursor: Date, zoom: CalZoom): string {
  if (zoom === 'month') return `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月`;
  if (zoom === 'day') {
    return `${cursor.getMonth() + 1}月${cursor.getDate()}日 (${WEEKDAY_JA[cursor.getDay()]})`;
  }
  const cells = weekCells(cursor);
  const a = cells[0];
  const b = cells[6];
  const head = a.getFullYear() === b.getFullYear() ? '' : `${a.getFullYear()}年 `;
  return `${head}${a.getMonth() + 1}月${a.getDate()}日 - ${b.getMonth() + 1}月${b.getDate()}日`;
}

/** ◀ ▶ の読み上げ文 (段によって動く量が変わるので、そのまま言う) */
export function navLabel(zoom: CalZoom, dir: -1 | 1): string {
  const unit = zoom === 'month' ? '月' : zoom === 'week' ? '週' : '日';
  return dir < 0 ? `前の${unit}` : `次の${unit}`;
}
