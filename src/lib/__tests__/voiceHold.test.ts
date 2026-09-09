import { describe, it, expect } from 'vitest';
import {
  holdReducer, normalizeTranscript, mergeVoiceIntoQuery,
  decideHeard, shouldForceStop, micMessage, shouldKeepListening, MAX_RELISTEN, settleKind,
  HOLD_MIN_MS, type HoldPhase, type HoldEvent,
} from '../voiceHold';

/** 画面と同じ順番でイベントを流し、最後の段階と、途中で出た指示を全部返す */
function run(events: HoldEvent[]) {
  let phase: HoldPhase = 'idle';
  const outcomes: string[] = [];
  for (const ev of events) {
    const next = holdReducer(phase, ev);
    phase = next.phase;
    if (next.outcome !== 'none') outcomes.push(next.outcome);
  }
  return { phase, outcomes };
}

describe('holdReducer — タップでは開かない・離した時だけ入れる', () => {
  it('長押しに届いてから離す = 開いて、入れる', () => {
    const { phase, outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'hold', at: HOLD_MIN_MS },
      { type: 'up', at: 1800 },
    ]);
    expect(outcomes).toEqual(['start', 'commit']);
    expect(phase).toBe('idle');
  });

  it('★タップ (長押しに届く前に離す) ではマイクを開かない', () => {
    const { phase, outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'up', at: 120 },
    ]);
    // start が 1 度も出ない = 許可ダイアログも出ない
    expect(outcomes).toContain('tooShort');
    expect(outcomes).not.toContain('start');
    expect(phase).toBe('idle');
  });

  it('★短すぎた時は黙って無視せず tooShort を返す（押したのに無反応、を作らない）', () => {
    const { outcomes } = run([{ type: 'down', at: 0 }, { type: 'up', at: 10 }]);
    expect(outcomes).toEqual(['tooShort']);
  });

  it('★指を外へ出したら、聞いた分は捨てる（commit しない）', () => {
    const { phase, outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'hold', at: HOLD_MIN_MS },
      { type: 'cancel' },
    ]);
    expect(outcomes).toEqual(['start', 'discard']);
    expect(outcomes).not.toContain('commit');
    expect(phase).toBe('idle');
  });

  it('取り消した後に離しても、二度目の指示は出ない', () => {
    const { outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'hold', at: HOLD_MIN_MS },
      { type: 'cancel' },
      { type: 'up', at: 900 },
    ]);
    expect(outcomes).toEqual(['start', 'discard']);
  });

  it('★離した後に遅れて来たタイマーでマイクが開かない（押していないのに録音が始まる事故）', () => {
    const { phase, outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'up', at: 100 },
      { type: 'hold', at: HOLD_MIN_MS }, // 取り消し漏れのタイマーが後から届く
    ]);
    expect(outcomes).toEqual(['tooShort']);
    expect(phase).toBe('idle');
  });

  it('★聞いている最中の 2 本目の指では、二重に開かない', () => {
    const { phase, outcomes } = run([
      { type: 'down', at: 0 },
      { type: 'hold', at: HOLD_MIN_MS },
      { type: 'down', at: 500 },
      { type: 'hold', at: 900 },
      { type: 'up', at: 1200 },
    ]);
    expect(outcomes.filter(o => o === 'start')).toHaveLength(1);
    expect(outcomes).toEqual(['start', 'commit']);
    expect(phase).toBe('idle');
  });

  it('触っていない状態での up / cancel は何も起こさない', () => {
    expect(run([{ type: 'up', at: 5 }]).outcomes).toEqual([]);
    expect(run([{ type: 'cancel' }]).outcomes).toEqual([]);
  });

  it('長押しのしきい値は画面と同じ 1 か所から来る（勝手な数字を書かない）', () => {
    expect(HOLD_MIN_MS).toBeGreaterThan(0);
  });
});

