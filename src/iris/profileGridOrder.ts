// ============================================================
// IRIS ▸ 予約グリッドを「実際にプロフィールへ並ぶ順」で組み立てる
//
// なぜ要るか（2026-09-08 実測）:
//   予約画面のグリッド表示は `queue.upcoming()` の並び — つまり
//   ready → scheduled の**古い順** → 下書き — をそのまま左上から敷いていた。
//   ところが Instagram のプロフィールは**新しいものが左上**。
//   ＝「公開前に仕上がりが見える」はずの画面が、**実際とは逆の並び**を見せていた。
//   さらに、自分の投稿済みが一切下に無いので「今のフィードの上に、これが乗る」
//   という肝心の絵にならない（Later の視覚プランナーの価値はそこにしかない）。
//
// 大事な約束:
//   ・並べるのは「出す約束をしたもの」だけ（scheduled / ready）。
//     下書きは並びに入れず、件数だけ正直に返す（勝手に位置を与えると嘘になる）。
//   ・画像がまだ無い予約は**マスを作らない**（架空の絵で埋めない）。件数だけ返す。
//   ・投稿済みは予約の**うしろ**に置く。並べ替えない・触らせない（過去は動かない）。
//   ・同じ画像が予約と投稿済みの両方にある時は予約側を残す（同じ絵を2回出さない）。
//   ・新しい保存先を作らない。読むのは既存の予約リストと coverGrid の投稿済みだけ。
// ============================================================
import type { GridTile } from './coverGrid';

export interface ProfileGridCell {
  /** React の key（重複しない） */
  key: string;
  kind: 'planned' | 'posted';
  /** 画像 (data URL or https) */
  src: string;
  /** 並び順に使った epoch ms */
  at: number;
  /** マスに重ねる短い説明（キャプション先頭など） */
  label: string;
  /** planned のみ: 予約の id（タップでキャプションをコピーする先） */
  postId?: string;
}

export interface ProfileGridPlan {
  cells: ProfileGridCell[];
  /** 実際に並びへ出した予約の枚数 */
  plannedShown: number;
  /** 実際に並びへ出した投稿済みの枚数 */
  postedShown: number;
  /** 予約はあるが画像がまだ無いので並びに出せなかった件数 */
  plannedWithoutImage: number;
  /** 下書き＝出す約束をしていないので並びに入れなかった件数 */
  draftsHidden: number;
}

/** 予約リストの要素。テストから素のオブジェクトを渡せるよう最小限の形だけ見る。 */
interface QueuePostLike {
  id?: unknown;
  status?: unknown;
  scheduledAt?: unknown;
  caption?: unknown;
  thumbDataUrl?: unknown;
  mediaDataUrl?: unknown;
  mediaKind?: unknown;
}

/** coverGrid.ts と同じ読み方（日付の解釈を2通り持たない） */
function toMs(v: unknown): number {
  if (typeof v !== 'string' || !v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function imageOf(p: QueuePostLike): string {
  const thumb = p.thumbDataUrl;
  if (typeof thumb === 'string' && thumb) return thumb;
  if (p.mediaKind === 'image' && typeof p.mediaDataUrl === 'string' && p.mediaDataUrl) return p.mediaDataUrl;
  return '';
}

const DEFAULT_LIMIT = 12;

/**
 * 予約（出す約束をしたもの）を新しい順＝**いちばん先の予約が左上**に並べ、
 * そのうしろに投稿済みを付けて、プロフィールの見え方をそのまま返す。
 *
 * @param posts  予約リスト（usePostQueue の posts をそのまま渡してよい）
 * @param posted coverGrid の loadPostedGrid() が返した投稿済みサムネ
 * @param limit  出すマスの総数（3列なので既定は 12 ＝ 4 行）
 */
export function buildProfileGrid(
  posts: readonly QueuePostLike[] | null | undefined,
  posted: readonly GridTile[] | null | undefined,
  limit: number = DEFAULT_LIMIT,
): ProfileGridPlan {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit as number)) : DEFAULT_LIMIT;

  const planned: ProfileGridCell[] = [];
  let plannedWithoutImage = 0;
  let draftsHidden = 0;

  if (Array.isArray(posts)) {
    posts.forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      if (p.status === 'draft') { draftsHidden += 1; return; }
      if (p.status !== 'scheduled' && p.status !== 'ready') return;
      const at = toMs(p.scheduledAt);
      if (!at) return;                       // いつ並ぶか言えないものは並びに出さない
      const src = imageOf(p);
      if (!src) { plannedWithoutImage += 1; return; }  // 空のマスを架空に埋めない
      const id = typeof p.id === 'string' && p.id ? p.id : `s${i}`;
      planned.push({
        key: `planned:${id}`,
        kind: 'planned',
        src,
        at,
        label: typeof p.caption === 'string' ? p.caption.slice(0, 30) : '',
        postId: id,
      });
    });
  }

  planned.sort((a, b) => b.at - a.at);       // 新しい順（＝いちばん先の予約が左上）

  const seen = new Set<string>();
  const cells: ProfileGridCell[] = [];
  for (const c of planned) {
    if (seen.has(c.src)) continue;
    seen.add(c.src);
    cells.push(c);
  }
  const plannedTotal = cells.length;

  if (Array.isArray(posted)) {
    const done: ProfileGridCell[] = [];
    posted.forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      const src = typeof t.src === 'string' ? t.src : '';
      if (!src || seen.has(src)) return;     // 予約と同じ絵は2回出さない
      seen.add(src);
      const id = typeof t.id === 'string' && t.id ? t.id : `h${i}`;
      done.push({
        key: `posted:${id}`,
        kind: 'posted',
        src,
        at: Number.isFinite(t.at) ? t.at : 0,
        label: typeof t.label === 'string' ? t.label : '',
      });
    });
    done.sort((a, b) => b.at - a.at);
    cells.push(...done);
  }

  const shown = cells.slice(0, max);
  const plannedShown = Math.min(plannedTotal, shown.length);
  return {
    cells: shown,
    plannedShown,
    postedShown: shown.length - plannedShown,
    plannedWithoutImage,
    draftsHidden,
  };
}
