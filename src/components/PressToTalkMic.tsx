// ============================================================
// PressToTalkMic — 押している間だけ聞く、離すと文字になるマイク
//
// 2026-09-09 / BACKLOG「長押し音声→その場の操作へ直結」(Notion AI 音声入力)。
// 判断のわけは src/lib/voiceHold.ts の冒頭に書いてある (押している間だけ / 実行はしない)。
// ここは画面と Web Speech の配線だけ。決まりごとは 1 つも書かない。
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import {
  holdReducer, decideHeard, shouldForceStop, shouldKeepListening, settleKind, micMessage,
  HOLD_MIN_MS, type HoldPhase,
} from '../lib/voiceHold';

/** 画面の上に出す一言 / 聞いている最中の途中経過 */
export type VoiceHoldStatus =
  | { kind: 'listening'; interim: string }
  | { kind: 'notice'; message: string }
  | null;

type Props = {
  /** 聞き取れた文。実行はしない = 呼ぶ側は入力欄へ入れるだけにすること */
  onInsert: (text: string) => void;
  /** 聞いている最中・一言。呼ぶ側が 1 行だけ出す */
  onStatus?: (s: VoiceHoldStatus) => void;
};

const NOTICE_MS = 4000;
/** 押せる大きさ。44px を下回らせない */
const BTN = 44;

