// ============================================================
// IrisThoughtDropSection — ホーム最上部のフラッグシップ一式
//
// 「思考を投げるだけ。あとは Iris が全てを支配する。」
//   巨大入力 (IrisThoughtDrop)
//   → 花のステージ (IrisBloomStage / stage プロップ)
//   → X / Instagram / note の実物風カード (IrisPlatformCards)
//   → 美しいインサイト・サマリー (IrisInsightSummary / honest-numbers)
// を 1 ブロックに束ね、IrisDashboard のホーム最上部に置く。
// ============================================================
import React, { useState } from 'react';
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
  /** ヒーロー (IrisCrystalHero) 側に見出しがある時は内部見出しを消す */
  hideHeading?: boolean;
  /** 花のステージ (IrisBloomStage)。入力のすぐ下に咲かせる＝入力は0スクロールで届く */
  stage?: React.ReactNode;
}

export default function IrisThoughtDropSection({ bg, model, postQueue, handle, hideHeading, stage }: Props) {
  const [result, setResult] = useState<ThoughtDropResult | null>(null);
  // streak は日次 touch が冪等なのでここで直接計測してよい
  const streakInfo = useDailyStreak();

  return (
    // minmax(0,1fr): 既定の auto 列は中身の max-content に合わせて伸びるため、
    // 入力カード内の1行横スクロールで列ごと画面外へはみ出すのを構造的に止める
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
      <IrisThoughtDrop bg={bg} model={model} onResult={setResult} hideHeading={hideHeading} />
      {stage}
      {result && (
        <IrisPlatformCards bg={bg} result={result} queue={postQueue} handle={handle} model={model} />
      )}
      <IrisInsightSummary posts={postQueue?.posts} streak={streakInfo.streak} />
    </div>
  );
}