describe('normalizeTranscript — 何も言っていない時に空文字を作る', () => {
  it('空白・改行だけなら空', () => {
    expect(normalizeTranscript('   ')).toBe('');
    expect(normalizeTranscript('\n\t ')).toBe('');
    expect(normalizeTranscript('')).toBe('');
  });
  it('前後の空白を落とし、中の連続空白は 1 つにする', () => {
    expect(normalizeTranscript('  来週の 売上   目標  ')).toBe('来週の 売上 目標');
  });
});

describe('mergeVoiceIntoQuery — 打ってあった文を消さない', () => {
  it('★聞き取れなかった時は 1 文字も変えない（同じ文字列がそのまま返る）', () => {
    expect(mergeVoiceIntoQuery('請求書', '   ')).toBe('請求書');
    expect(mergeVoiceIntoQuery('請求書', '')).toBe('請求書');
    expect(mergeVoiceIntoQuery('', '')).toBe('');
  });

  it('空欄なら、聞き取った文がそのまま入る', () => {
    expect(mergeVoiceIntoQuery('', '来月の売上見込みを出して')).toBe('来月の売上見込みを出して');
    expect(mergeVoiceIntoQuery('   ', 'ナレッジを探す')).toBe('ナレッジを探す');
  });

  it('★打ってあった文は消えず、後ろに足される', () => {
    expect(mergeVoiceIntoQuery('請求書', 'の締切を教えて')).toBe('請求書の締切を教えて');
  });

  it('日本語の途中には、勝手に空白を入れない', () => {
    expect(mergeVoiceIntoQuery('売上を', '教えて')).toBe('売上を教えて');
  });

  it('★@ で対象を指している途中なら、必ず空白を挟む（指した対象の名前に混ざらない）', () => {
    // 挟まないと "@ナ売上を教えて" になり、@ナレッジ の指定が別物に化ける
    expect(mergeVoiceIntoQuery('@ナ', '売上を教えて')).toBe('@ナ 売上を教えて');
    expect(mergeVoiceIntoQuery('先月 @売上', 'を三行でまとめて')).toBe('先月 @売上 を三行でまとめて');
  });

  it('指し終わった @ の後ろ（既に空白がある）は二重に空白を作らない', () => {
    expect(mergeVoiceIntoQuery('@ナレッジ ', '三行でまとめて')).toBe('@ナレッジ 三行でまとめて');
  });

  it('★英数字どうしがくっつく時だけ空白を挟む', () => {
    expect(mergeVoiceIntoQuery('KPI', 'report')).toBe('KPI report');
    expect(mergeVoiceIntoQuery('KPI', 'を出して')).toBe('KPIを出して');
    expect(mergeVoiceIntoQuery('売上を', 'CSV')).toBe('売上をCSV');
  });

  it('末尾の空白は増やさない（打ちかけの空白をそのまま連れて行かない）', () => {
    expect(mergeVoiceIntoQuery('請求書  ', '締切')).toBe('請求書締切');
  });

  it('元の文字列を書き換えない（副作用ゼロ）', () => {
    const q = '売上';
    const out = mergeVoiceIntoQuery(q, 'を教えて');
    expect(q).toBe('売上');
    expect(out).toBe('売上を教えて');
  });
});

describe('decideHeard — 取り消したら入れない・二重に入れない', () => {
  it('★取り消した時は、取れていても入れない', () => {
    const r = decideHeard({ discard: true, finals: ['来月の売上'], lastInterim: '来月の売上見込み' });
    expect(r).toEqual({ outcome: 'discarded', text: '' });
  });

  it('確定した文が複数あれば、順につないで入れる', () => {
    const r = decideHeard({ discard: false, finals: ['来月の', '売上見込みを出して'], lastInterim: '' });
    expect(r).toEqual({ outcome: 'insert', text: '来月の売上見込みを出して' });
  });

  it('★確定があるなら途中経過は使わない（同じ言葉が二重に入らない）', () => {
    const r = decideHeard({ discard: false, finals: ['来月の売上'], lastInterim: '来月の売上' });
    expect(r.text).toBe('来月の売上');
  });

  it('確定が 1 つも無い時だけ、途中経過を拾う', () => {
    const r = decideHeard({ discard: false, finals: [], lastInterim: '来月の売上' });
    expect(r).toEqual({ outcome: 'insert', text: '来月の売上' });
  });

  it('★何も取れなければ nothingHeard（空の文字を入力欄へ入れない）', () => {
    expect(decideHeard({ discard: false, finals: [], lastInterim: '' }).outcome).toBe('nothingHeard');
    expect(decideHeard({ discard: false, finals: ['  '], lastInterim: ' ' }).outcome).toBe('nothingHeard');
    expect(decideHeard({ discard: false, finals: [], lastInterim: '' }).text).toBe('');
  });
});

