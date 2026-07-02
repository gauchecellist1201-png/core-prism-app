// ============================================================
// IrisThoughtDropSection — ホーム最上部のフラッグシップ一式
//
// 「思考を投げるだけ。あとは Iris が全てを支配する。」
//   巨大入力 (IrisThoughtDrop)
//   → X / Instagram / note の実物風カード (IrisPlatformCards)
//   → 美しいインサイト・サマリー (IrisInsightSummary / honest-numbers)
// を 1 ブロックに束ね、IrisDashboard のホーム最上部に置く。
// ============================================================
import { useState } from 'react';
import IrisThoughtDrop, { type ThoughtDropResult } from './IrisThoughtDrop';
import IrisPlatformCards from './IrisPlatformCards';
import IrisInsightSummary from './IrisInsightSummary';
import { useDailyStreak } from '../hooks/useDailyStreak';
import type { IrisBackgroundDef } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  /** settings.preferredModel */
  model?: string;
  /** usePostQueue() の戻り値 (add / posts を使用) */
  postQueue?: any;
  /** mediaKit.handleName (プレビューの表示名) */
  handle?: string;
}

export default function IrisThoughtDropSection({ bg, model, postQueue, handle }: Props) {
  const [result, setResult] = useState<ThoughtDropResult | null>(null);
  // streak は日次 touch が冪等なのでここで直接計測してよい
  const streakInfo = useDailyStreak();

  return (
    <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '1.25rem' }}>
      <IrisThoughtDrop bg={bg} model={model} onResult={setResult} />
      {result && (
        <IrisPlatformCards bg={bg} result={result} queue={postQueue} handle={handle} />
      )}
      <IrisInsightSummary posts={postQueue?.posts} streak={streakInfo.streak} />
    </div>
  );
}