export default function PressToTalkMic({ onInsert, onStatus }: Props) {
  const [phase, setPhase] = useState<HoldPhase>('idle');
  const phaseRef = useRef<HoldPhase>('idle');
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef('');
  const discardRef = useRef(false);
  /** 指を離した後にマイクが開いてしまい、こちらから閉じた時の印 */
  const forcedRef = useRef(false);
  /** 指が乗ったままなのに閉じたので、こちらから開き直した回数 */
  const relistenRef = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);

  // 呼ぶ側の関数は ref 経由。依存に入れると、親が描き直すたびに
  // 「聞き終わったか」を見る仕掛けが張り替わる (途中で聞いた分が消える)。
  const insertRef = useRef(onInsert);
  const statusRef = useRef(onStatus);
  useEffect(() => { insertRef.current = onInsert; statusRef.current = onStatus; });

  const emit = useCallback((s: VoiceHoldStatus) => { statusRef.current?.(s); }, []);

  const notice = useCallback((msg: string) => {
    emit({ kind: 'notice', message: msg });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => emit(null), NOTICE_MS);
  }, [emit]);

  const onResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) { finalsRef.current.push(text); interimRef.current = ''; }
    else { interimRef.current = text; }
    if (phaseRef.current === 'recording') {
      emit({ kind: 'listening', interim: (finalsRef.current.join('') + interimRef.current).slice(-120) });
    }
  }, [emit]);

  // 押している間だけ聞く: 自動で止めない (silenceTimeout 0)。
  // continuous = true にしないと、1 文しゃべった時点でマイクが閉じる。
  const voice = useVoiceInput(onResult, { continuous: true, interimResults: true, silenceTimeout: 0 });

  const setPhaseBoth = (p: HoldPhase) => { phaseRef.current = p; setPhase(p); };

  const clearHoldTimer = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  /** 押している間の段階を 1 つ進め、決まった通りに動く */
  const step = useCallback((ev: Parameters<typeof holdReducer>[1]) => {
    const { phase: next, outcome } = holdReducer(phaseRef.current, ev);
    setPhaseBoth(next);
    if (outcome === 'start') {
      finalsRef.current = [];
      interimRef.current = '';
      discardRef.current = false;
      forcedRef.current = false;
      relistenRef.current = 0;
      emit({ kind: 'listening', interim: '' });
      voice.start();
    } else if (outcome === 'commit' || outcome === 'discard') {
      clearHoldTimer();
      if (outcome === 'discard') discardRef.current = true;
      // ★開いていたかどうかは stop() の前に見る (stop() が状態を動かす前の姿)
      const settle = settleKind(outcome, voice.state === 'listening');
      voice.stop();
      if (settle) {
        // 決着をつける相手 (onend) がいないので、その場で片づける。
        // 塞がないと「聞いています…」が指を離したあとも貼り付く。
        finalsRef.current = [];
        interimRef.current = '';
        notice(micMessage(settle));
      }
    } else if (outcome === 'tooShort') {
      clearHoldTimer();
      notice(micMessage('tooShort'));
    }
  }, [emit, notice, voice]);

  const down = () => {
    step({ type: 'down', at: Date.now() });
    clearHoldTimer();
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      step({ type: 'hold', at: Date.now() });
    }, HOLD_MIN_MS);
  };
  const up = () => { clearHoldTimer(); step({ type: 'up', at: Date.now() }); };
  const cancel = () => { clearHoldTimer(); step({ type: 'cancel' }); };

  // 聞き終わった瞬間 (onend) に決着をつける。
  // 離した時点では読まない —— stop() のあとに最後の 1 文が届くブラウザがあり、
  // そこで読むと最後のひとことが落ちる。
  const prevState = useRef(voice.state);
  useEffect(() => {
    const was = prevState.current;
    prevState.current = voice.state;

    // ★押していないのにマイクが開いた時だけ、こちらから閉じる。
    // 許可ダイアログの間に指を離すと、許可した瞬間に開きっぱなしになる。
    // 「開いた瞬間」だけを見るのが肝 —— 開いている最中を見てしまうと、
    // ふつうに離して stop() した直後にも当たり、自分で聞いた分を捨てる。
    if (was !== 'listening' && shouldForceStop(phaseRef.current, voice.state === 'listening')) {
      forcedRef.current = true;
      discardRef.current = true;
      voice.stop();
      return;
    }

    if (was !== 'listening' || voice.state === 'listening') return;

    // ★指がまだ乗っているのに閉じた時は、聞いた分を持ったまま開き直す。
    // (ここで decideHeard へ進むと、押している最中に「聞き取れませんでした」が出て
    //  それまでに言った分も捨ててしまう)
    if (shouldKeepListening(phaseRef.current, voice.state === 'error', relistenRef.current)) {
      relistenRef.current += 1;
      voice.start();
      return;
    }

    const { outcome, text } = decideHeard({
      discard: discardRef.current,
      finals: finalsRef.current,
      lastInterim: interimRef.current,
    });
    finalsRef.current = [];
    interimRef.current = '';
    discardRef.current = false;
    if (voice.state === 'error') { notice(micMessage('error', voice.errorCode)); return; }
    // 離すのが早すぎて、開いた直後に閉じた時は「長押しです」と言う
    // (何もしていないのに「取り消しました」と出ると、何が起きたのか分からない)
    if (forcedRef.current) { forcedRef.current = false; notice(micMessage('tooShort')); return; }
    if (outcome === 'insert') { emit(null); insertRef.current(text); return; }
    notice(micMessage(outcome));
  }, [voice, emit, notice]);

  // 画面から消える時は必ず閉じる (開いたまま置き去りにしない)
  useEffect(() => () => {
    clearHoldTimer();
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 使えない端末では、押せないボタンを置かない (押しても何も起きない物を見せない)
  if (!voice.isAvailable) return null;

  const listening = phase === 'recording';

  return (
    <button
      type="button"
      aria-label="長押しで話す"
      aria-pressed={listening}
      title="押したまま話して、離すと文字になります（実行はされません）"
      onPointerDown={e => {
        // 焦点を入力欄に残す。ボタンへ移ると スマホではキーボードが閉じて
        // 画面が動き、その拍子の pointercancel で録音が始まる前に取り消される。
        e.preventDefault();
        down();
      }}
      onPointerUp={up}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down(); } }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); up(); } }}
      onBlur={cancel}
      className="flex items-center justify-center rounded-lg flex-shrink-0 relative"
      style={{
        width: BTN, height: BTN,
        color: listening ? '#fff' : 'var(--prism-creative, #A78BFA)',
        background: listening ? '#EF4444' : 'transparent',
        border: `1px solid ${listening ? '#EF4444' : 'var(--border)'}`,
        // 長押しで iOS の選択メニューが出ると、指を離しても押しっぱなしのまま残る
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {listening && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-lg"
          style={{ border: '2px solid #EF4444' }}
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.35, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <Mic size={17} />
    </button>
  );
}
