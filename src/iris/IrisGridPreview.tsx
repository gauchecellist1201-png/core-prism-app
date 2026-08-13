// ============================================================
// IRIS ▸ 並びプレビュー（Later の視覚プランナーの移植）
//
// 出す前に「プロフィールに並んだ時の見え方」を見せる。
// ・左上が今つくっている表紙、その右と下に投稿済みの直近8本（実データのみ）
// ・投稿が無い時は架空の見本を出さず、正直にそう書く（空っぽ3点セット）
// ・並びの中で見出しが読めない大きさになる時は、その場で小さく知らせる
// ・気に入らなければ「文字を直す」で編集に戻れる（行き止まりにしない）
// ・並びを見て「これは後だな」と思ったら、その場で予約の順番を入れ替えられる
//   （動かせるのは予約だけ・枠＝時刻はその場に残り中身だけ入れ替わる・10秒だけ元に戻せる）
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, PencilLine, AlertTriangle, CheckCircle2, Images, ArrowLeftRight, Undo2, X } from 'lucide-react';
import { loadPostedGrid, loadPlannedGrid, plannedDateLabel, gridLegibility, cropNote, type GridTile } from './coverGrid';
import { applySlotSwap, applySlotRestore, QUEUE_CHANGED_EVENT, type SlotSnapshot } from './gridReorder';
import { accentFaceBg, accentFaceInk } from './irisStyle';

interface Props {
  /** いま作っている表紙（canvas の書き出し） */
  currentSrc: string;
  /** 実際に描かれた見出しの文字サイズ(px) と キャンバス幅(px) */
  titlePx: number;
  canvasW: number;
  aspect: string;
  ink: string;
  inkSoft: string;
  accent: string;
  card: string;
  cardBorder: string;
  onFixText: () => void;
}

