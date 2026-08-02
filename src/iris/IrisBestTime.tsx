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
import { usePostHistory } from './strategist';
import { computeBestPostTime, DOW_LABELS as DOW } from './bestPostTime';

export default function IrisBestTime({ bg }: { bg: IrisBackgroundDef }) {
  const { posts } = usePostHistory();

  const result = useMemo(() => computeBestPostTime(posts), [posts]);

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1rem 1.1rem',
    display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: IRIS_FONTS.body,
  };
  const iconWrap: React.CSSProperties = {
    width: 38, height: 38, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center',
    background: `${bg.accent}1f`, color: bg.accentText,
  };

  return (
    <div style={card}>
      <span style={iconWrap}><Clock size={19} strokeWidth={2.1} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: bg.accentText, fontWeight: 700, margin: 0 }}>
          投稿のおすすめ時間
        </p>
        {result.enough ? (
          <>
            <p style={{ color: bg.ink, fontSize: '0.98rem', fontWeight: 700, margin: '4px 0 0', lineHeight: 1.45 }}>
              あなたが一番伸びるのは <span style={{ color: bg.accentText }}>{DOW[result.bestDow.d]}曜</span> の <span style={{ color: bg.accentText }}>{result.bestBand.band}</span>
            </p>
            <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '4px 0 0', lineHeight: 1.6 }}>
              あなたの実績（{result.n}投稿）から算出。平均反応率は {result.bestBand.band} が約 {result.bestBand.avg.toFixed(1)}%、{DOW[result.bestDow.d]}曜が約 {result.bestDow.avg.toFixed(1)}%。次の投稿はこの枠を狙うと伸びやすいです。
            </p>
          </>
        ) : (
          <>
            <p style={{ color: bg.ink, fontSize: '0.98rem', fontWeight: 700, margin: '4px 0 0', lineHeight: 1.45 }}>
              まずは <span style={{ color: bg.accentText }}>平日の朝（7〜9時）・夜（19〜21時）</span> が一般的な狙い目です
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
