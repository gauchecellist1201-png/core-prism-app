// ============================================================
// voiceHold — 「長押ししている間だけ聞く」マイクの決まりごと
//
// なぜ長押しなのか (2026-09-09):
//   短い指示は打つ方が速い。音声は「長くて複雑な指示」のためのもの、と割り切る。
//   だからタップでは絶対に始まらない。指を置いた"だけ"でマイクが開くと、
//   打とうとしただけの人に許可ダイアログが出る = いちばん要らない邪魔になる。
//
// なぜ離した瞬間に"入れるだけ"なのか:
//   離した瞬間に先頭の候補を実行すると、聞き違いがそのまま別の画面を開く。
//   コマンドバーは Enter が先頭候補を実行する道具なので、音声は
//   「文字にして入力欄へ入れる」ところまでで止める。実行は人が決める。
//
// ここには画面も Web Speech も入れない (純粋な関数だけ = テストで固定できる)。
// ============================================================

/** これより短い押しは「打とうとしただけ」とみなして、マイクを開かない */
export const HOLD_MIN_MS = 350;

/** 押している間の段階 */
export type HoldPhase =
  | 'idle'       // 触っていない
  | 'pending'    // 指は乗ったが、まだ長押しに届いていない
  | 'recording'; // 長押しに届いた = 聞いている

export type HoldEvent =
  | { type: 'down'; at: number }   // 指が乗った
  | { type: 'hold'; at: number }   // 長押しの時間に届いた (タイマー)
  | { type: 'up'; at: number }     // 指を離した
  | { type: 'cancel' };            // 指が外へ出た / 割り込みが入った

export type HoldOutcome =
  | 'none'      // 何もしない
  | 'start'     // マイクを開く
  | 'commit'    // 聞いた分を入力欄へ入れる
  | 'discard'   // 聞いた分を捨てる (外へ出した = 取り消し)
  | 'tooShort'; // 長押しに届かなかった (黙って無視せず、一言だけ出す)

/**
 * 押している間の段階を進める。副作用ゼロ・時計を読まない (時刻は必ず引数で渡す)。
 * 「いま何をすべきか」(outcome) は 1 回の遷移につき 1 つだけ返す。
 */
export function holdReducer(
  phase: HoldPhase,
  ev: HoldEvent,
): { phase: HoldPhase; outcome: HoldOutcome } {
  switch (ev.type) {
    case 'down':
      // 既に聞いている最中の down は無視する (2 本目の指で二重に開かない)
      if (phase === 'recording') return { phase, outcome: 'none' };
      return { phase: 'pending', outcome: 'none' };

    case 'hold':
      // 指が乗っている時だけ開く。離した後に遅れて来たタイマーでは開かない
      if (phase !== 'pending') return { phase, outcome: 'none' };
      return { phase: 'recording', outcome: 'start' };

    case 'up':
      if (phase === 'recording') return { phase: 'idle', outcome: 'commit' };
      if (phase === 'pending') return { phase: 'idle', outcome: 'tooShort' };
      return { phase: 'idle', outcome: 'none' };

    case 'cancel':
      // 聞いていた分は捨てる。ここが「やっぱりやめた」の唯一の出口
      if (phase === 'recording') return { phase: 'idle', outcome: 'discard' };
      return { phase: 'idle', outcome: 'none' };
  }
}