export default function IrisGridPreview({
  currentSrc, titlePx, canvasW, aspect, ink, inkSoft, accent, card, cardBorder, onFixText,
}: Props) {
  const [tiles, setTiles] = useState<GridTile[]>([]);
  const [plannedNoImage, setPlannedNoImage] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [cellPx, setCellPx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // 入れ替え: いま掴んでいる予約 / 直前の入れ替え（10秒だけ元に戻せる） / 画面に出す一言
  const [heldId, setHeldId] = useState<string | null>(null);
  const [undoSnap, setUndoSnap] = useState<SlotSnapshot[] | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);
  const undoTimer = useRef<number | null>(null);

  // 「これから出る予約ぶん」を先に、そのうしろに投稿済み。
  // ＝プロフィールを開いた人が来週見る並びが、そのままここに出る。
  useEffect(() => {
    const load = () => {
      const planned = loadPlannedGrid(8);
      const usedSrc = new Set(planned.tiles.map((t) => t.src));
      const posted = loadPostedGrid(8).filter((t) => !usedSrc.has(t.src));
      setTiles([...planned.tiles, ...posted].slice(0, 8));
      setPlannedNoImage(planned.withoutImage);
    };
    load();
    // 予約リストは別画面でも、この画面の入れ替えでも変わる。
    // storage イベントは別タブぶんしか飛ばないので、同じタブぶんは合図を別に受ける。
    const onStorage = (e: StorageEvent) => { if (e.key === 'iris_post_queue_v1') load(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(QUEUE_CHANGED_EVENT, load);
    };
  }, []);

  // 「元に戻す」は 10 秒で消える。画面を離れた時にタイマーを残さない。
  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);

  // マスの実寸を測る（推定しない。実際に画面で何 px かで読めるかを判定する）
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector('[data-cell]') as HTMLElement | null;
      if (first) setCellPx(Math.round(first.getBoundingClientRect().width));
    };
    measure();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } catch { window.addEventListener('resize', measure); }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, []);

  const shown = tiles.filter((t) => !broken.has(t.id));
  const plannedCount = shown.filter((t) => t.planned).length;
  const leg = gridLegibility(titlePx, canvasW, cellPx);
  const crop = cropNote(aspect);
  const cells = 9;
  // 入れ替えは「予約が2件以上あるとき」だけ意味がある（1件しか無い時は何も出さない）
  const canSwap = plannedCount >= 2;
  const held = heldId ? shown.find((t) => t.id === heldId && t.planned) : undefined;

  const armUndoTimer = () => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => { setUndoSnap(null); setNotice(null); }, 10_000);
  };

  // 予約のマスを押した時: 1回目＝掴む / 2回目＝そこへ入れる（同じマスなら掴むのをやめる）
  const onTapPlanned = (t: GridTile) => {
    if (!canSwap) return;
    if (!heldId) { setHeldId(t.id); setNotice(null); return; }
    if (heldId === t.id) { setHeldId(null); return; }

    const fromDay = plannedDateLabel(held?.at || 0);
    const toDay = plannedDateLabel(t.at);
    const out = applySlotSwap(heldId, t.id);
    setHeldId(null);
    if (!out.ok) {
      // 書けていないのに「入れ替えました」とは言わない
      setUndoSnap(null);
      setNotice({
        tone: 'bad',
        text: out.reason === 'save-failed'
          ? '入れ替えを保存できませんでした（端末の空き容量）。並びは元のままです。予約リストで古い投稿を消してから、もう一度お試しください。'
          : 'この2つは入れ替えられませんでした。並びは元のままです（動かせるのは、まだ出していない予約どうしだけです）。',
      });
      return;
    }
    setUndoSnap(out.before);
    setNotice({
      tone: 'ok',
      text: `${fromDay} と ${toDay} を入れ替えました。時刻はどちらもその場に残っていて、出す中身だけが入れ替わっています。`,
    });
    armUndoTimer();
  };

  const onUndo = () => {
    if (!undoSnap) return;
    const ok = applySlotRestore(undoSnap);
    setUndoSnap(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setNotice(ok
      ? { tone: 'ok', text: '入れ替える前の順番に戻しました。' }
      : { tone: 'bad', text: '元に戻せませんでした（端末の空き容量）。予約リストから時刻を直してください。' });
  };

  const cellBase: React.CSSProperties = {
    aspectRatio: '4 / 5', borderRadius: 4, overflow: 'hidden', background: '#F4EEF2',
    border: `1px solid ${cardBorder}`, position: 'relative',
  };

  return (
    <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '0.95rem 1rem', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LayoutGrid size={15} color={accent} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: ink }}>③ 並んだ時の見え方</span>
        <span style={{ fontSize: 11, color: inkSoft }}>
          {plannedCount > 0
            ? '予約ぶんも入れた「これからのプロフィール」です。出す前にしか直せません'
            : 'プロフィールを開いた人が最初に見るのは、1枚ではなく並びです'}
        </span>
      </div>

      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, maxWidth: 360 }}>
        {Array.from({ length: cells }).map((_, i) => {
          if (i === 0) {
            return (
              <div key="cur" data-cell style={{ ...cellBase, border: `2px solid ${accent}`, background: '#EFE7EE' }}>
                {currentSrc
                  ? <img src={currentSrc} alt="いま作っている表紙" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 9.5, color: inkSoft }}>準備中</span>}
                <span style={{
                  position: 'absolute', left: 3, top: 3, background: accentFaceBg(accent), color: accentFaceInk(accent),
                  fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 6px', lineHeight: 1.2,
                }}>いま作成中</span>
              </div>
            );
          }
          const t = shown[i - 1];
          if (t) {
            const day = t.planned ? plannedDateLabel(t.at) : '';
            const isHeld = heldId === t.id;
            const movable = !!t.planned && canSwap;
            const img = (
              <img
                src={t.src}
                alt={t.planned ? `${day} に出す予約` : (t.label || '投稿済み')}
                title={t.planned ? `${day} の予約 ${t.label}`.trim() : t.label}
                onError={() => setBroken((prev) => new Set(prev).add(t.id))}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            );
            const dayBadge = day ? (
              <span style={{
                position: 'absolute', right: 3, top: 3, background: 'rgba(17,10,15,0.72)', color: '#fff',
                fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 5px', lineHeight: 1.2,
              }}>{day}</span>
            ) : null;

            if (!movable) {
              return (
                <div key={t.id} data-cell style={cellBase}>
                  {img}
                  {dayBadge}
                </div>
              );
            }
            return (
              <button
                key={t.id}
                data-cell
                data-planned-cell={t.id}
                type="button"
                onClick={() => onTapPlanned(t)}
                aria-pressed={isHeld}
                aria-label={isHeld
                  ? `${day} の予約を動かしています。入れたい場所の予約を押してください（もう一度押すとやめます）`
                  : (heldId ? `${day} の予約と入れ替える` : `${day} の予約。押すと動かせます`)}
                style={{
                  ...cellBase, padding: 0, cursor: 'pointer', appearance: 'none', touchAction: 'manipulation',
                  // 枠は box-shadow で描く（border を太らせるとマスの大きさが変わって並びがずれる）
                  boxShadow: isHeld
                    ? `inset 0 0 0 3px ${accent}, 0 2px 10px rgba(17,10,15,0.18)`
                    : (heldId ? `inset 0 0 0 2px ${accent}66` : 'none'),
                }}
              >
                {img}
                {dayBadge}
                {isHeld && (
                  <span style={{
                    position: 'absolute', left: 3, bottom: 3, background: accentFaceBg(accent), color: accentFaceInk(accent),
                    fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 6px', lineHeight: 1.2,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <ArrowLeftRight size={9} /> 動かす
                  </span>
                )}
                {!isHeld && heldId && (
                  <span style={{
                    position: 'absolute', left: 3, bottom: 3, background: 'rgba(255,255,255,0.92)', color: '#3B2A34',
                    fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 6px', lineHeight: 1.2,
                  }}>ここへ</span>
                )}
              </button>
            );
          }
          return <div key={`e${i}`} data-cell style={{ ...cellBase, background: 'repeating-linear-gradient(135deg, #F7F2F5 0 6px, #F1E9EE 6px 12px)' }} />;
        })}
      </div>

      {/* 並びを見て気づいたことを、その場で直す（別画面へ行くと気づきが消える） */}
      {canSwap && (
        <div style={{ display: 'grid', gap: 7 }}>
          <p style={{ margin: 0, fontSize: 11, color: heldId ? ink : inkSoft, lineHeight: 1.55, fontWeight: heldId ? 700 : 400 }}>
            {heldId
              ? '入れたい場所の予約を押してください。もう一度おなじマスを押すと、動かすのをやめます。'
              : `日付のついた予約 ${plannedCount} 件は、ここで順番を入れ替えられます。動かしたい予約を押して、入れたい場所の予約をもう一度押してください。時刻はその場に残り、出す中身だけが入れ替わります（投稿済みは動かせません）。`}
          </p>
          {heldId && (
            <button
              type="button"
              onClick={() => setHeldId(null)}
              style={{
                justifySelf: 'start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6,
                border: `1px solid ${cardBorder}`, background: '#fff', color: ink, borderRadius: 12,
                padding: '0.55rem 0.95rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <X size={13} color={inkSoft} /> 動かすのをやめる
            </button>
          )}
        </div>
      )}

      {/* 入れ替えの結果。うまくいかなかった時は、うまくいったふりをしない */}
      <div aria-live="polite" style={{ display: notice ? 'grid' : 'none', gap: 8 }}>
        {notice && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: '0.6rem 0.75rem',
            background: notice.tone === 'ok' ? 'rgba(22,128,86,0.06)' : 'rgba(200,16,46,0.06)',
            border: `1px solid ${notice.tone === 'ok' ? 'rgba(22,128,86,0.28)' : 'rgba(200,16,46,0.28)'}`,
          }}>
            {notice.tone === 'ok'
              ? <CheckCircle2 size={14} color="#168056" style={{ flexShrink: 0, marginTop: 2 }} />
              : <AlertTriangle size={14} color="#C8102E" style={{ flexShrink: 0, marginTop: 2 }} />}
            <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.55, fontWeight: 600, color: notice.tone === 'ok' ? '#0F5F40' : '#C8102E' }}>
              {notice.text}
            </span>
          </div>
        )}
        {undoSnap && (
          <button
            type="button"
            onClick={onUndo}
            style={{
              justifySelf: 'start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${accent}`, background: '#fff', color: accent, borderRadius: 12,
              padding: '0.6rem 1rem', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
            }}
          >
            <Undo2 size={14} /> 元に戻す
          </button>
        )}
      </div>

      {/* 実データが1件も無い時：架空の見本は出さず、正直に書いて次の一手を1つだけ置く */}
      {shown.length === 0 ? (
        <div style={{ display: 'grid', gap: 8, background: `${accent}0A`, border: `1px solid ${accent}22`, borderRadius: 12, padding: '0.7rem 0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Images size={15} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: ink, lineHeight: 1.5 }}>まだ並べる投稿がありません</p>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: inkSoft, lineHeight: 1.55 }}>
                これから出す予約（画像がついたもの）と、予約リストで「投稿した」にした分、Instagram 連携で取り込んだ投稿が、ここに並びます。見本の画像は出しません（実際のあなたの並びだけを見せるためです）。
              </p>
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('iris:goto-tab', { detail: { tab: 'schedule' } }))}
            style={{
              justifySelf: 'start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${accent}`, background: '#fff', color: accent, borderRadius: 12,
              padding: '0.6rem 1rem', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
            }}
          >
            予約リストを開く
          </button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: inkSoft, lineHeight: 1.5 }}>
          {plannedCount > 0
            ? `これから出る予約 ${plannedCount} 件（日付つき）を先に、そのうしろに投稿済み ${shown.length - plannedCount} 件を並べています。＝この並びが、いちばん先の予約が出たあとのプロフィールです。`
            : `投稿済みの直近 ${shown.length} 件を新しい順で並べています（実データのみ）。`}
          プロフィールの並びと同じ 4:5 で切り取って表示しています。
        </p>
      )}

      {/* 予約はあるのに画像がまだ無いものは、空のマスを架空に埋めずに件数だけ正直に出す */}
      {plannedNoImage > 0 && (
        <p style={{ margin: 0, fontSize: 11, color: inkSoft, lineHeight: 1.5 }}>
          予約のうち {plannedNoImage} 件は、まだ画像がないので並びに出していません（何が並ぶか分からないマスを、それらしく埋めないためです）。
        </p>
      )}

      {/* 並びの中で読めるか — 実測した文字サイズで判定 */}
      {cellPx > 0 && titlePx > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: '0.6rem 0.75rem',
          background: leg.level === 'ok' ? 'rgba(22,128,86,0.06)' : leg.level === 'warn' ? 'rgba(180,120,0,0.08)' : 'rgba(200,16,46,0.06)',
          border: `1px solid ${leg.level === 'ok' ? 'rgba(22,128,86,0.28)' : leg.level === 'warn' ? 'rgba(180,120,0,0.3)' : 'rgba(200,16,46,0.28)'}`,
        }}>
          {leg.level === 'ok'
            ? <CheckCircle2 size={14} color="#168056" style={{ flexShrink: 0, marginTop: 2 }} />
            : <AlertTriangle size={14} color={leg.level === 'warn' ? '#8A5A00' : '#C8102E'} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span style={{
            flex: 1, fontSize: 11.5, lineHeight: 1.55, fontWeight: 600,
            color: leg.level === 'ok' ? '#0F5F40' : leg.level === 'warn' ? '#7A4F00' : '#C8102E',
          }}>{leg.msg}</span>
        </div>
      )}

      {crop && (
        <p style={{ margin: 0, fontSize: 11.5, color: inkSoft, lineHeight: 1.55 }}>{crop}</p>
      )}

      <button
        onClick={onFixText}
        style={{
          justifySelf: 'start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7,
          border: `1px solid ${cardBorder}`, background: '#fff', color: ink, borderRadius: 12,
          padding: '0.6rem 1rem', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <PencilLine size={14} color={accent} /> 文字を直す
      </button>
    </div>
  );
}
