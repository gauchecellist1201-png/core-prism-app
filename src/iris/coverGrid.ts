// ============================================================
// IRIS ▸ 並びプレビュー（グリッド）の実データ収集と「並ぶと読めない」判定
//
// 思想（Later の視覚プランナーの移植）:
//   プロフィールを開いた人が最初に見るのは 1 枚ではなく「並び」。
//   1 枚だけ見ると良いのに、並ぶと崩れる — を出す前に気づけるようにする。
//
// 嘘数字・架空データ禁止:
//   ここが返すのは「本人が実際に投稿済みにしたもの」だけ。
//   1 件も無い時は空配列を返す（見本のダミー画像は絶対に作らない）。
// ============================================================

export interface GridTile {
  id: string;
  /** 画像 (data URL or https)。表示できなかった時は呼び出し側で落とす。 */
  src: string;
  /** 並び順（新しい順）に使う epoch ms */
  at: number;
  /** ツールチップ用の短い説明（キャプション先頭など） */
  label: string;
  from: 'queue' | 'instagram';
  /** true = まだ出していない予約ぶん（マスの隅に日付を出す） */
  planned?: boolean;
}

const QUEUE_KEY = 'iris_post_queue_v1';
const HISTORY_KEY = 'core_iris_posthistory_v1';

function toMs(v: unknown): number {
  if (typeof v !== 'string' || !v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * 「すでに投稿済み」の実物サムネイルを新しい順で返す。
 * ①予約リストで自分が「投稿した」にしたもの（端末内・確実に本人の作ったもの）
 * ②Instagram 連携で取り込んだ本人の投稿サムネイル
 * どちらも無ければ空配列（＝架空の見本は出さない）。
 */
export function loadPostedGrid(limit = 8): GridTile[] {
  if (typeof window === 'undefined') return [];
  const tiles: GridTile[] = [];

  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (!p || typeof p !== 'object' || p.status !== 'posted') continue;
        const src = p.thumbDataUrl || (p.mediaKind === 'image' ? p.mediaDataUrl : '');
        if (typeof src !== 'string' || !src) continue;
        tiles.push({
          id: String(p.id || `q${tiles.length}`),
          src,
          at: toMs(p.scheduledAt) || toMs(p.createdAt),
          label: String(p.caption || '').slice(0, 30),
          from: 'queue',
        });
      }
    }
  } catch { /* 壊れた保存は無いものとして扱う */ }

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (!p || typeof p !== 'object') continue;
        const src = typeof p.thumbUrl === 'string' ? p.thumbUrl : '';
        if (!src) continue;
        tiles.push({
          id: String(p.id || `h${tiles.length}`),
          src,
          at: toMs(p.postedAt),
          label: String(p.title || p.caption || '').slice(0, 30),
          from: 'instagram',
        });
      }
    }
  } catch { /* 同上 */ }

  const seen = new Set<string>();
  return tiles
    .sort((a, b) => b.at - a.at)
    .filter((t) => (seen.has(t.src) ? false : (seen.add(t.src), true)))
    .slice(0, limit);
}

/** 予約ぶんの読み取り結果。並びに出せなかったもの（画像がまだ無い）も正直に数える。 */
export interface PlannedGrid {
  tiles: GridTile[];
  /** 予約はあるが画像がまだ無いので並びに出せなかった件数 */
  withoutImage: number;
}

/**
 * 「これから出る予約ぶん」を、プロフィールに並ぶ順（新しい順＝いちばん先の予約が左上）で返す。
 * 対象は status が scheduled（時刻待ち）と ready（時刻は来たがまだ出していない）だけ。
 * draft（下書き）と skipped は「出す約束をしていない」ので入れない。
 * 画像がまだ無い予約は並びに出さず、件数だけ返す（空のマスを架空に埋めない）。
 */
export function loadPlannedGrid(limit = 8): PlannedGrid {
  if (typeof window === 'undefined') return { tiles: [], withoutImage: 0 };
  const tiles: GridTile[] = [];
  let withoutImage = 0;

  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (!p || typeof p !== 'object') continue;
        if (p.status !== 'scheduled' && p.status !== 'ready') continue;
        const at = toMs(p.scheduledAt);
        if (!at) continue; // 予約時刻が読めないものは「いつ並ぶか」を言えないので出さない
        const src = p.thumbDataUrl || (p.mediaKind === 'image' ? p.mediaDataUrl : '');
        if (typeof src !== 'string' || !src) { withoutImage += 1; continue; }
        tiles.push({
          id: String(p.id || `s${tiles.length}`),
          src,
          at,
          label: String(p.caption || '').slice(0, 30),
          from: 'queue',
          planned: true,
        });
      }
    }
  } catch { /* 壊れた保存は無いものとして扱う */ }

  const seen = new Set<string>();
  return {
    tiles: tiles
      .sort((a, b) => b.at - a.at)
      .filter((t) => (seen.has(t.src) ? false : (seen.add(t.src), true)))
      .slice(0, limit),
    withoutImage,
  };
}

/** マスの隅に出す日付。「8/12」だけ（年・時刻は並びの判断に要らない）。 */
export function plannedDateLabel(at: number): string {
  if (!at || !Number.isFinite(at)) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export interface Legibility {
  /** 並びの中での見出しの実寸(px) */
  effPx: number;
  level: 'ok' | 'warn' | 'bad';
  msg: string;
}

/**
 * 「並ぶと読めなくなる」の判定。
 * 表紙は 1080px 幅で作っているが、並びの中では 100px 前後まで縮む。
 * 縮んだ後の見出しの実寸で判定する（推定ではなく、実際に描いた文字サイズ × 縮小率）。
 */
export function gridLegibility(titlePx: number, canvasW: number, cellPx: number): Legibility {
  if (!titlePx || !canvasW || !cellPx) return { effPx: 0, level: 'ok', msg: '' };
  const effPx = Math.round((titlePx * (cellPx / canvasW)) * 10) / 10;
  // しきい値は「太字の見出しがこの画面で読めるか」の実測から。
  // 表紙は 1080px 幅で作るが、並びの中では 100px 前後まで縮む＝約 1/11。
  // 見出しが長いほど自動で小さくなるので、長さがそのまま読めなさに直結する。
  if (effPx < 6) {
    return {
      effPx,
      level: 'bad',
      msg: `並びの中では見出しが約 ${effPx}px になります。この大きさでは読めません。見出しを短くすると、そのぶん文字が大きくなります。`,
    };
  }
  if (effPx < 8) {
    return {
      effPx,
      level: 'warn',
      msg: `並びの中では見出しが約 ${effPx}px です。少し小さいので、見出しをもう数文字短くすると読みやすくなります。`,
    };
  }
  return { effPx, level: 'ok', msg: `並びの中でも見出しは約 ${effPx}px あります。読める大きさです。` };
}

/** プロフィールの並びは 4:5 で切り取られる。今の比率だと上下・左右がどれだけ切れるか。 */
export function cropNote(aspect: string): string {
  if (aspect === '9:16') return '9:16 で作っているので、並びでは上下が大きく切り取られます（プロフィールの並びは 4:5）。文字が中央寄りだと切れにくくなります。';
  if (aspect === '1:1') return '正方形で作っているので、並びでは左右がわずかに切り取られます（プロフィールの並びは 4:5）。';
  return '';
}