/** 聞き取った文の掃除。空白だけ・改行だけは「何も言っていない」として空にする */
export function normalizeTranscript(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * 聞き取った文を、いま打ってある文の後ろへ足す。
 *
 * 守ること:
 *   ・打ってあった文を消さない (置き換えない)。音声は"足す"だけ。
 *   ・空なら 1 文字も変えない (呼ぶ側が「聞き取れませんでした」を出せるように、
 *     同じ文字列をそのまま返す)。
 *   ・@ で対象を指している途中なら、必ず空白を 1 つ挟む。
 *     挟まないと「@ナ」+「売上を教えて」が "@ナ売上を教えて" になり、
 *     指した対象が別物の名前に化ける (指定が静かに壊れる形)。
 *   ・英数字どうしがくっつく時だけ空白を挟む。日本語には勝手に空白を入れない。
 */
export function mergeVoiceIntoQuery(query: string, transcript: string): string {
  const said = normalizeTranscript(transcript);
  if (!said) return query;
  const head = query.replace(/\s+$/, '');
  if (!head) return said;
  const openMention = /(?:^|\s)@[^\s@]*$/.test(head);
  const glued = /[A-Za-z0-9]$/.test(head) && /^[A-Za-z0-9]/.test(said);
  return head + (openMention || glued ? ' ' : '') + said;
}

/** 離した後、聞こえていた分をどう扱うか */
export type HeardOutcome =
  | 'insert'       // 入力欄へ入れる
  | 'discarded'    // 取り消した (指を外へ出した)
  | 'nothingHeard'; // マイクは開いたが、言葉が 1 つも取れなかった

/**
 * 「聞こえた分」の決着。
 *
 * 守ること:
 *   ・取り消した時は、取れていても入れない (外へ出したのに入るのが最悪)。
 *   ・確定した文が 1 つでもあるなら、途中経過 (interim) は使わない。
 *     使うと、確定した文と途中経過で同じ言葉が二重に入る。
 *   ・確定が 1 つも無い時だけ、途中経過を拾う (stop() の直後に確定が来ないブラウザがある)。
 *   ・何も取れなかった時は空を返す = 呼ぶ側が必ず一言出す (黙って何も起きない、を作らない)。
 */
export function decideHeard(opts: {
  discard: boolean;
  finals: string[];
  lastInterim: string;
}): { outcome: HeardOutcome; text: string } {
  if (opts.discard) return { outcome: 'discarded', text: '' };
  const joined = opts.finals.join('');
  const text = normalizeTranscript(joined || opts.lastInterim);
  if (!text) return { outcome: 'nothingHeard', text: '' };
  return { outcome: 'insert', text };
}

/**
 * ★指を離した後にマイクが開いた時は、すぐ閉じる。
 * 許可ダイアログが出ている間に指を離すと、許可した瞬間に録音が始まり、
 * 押していないのに開きっぱなしになる (画面には何も出ないので気づけない形)。
 */
export function shouldForceStop(phase: HoldPhase, recognizerListening: boolean): boolean {
  return recognizerListening && phase !== 'recording';
}

/**
 * 出す一言。どの結末でも必ず何かを返す = 「押したのに何も起きない」を作らない。
 * (空文字を返す道を 1 本も作らないこと自体が、ここの仕事)
 */
export function micMessage(
  kind: 'tooShort' | 'nothingHeard' | 'discarded' | 'notStarted' | 'error',
  errorCode?: string | null,
): string {
  switch (kind) {
    case 'tooShort':     return 'マイクは長押しです。押したまま話して、離すと文字になります';
    case 'nothingHeard': return '聞き取れませんでした。もう一度、押したまま話してください';
    case 'discarded':    return '取り消しました';
    case 'notStarted':   return 'マイクが開きませんでした。ブラウザのマイクの許可を確認してください';
    case 'error':
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed')
        return 'マイクの使用が許可されていません。ブラウザの設定から許可してください';
      if (errorCode === 'audio-capture') return 'マイクが見つかりませんでした';
      if (errorCode === 'network')       return '通信が届かず、文字にできませんでした';
      return '音声を文字にできませんでした。打ち込みでお願いします';
  }
}

/** 指を置いたままの間に、こちらから開き直す回数の上限 */
export const MAX_RELISTEN = 3;

/**
 * ★指がまだ乗っているのに、マイクの方が勝手に閉じた時は開き直す。
 *
 * Chrome の音声認識は continuous = true でも、数秒の無音や 1 文の区切りで
 * 自分から終わる。開き直さないと「押しているのに、途中から聞いていない」
 * ——画面は赤いまま・言った言葉だけが落ちる、という気づけない壊れ方になる。
 *
 * 上限を置くのは、開けない端末で無限に開き直し続けないため
 * (許可されていない時は 1 回目の失敗が即 error になるので、そこでも止まる)。
 */
export function shouldKeepListening(
  phase: HoldPhase,
  endedWithError: boolean,
  relistens: number,
  max: number = MAX_RELISTEN,
): boolean {
  return phase === 'recording' && !endedWithError && relistens < max;
}

/**
 * ★離した時に、マイクがまだ一度も開いていなかった場合の後始末。
 *
 * 実際に起きた事故 (2026-09-09 本番実測): マイクが許可されていない端末では
 * `start()` を呼んでも `onstart` が来ないため「聞いている」から抜ける瞬間が無く、
 * 決着をつける仕掛けが**一度も動かない**。結果、指を離したあとも
 * **「聞いています…」が出たまま貼り付く**（何も聞いていないのに、聞いている顔をする）。
 *
 * なので「聞いていた相手がいない」時は、その場で決着をつける。
 * 逆に本当に聞いていた時は null を返す —— そちらは onend で決着させないと、
 * stop() のあとに届く最後のひとことが落ちる。
 */
export function settleKind(
  outcome: HoldOutcome,
  recognizerListening: boolean,
): 'notStarted' | 'discarded' | null {
  if (outcome !== 'commit' && outcome !== 'discard') return null;
  if (recognizerListening) return null;
  return outcome === 'discard' ? 'discarded' : 'notStarted';
}