describe('shouldForceStop — 押していないのに開いたマイクは閉じる', () => {
  it('★離した後に開いたら閉じる（許可ダイアログの後で録音が始まる穴）', () => {
    expect(shouldForceStop('idle', true)).toBe(true);
    expect(shouldForceStop('pending', true)).toBe(true);
  });
  it('押している最中は閉じない', () => {
    expect(shouldForceStop('recording', true)).toBe(false);
  });
  it('開いていなければ何もしない', () => {
    expect(shouldForceStop('idle', false)).toBe(false);
    expect(shouldForceStop('recording', false)).toBe(false);
  });
});

describe('micMessage — どの結末でも必ず一言出る', () => {
  it('★空の一言を返す道が 1 本も無い', () => {
    const kinds = ['tooShort', 'nothingHeard', 'discarded', 'notStarted', 'error'] as const;
    for (const k of kinds) expect(micMessage(k).length).toBeGreaterThan(0);
    for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'unknown', null, undefined])
      expect(micMessage('error', code).length).toBeGreaterThan(0);
  });
  it('許可されていない時は、直し方まで言う', () => {
    expect(micMessage('error', 'not-allowed')).toContain('許可');
  });
  it('長押しだと分かる言い方をする', () => {
    expect(micMessage('tooShort')).toContain('長押し');
  });
});

describe('shouldKeepListening — 押している間は、勝手に閉じても開き直す', () => {
  it('★指が乗ったままなら開き直す（押しているのに途中から聞いていない、を作らない）', () => {
    expect(shouldKeepListening('recording', false, 0)).toBe(true);
    expect(shouldKeepListening('recording', false, MAX_RELISTEN - 1)).toBe(true);
  });
  it('★指を離していたら開き直さない（押していないのにマイクが開き続ける）', () => {
    expect(shouldKeepListening('idle', false, 0)).toBe(false);
    expect(shouldKeepListening('pending', false, 0)).toBe(false);
  });
  it('★エラーで終わった時は開き直さない（開けない端末で無限に叩き続けない）', () => {
    expect(shouldKeepListening('recording', true, 0)).toBe(false);
  });
  it('★上限を超えたら開き直さない', () => {
    expect(shouldKeepListening('recording', false, MAX_RELISTEN)).toBe(false);
    expect(shouldKeepListening('recording', false, MAX_RELISTEN + 5)).toBe(false);
  });
});

describe('settleKind — 聞いていた相手がいない時は、その場で片づける', () => {
  it('★開いていなければ、離した時に片づける（「聞いています…」が貼り付くのを防ぐ）', () => {
    expect(settleKind('commit', false)).toBe('notStarted');
    expect(settleKind('discard', false)).toBe('discarded');
  });
  it('★本当に聞いていた時は、その場で片づけない（onend まで待つ）', () => {
    // ここで片づけると、stop() のあとに届く最後のひとことが落ちる
    expect(settleKind('commit', true)).toBeNull();
    expect(settleKind('discard', true)).toBeNull();
  });
  it('離す以外の結末では何もしない', () => {
    expect(settleKind('start', false)).toBeNull();
    expect(settleKind('tooShort', false)).toBeNull();
    expect(settleKind('none', false)).toBeNull();
  });
  it('開かなかった時の一言は、直し方まで言う', () => {
    expect(micMessage('notStarted')).toContain('許可');
  });
});
