/**
 * 「話しかけて編集 → ひとつ前に戻す」を、本物のコマンド層 (reelChatEdit) で通しで確かめる。
 * スタジオ本体 (IrisReelStudioMinimal.tsx) は React なのでここでは動かせないが、
 * 本物の routeEditCommand / applyActions に、スタジオと同じ形の器 (ctx) を渡すことで
 * 「言い間違いで消えたカットが、控えた姿を戻すと本当に返ってくるか」までを実測する。
 */
import { describe, it, expect } from 'vitest';
import { routeEditCommand, applyActions, type ReelEditCtx, type ColorMoodId } from '../reelChatEdit';
import { reelEditChanged, undoLabelFromSummaries } from '../reelUndo';
import type { PresetId } from '../reelStudio/Presets';

type FakeClip = { id: string; duration: number; captionText?: string; captionY?: number; transition?: string };

/** IrisReelStudioMinimal の buildChatCtx と同じ橋渡しを、素の配列で組んだもの */
function makeStudio(clips: FakeClip[]) {
  const s = { clips: [...clips], presetId: null as string | null, colorMood: 'none' as string, aiCaptionsCalled: 0 };
  const snapshot = () => ({ clips: s.clips.slice(), presetId: s.presetId, colorMood: s.colorMood });
  const restore = (snap: ReturnType<typeof snapshot>) => {
    s.clips = snap.clips.slice(); s.presetId = snap.presetId; s.colorMood = snap.colorMood;
  };
  const ctx = (): ReelEditCtx => ({
    state: {
      clipCount: s.clips.length,
      totalSec: s.clips.reduce((a, c) => a + c.duration, 0),
      presetId: s.presetId,
      colorMood: s.colorMood as ColorMoodId,
      durations: s.clips.map(c => c.duration),
      captions: s.clips.map(c => c.captionText || ''),
    },
    applyPreset: (id: PresetId) => { s.presetId = id; },
    setColorMood: (m) => { s.colorMood = m; },
    autoDistribute: (sec) => { const per = sec / s.clips.length; s.clips = s.clips.map(c => ({ ...c, duration: per })); },
    setClipDuration: (i, sec) => { s.clips = s.clips.map((c, n) => n === i ? { ...c, duration: sec } : c); },
    reorder: (from, to) => { const n = s.clips.slice(); const [m] = n.splice(from, 1); n.splice(to, 0, m); s.clips = n; },
    setTransition: (i, tr) => {
      s.clips = i === 'all' ? s.clips.map(c => ({ ...c, transition: tr }))
        : s.clips.map((c, n) => n === i ? { ...c, transition: tr } : c);
    },
    setCaption: (i, text) => { s.clips = s.clips.map((c, n) => n === i ? { ...c, captionText: text } : c); },
    removeClip: (i) => { s.clips = s.clips.filter((_, n) => n !== i); },
    runAiCaptions: () => { s.aiCaptionsCalled++; },
  });
  return { s, ctx, snapshot, restore };
}

const threeClips: FakeClip[] = [
  { id: 'a', duration: 3, captionText: '朝のルーティン' },
  { id: 'b', duration: 3, captionText: 'コーヒーを淹れる' },
  { id: 'c', duration: 3, captionText: 'いってきます' },
];

/** スタジオの流れそのまま: 控える → 本物のコマンドを当てる → 変わったかを見る */
function speak(studio: ReturnType<typeof makeStudio>, text: string) {
  const before = studio.snapshot();
  const actions = routeEditCommand(text, studio.ctx().state);
  const summaries = actions.length ? applyActions(actions, studio.ctx()) : [];
  const after = studio.snapshot();
  return { before, summaries, changed: summaries.length > 0 && reelEditChanged(before, after) };
}

describe('話しかけて編集 → ひとつ前に戻す (本物のコマンド層で通し)', () => {
  it('「2番目のカットを削除」で消えたカットが、戻すと本当に返ってくる', () => {
    const studio = makeStudio(threeClips);
    const turn = speak(studio, '2番目のカットを削除');

    // 実際に消えていること (テストが空振りしていない証拠)
    expect(studio.s.clips.map(c => c.id)).toEqual(['a', 'c']);
    expect(turn.changed).toBe(true);

    studio.restore(turn.before);
    expect(studio.s.clips.map(c => c.id)).toEqual(['a', 'b', 'c']);
    // 字幕まで元どおり (id だけ戻って中身が空、にならないこと)
    expect(studio.s.clips[1].captionText).toBe('コーヒーを淹れる');
  });

  it('「おまかせで整えて」のように一度に色・繋ぎ・尺が変わっても、1 回で全部戻る', () => {
    const studio = makeStudio(threeClips);
    const turn = speak(studio, 'おまかせで整えて');
    expect(turn.changed).toBe(true);
    // 3 つとも変わっていること
    expect(studio.s.colorMood).not.toBe('none');
    expect(studio.s.clips.every(c => c.transition === 'fade')).toBe(true);
    expect(studio.s.clips.reduce((a, c) => a + c.duration, 0)).toBeCloseTo(15, 5);

    studio.restore(turn.before);
    expect(studio.s.colorMood).toBe('none');
    expect(studio.s.clips.every(c => c.transition === undefined)).toBe(true);
    expect(studio.s.clips.reduce((a, c) => a + c.duration, 0)).toBeCloseTo(9, 5);
  });

  it('素材ゼロで「1番目を削除」と言っても、戻すボタンは出ない (押しても何も起きないボタンを作らない)', () => {
    const studio = makeStudio([]);
    const turn = speak(studio, '1番目のカットを削除');
    // コマンド層は「先に素材を入れてください」を返すが、状態は 1 つも変わらない
    expect(turn.summaries.length).toBeGreaterThan(0);
    expect(turn.changed).toBe(false);
  });

  it('AI 字幕は非同期なので、頼んだ直後には戻すものが無い (字幕が入ったあとに出す作りである根拠)', () => {
    const studio = makeStudio(threeClips);
    const turn = speak(studio, 'AI字幕をつけて');
    expect(studio.s.aiCaptionsCalled).toBe(1);
    expect(turn.changed).toBe(false);
  });

  it('戻したあとの姿は、話しかける前と 1 か所も違わない', () => {
    const studio = makeStudio(threeClips);
    const before = studio.snapshot();
    speak(studio, '全体を15秒にして');
    expect(reelEditChanged(before, studio.snapshot())).toBe(true);
    studio.restore(before);
    expect(reelEditChanged(before, studio.snapshot())).toBe(false);
  });

  it('スナックバーの一行に、実際にやったことが出る', () => {
    const studio = makeStudio(threeClips);
    const turn = speak(studio, '2番目のカットを削除');
    expect(undoLabelFromSummaries(turn.summaries)).toContain('削除');
  });
});
