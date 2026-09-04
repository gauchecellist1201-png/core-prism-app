import { describe, it, expect } from 'vitest';
import { planExportActions, isMp4, type ExportActionPlanInput } from '../exportActionPlan';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  ipadOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const base: ExportActionPlanInput = {
  ua: UA.iphoneSafari,
  maxTouchPoints: 5,
  mime: 'video/mp4',
  hasPostQueue: true,
  scheduled: false,
  hasSchedule: true,
  hasAiCaption: true,
  hookOptionCount: 3,
  otherDestinationCount: 2,
};

const plan = (over: Partial<ExportActionPlanInput> = {}) => planExportActions({ ...base, ...over });

describe('isMp4', () => {
  it('codecs 付きでも MP4 と分かる', () => {
    expect(isMp4('video/mp4')).toBe(true);
    expect(isMp4('video/mp4;codecs=avc1.42E01E')).toBe(true);
    expect(isMp4(' video/mp4 ')).toBe(true);
  });
  it('WebM を MP4 と言わない', () => {
    expect(isMp4('video/webm')).toBe(false);
    expect(isMp4('video/webm;codecs=vp9')).toBe(false);
    expect(isMp4('')).toBe(false);
  });
});

describe('planExportActions ▸ 主アクションは常に 1 つ', () => {
  it('スマホ × MP4 → インスタで開く（リールはアプリからしか投稿できない）', () => {
    for (const ua of [UA.iphoneSafari, UA.iphoneChrome, UA.androidChrome]) {
      const p = plan({ ua });
      expect(p.primary).toBe('instagram');
      expect(p.primaryLabel).toBe('インスタで開く');
    }
  });

  it('iPadOS は Macintosh を名乗るが、指で触れるならスマホ扱い', () => {
    expect(plan({ ua: UA.ipadOS, maxTouchPoints: 5 }).primary).toBe('instagram');
    // 本物の Mac を iPad にしない
    expect(plan({ ua: UA.ipadOS, maxTouchPoints: 0 }).primary).toBe('download');
  });

  it('パソコン → 保存（ここからは投稿できないと正直に言う）', () => {
    for (const ua of [UA.macChrome, UA.windowsChrome]) {
      const p = plan({ ua, maxTouchPoints: 0 });
      expect(p.primary).toBe('download');
      expect(p.primaryNote).toContain('スマホの Instagram アプリ');
    }
  });

  it('★WebM のときはスマホでも共有シートへ送らない（弾かれて行き止まりになる）', () => {
    const p = plan({ mime: 'video/webm;codecs=vp9' });
    expect(p.primary).toBe('download');
    expect(p.primaryLabel).toBe('WebM をダウンロード');
    expect(p.secondaryLabel).toBe('インスタで開く');
  });

  it('主から外れた側は必ず畳んだ中に残る（機能を消さない）', () => {
    const onPhone = plan();
    expect(onPhone.secondaryLabel).toBe('MP4 をダウンロード');
    const onPc = plan({ ua: UA.windowsChrome, maxTouchPoints: 0 });
    expect(onPc.secondaryLabel).toBe('インスタで開く');
  });
});

describe('planExportActions ▸ 畳んだ数を盛らない', () => {
  it('出ないものは数えない', () => {
    const full = plan();
    // 6(常に出る) + この枠で予約1 + 投稿予約に追加1 + 本文コピー1 + フック3 + 別の形2 = 14
    expect(full.hiddenCount).toBe(14);

    const bare = plan({
      hasPostQueue: false,
      hasSchedule: false,
      hasAiCaption: false,
      hookOptionCount: 0,
      otherDestinationCount: 0,
    });
    expect(bare.hiddenCount).toBe(6);
  });

  it('★予約まわりは画面の出し分けと 1 対 1（同時に出るものだけ足す）', () => {
    const bare = {
      hasAiCaption: false, hookOptionCount: 0, otherDestinationCount: 0,
    } as const;
    // 予約済み: この枠で予約する + 予約一覧をひらく の 2 つ（投稿予約に追加は出ない）
    expect(plan({ ...bare, hasPostQueue: true, scheduled: true }).hiddenCount).toBe(8);
    // 未予約: この枠で予約する + 投稿予約に追加 の 2 つ
    expect(plan({ ...bare, hasPostQueue: true, scheduled: false }).hiddenCount).toBe(8);
    // キュー無し: この枠で予約する + 投稿予約をつくる の 2 つ
    expect(plan({ ...bare, hasPostQueue: false, scheduled: false }).hiddenCount).toBe(8);
    // 予約画面そのものが無い: 予約まわりは 1 つも出ない
    expect(plan({ ...bare, hasPostQueue: false, scheduled: false, hasSchedule: false }).hiddenCount).toBe(6);
  });

  it('開閉ボタンの文言に、その数がそのまま出る', () => {
    const p = plan({ hookOptionCount: 0, otherDestinationCount: 0 });
    expect(p.moreLabel).toBe(`ほかの操作（${p.hiddenCount}）`);
  });

  it('負の数を渡されても数を減らさない', () => {
    const p = plan({ hookOptionCount: -3, otherDestinationCount: -1 });
    expect(p.hiddenCount).toBe(9);
  });

  it('★どの組み合わせでも 0 にならない（畳んだ中が空の「開くだけ無駄なボタン」を作らない）', () => {
    for (const hasPostQueue of [true, false]) {
      for (const scheduled of [true, false]) {
        for (const hasSchedule of [true, false]) {
          for (const hasAiCaption of [true, false]) {
            const p = plan({ hasPostQueue, scheduled, hasSchedule, hasAiCaption });
            expect(p.hiddenCount).toBeGreaterThanOrEqual(6);
          }
        }
      }
    }
  });
});
