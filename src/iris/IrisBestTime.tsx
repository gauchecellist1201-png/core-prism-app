// ============================================================
// CORE Iris — 最適投稿時間のおすすめ（Buffer「フォロワー活動ベースの最適時間」相当）
//
// あなた自身の過去投稿の“伸び”（反応率）から、よく伸びる曜日・時間帯を出す。
// honest-numbers 厳守：十分なデータ(4投稿以上で反応の数字あり)が無いときは
// 「一般的な目安」と明記し、実績がある時だけ「あなたの実績」と数字を出す（嘘を作らない）。
// ============================================================
import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { usePostHistory, type PostHistoryItem } from './strategist';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const BANDS: { label: string; test: (h: number) => boolean }[] = [
  { label: '朝（6〜10時）', test: (h) => h >= 6 && h < 11 },
  { label: '昼（11〜14時）', test: (h) => h >= 11 && h < 15 },
  { label: '夕方（15〜18時）', test: (h) => h >= 15 && h < 19 },
  { label: '夜（19〜22時）', test: (h) => h >= 19 && h < 23 },
  { label: '深夜（23〜5時）', test: (h) => h >= 23 || h < 6 },
];

// 1投稿の“伸び”スコア。反応率があれば最優先、無ければリーチから推定、それも無ければ生反応数。
function score(p: PostHistoryItem): number | null {
  const m = p.metrics || {};
  if (typeof m.engagementRate === 'number' && m.engagementRate > 0) return m.engagementRate;
  const eng = (m.likes || 0) + (m.comments || 0) + (m.saves || 0) + (m.shares || 0);
  if (m.reach && m.reach > 0) return (eng / m.reach) * 100;
  return eng > 0 ? eng : null;
}

function bandOf(h: number): string {
  return (BANDS.find((b) => b.test(h)) || BANDS[BANDS.length - 1]).label;
}

export default function IrisBestTime({ bg }: { bg: IrisBackgroundDef }) {
  const { posts } = usePostHistory();

  const result = useMemo(() => {
    const scored = posts
      .map((p) => {
        const d = new Date(p.postedAt);
        const s = score(p);
        if (isNaN(d.getTime()) || s === null) return null;
        return { dow: d.getDay(), hour: d.getHours(), band: bandOf(d.getHours()), s };
      })
      .filter(Boolean) as { dow: number; hour: number; band: string; s: number }[];

    if (scored.length < 4) return { enough: false as const, n: scored.length };

    const avg = (rows: { s: number }[]) => rows.reduce((a, r) => a + r.s, 0) / rows.length;
    // 曜日ベスト
    const byDow = new Map<number, { s: number }[]>();
    const byBand = new Map<string, { s: number }[]>();
    for (const r of scored) {
      (byDow.get(r.dow) || byDow.set(r.dow, []).get(r.dow)!).push(r);
      (byBand.get(r.band) || byBand.set(r.band, []).get(r.band)!).push(r);
    }
    const bestDow = [...byDow.entries()].map(([d, rows]) => ({ d, avg: avg(rows), n: rows.length })).sort((a, b) => b.avg - a.avg)[0];
    const bestBand = [...byBand.entries()].map(([band, rows]) => ({ band, avg: avg(rows), n: rows.length })).sort((a, b) => b.avg - a.avg)[0];
    return { enough: true as const, n: scored.length, bestDow, bestBand };
  }, [posts]);

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1rem 1.1rem',
    display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: IRIS_FONTS.body,
  };
  const iconWrap: React.CSSProperties = {
    width: 38, height: 38, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center',
    background: `${bg.accent}1f`, color: bg.accent,
  };

  return (
    <div style={card}>
      <span style={iconWrap}><Clock size={19} strokeWidth={2.1} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, margin: 0 }}>
          投稿のおすすめ時間
        </p>
        {result.enough ? (
          <>
            <p style={{ color: bg.ink, fontSize: '0.98rem', fontWeight: 700, margin: '4px 0 0', lineHeight: 1.45 }}>
              あなたが一番伸びるのは <span style={{ color: bg.accent }}>{DOW[result.bestDow.d]}曜</span> の <span style={{ color: bg.accent }}>{result.bestBand.band}</span>
            </p>
            <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '4px 0 0', lineHeight: 1.6 }}>
              あなたの実績（{result.n}投稿）から算出。平均反応率は {result.bestBand.band} が約 {result.bestBand.avg.toFixed(1)}%、{DOW[result.bestDow.d]}曜が約 {result.bestDow.avg.toFixed(1)}%。次の投稿はこの枠を狙うと伸びやすいです。
            </p>
          </>
        ) : (
          <>
            <p style={{ color: bg.ink, fontSize: '0.98rem', fontWeight: 700, margin: '4px 0 0', lineHeight: 1.45 }}>
              まずは <span style={{ color: bg.accent }}>平日の朝（7〜9時）・夜（19〜21時）</span> が一般的な狙い目です
            </p>
            <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '4px 0 0', lineHeight: 1.6 }}>
              ※これは一般的な目安です。あなたの投稿が{result.n}/4件たまると、実績から「あなた専用のおすすめ時間」に切り替わります（数字は実データのみ・推測で作りません）。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
