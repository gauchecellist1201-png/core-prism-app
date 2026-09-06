// ============================================================
// IrisInspirationShelf — 「あとで」に置いたものを、使う場所で出す棚
//
// 置き場所は 2 つだけ:
//   ①入口 (IrisThoughtDrop) — タップで入力欄の下敷きにする
//   ②台本を書く場所 (IrisReelStudioMinimal) — タップでテーマの下敷きにする
//
// 守っていること (BACKLOG 2026-09-06 / Iris ← Edits の「守ること」):
//   ・空の時は出さない (からっぽの棚を毎回見せない) = 何も置いていなければ null
//   ・バッジ・未処理件数を出さない (宿題に変わった瞬間に開かなくなる)
//   ・AI を呼ばない。タップは「下敷きにする」だけで、通信は 1 度も起きない
//   ・出した物を勝手に消さない。捨てるのは ✕ を押した 1 件だけ
//
// ⚠️色をテーマから取らない理由:
//   この棚の面は白で固定している (両方の置き場所が白いカードの上/暗い背景の上の
//   どちらでも同じ見え方にするため)。暗いテーマ (Neon Night) では bg.ink が
//   #FFFFFF・bg.accentText が #FCB045 なので、白い面にそのまま置くと文字が
//   まるごと消える／1.84:1 まで落ちる。明るいテーマだけ見ていると気づけない
//   壊れ方なので、白の上に乗る文字は濃い方で固定する (IrisReelStudioMinimal の
//   INK_ON_LIGHT と同じ作法)。
// ============================================================
import { Bookmark, ExternalLink, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  loadInspirations, removeInspiration, inspirationLabel, inspirationSeed, savedAtLabel,
  type InspirationItem,
} from './inspirationStash';
import { IRIS_FONTS } from './irisStyle';

const INK_ON_LIGHT = '#2A1A3A';
const INK_ON_LIGHT_SOFT = '#3D3247';
const ACCENT_ON_LIGHT = '#B81B57'; // 白の上で 4.6:1 を通るブランドピンク
const BORDER_ON_LIGHT = 'rgba(31,26,46,0.12)';

interface Props {
  /** タップされた 1 件を下敷きにする (親が入力欄に入れる)。AI は呼ばない */
  onUse: (seed: string, item: InspirationItem) => void;
  /** 置いた直後に読み直すための合図 (親が数を 1 つ増やす) */
  refreshKey?: number;
  /** 使う場所ごとの一行 (例: 「テーマの下敷きになります」) */
  hint?: string;
  /** 置き場所ごとの余白。棚が空の時は何も描かないので、余白ごと消える
   *  (親側で <div style={{marginBottom}}> に包むと、置いていない人にも隙間が残る) */
  style?: React.CSSProperties;
}

export default function IrisInspirationShelf({ onUse, refreshKey = 0, hint, style }: Props) {
  // 置いた直後 (refreshKey が動いた時) に読み直す。effect の中で setState すると
  // 描画が二度走るので、読み直しは描画そのものに寄せる。
  // localStorage を読む＝純粋ではないので、読み直す合図そのものである refreshKey を
  // 依存に置く (lint からは「使っていない依存」に見えるが、これが無いと置いた直後に出ない)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stored = useMemo(() => loadInspirations(), [refreshKey]);
  // ✕ で捨てた分は即座に画面から消す (localStorage からは removeInspiration が消している)
  const [dropped, setDropped] = useState<string[]>([]);
  const items: InspirationItem[] = stored.filter((it) => !dropped.includes(it.id));

  // 空の棚は出さない (置いた人にだけ見える)
  if (items.length === 0) return null;

  const boxed: React.CSSProperties = {
    flex: '0 0 auto', width: 44, minHeight: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${BORDER_ON_LIGHT}`, borderRadius: 12,
    background: '#FFFFFF',
  };

  return (
    <section
      aria-label="あとで、に置いたもの"
      style={{
        border: `1px solid ${BORDER_ON_LIGHT}`,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.94)',
        padding: '0.7rem 0.75rem 0.55rem',
        fontFamily: IRIS_FONTS.body,
        ...style,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
        fontSize: 11.5, fontWeight: 800, color: ACCENT_ON_LIGHT,
      }}>
        <Bookmark size={12} strokeWidth={2.4} />
        あとで、に置いたもの
      </div>
      {hint && (
        <p style={{ margin: '0 0 7px', fontSize: 10.5, color: INK_ON_LIGHT_SOFT, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {items.map((it) => {
          const label = inspirationLabel(it);
          const seed = inspirationSeed(it);
          return (
            <li key={it.id} style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              <button
                type="button"
                onClick={() => onUse(seed || label, it)}
                style={{
                  flex: 1, minWidth: 0, minHeight: 44,
                  textAlign: 'left', padding: '0.45rem 0.6rem',
                  background: '#FFFFFF',
                  border: `1px solid ${BORDER_ON_LIGHT}`,
                  borderRadius: 12, cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
                }}
              >
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: INK_ON_LIGHT, lineHeight: 1.45,
                  // 長いひとことでも棚の高さが暴れないように 2 行で畳む
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', wordBreak: 'break-word',
                }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, color: INK_ON_LIGHT_SOFT }}>{savedAtLabel(it.createdAt)}</span>
              </button>
              {it.url && (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="参考先をひらく"
                  style={{ ...boxed, color: ACCENT_ON_LIGHT }}
                >
                  <ExternalLink size={14} strokeWidth={2.2} />
                </a>
              )}
              <button
                type="button"
                onClick={() => { removeInspiration(it.id); setDropped(d => [...d, it.id]); }}
                aria-label="これを棚から捨てる"
                style={{ ...boxed, color: INK_ON_LIGHT_SOFT, cursor: 'pointer' }}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
