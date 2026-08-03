// ============================================================
// IRIS ▸ 並びプレビュー（Later の視覚プランナーの移植）
//
// 出す前に「プロフィールに並んだ時の見え方」を見せる。
// ・左上が今つくっている表紙、その右と下に投稿済みの直近8本（実データのみ）
// ・投稿が無い時は架空の見本を出さず、正直にそう書く（空っぽ3点セット）
// ・並びの中で見出しが読めない大きさになる時は、その場で小さく知らせる
// ・気に入らなければ「文字を直す」で編集に戻れる（行き止まりにしない）
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, PencilLine, AlertTriangle, CheckCircle2, Images } from 'lucide-react';
import { loadPostedGrid, gridLegibility, cropNote, type GridTile } from './coverGrid';

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
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [cellPx, setCellPx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTiles(loadPostedGrid(8)); }, []);

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
  const leg = gridLegibility(titlePx, canvasW, cellPx);
  const crop = cropNote(aspect);
  const cells = 9;

  const cellBase: React.CSSProperties = {
    aspectRatio: '4 / 5', borderRadius: 4, overflow: 'hidden', background: '#F4EEF2',
    border: `1px solid ${cardBorder}`, position: 'relative',
  };

  return (
    <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '0.95rem 1rem', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LayoutGrid size={15} color={accent} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: ink }}>③ 並んだ時の見え方</span>
        <span style={{ fontSize: 11, color: inkSoft }}>プロフィールを開いた人が最初に見るのは、1枚ではなく並びです</span>
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
                  position: 'absolute', left: 3, top: 3, background: accent, color: '#fff',
                  fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 6px', lineHeight: 1.2,
                }}>いま作成中</span>
              </div>
            );
          }
          const t = shown[i - 1];
          if (t) {
            return (
              <div key={t.id} data-cell style={cellBase}>
                <img
                  src={t.src}
                  alt={t.label || '投稿済み'}
                  title={t.label}
                  onError={() => setBroken((prev) => new Set(prev).add(t.id))}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            );
          }
          return <div key={`e${i}`} data-cell style={{ ...cellBase, background: 'repeating-linear-gradient(135deg, #F7F2F5 0 6px, #F1E9EE 6px 12px)' }} />;
        })}
      </div>

      {/* 実データが1件も無い時：架空の見本は出さず、正直に書いて次の一手を1つだけ置く */}
      {shown.length === 0 ? (
        <div style={{ display: 'grid', gap: 8, background: `${accent}0A`, border: `1px solid ${accent}22`, borderRadius: 12, padding: '0.7rem 0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Images size={15} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: ink, lineHeight: 1.5 }}>まだ並べる投稿がありません</p>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: inkSoft, lineHeight: 1.55 }}>
                予約リストで「投稿した」にした分と、Instagram 連携で取り込んだ投稿が、ここに新しい順で並びます。見本の画像は出しません（実際のあなたの並びだけを見せるためです）。
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
          投稿済みの直近 {shown.length} 件を新しい順で並べています（実データのみ）。プロフィールの並びと同じ 4:5 で切り取って表示しています。
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
