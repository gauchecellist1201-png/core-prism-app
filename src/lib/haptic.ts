// ============================================================
// 触感フィードバック — ボタン押下時の振動 + 上質な微音
// iOS Safari は vibrate 非対応のため、視覚側 (scale) と音で吸収する前提
//
// 音の設計方針: 単純な「ピッ」というビープではなく、
//   1) ローパスフィルタで角を丸めた「木のような」やわらかい音
//   2) わずかなピッチグライドで生っぽい打感
//   3) 控えめな音量 — 静かな場所でも不快にならない
// にすることで、Haiku 1 モデルでも「贅沢なサービス」と感じる手触りを作る。
// ============================================================

type HapticStrength = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const VIBRATE_PATTERNS: Record<HapticStrength, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
};

export function triggerHaptic(strength: HapticStrength = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(VIBRATE_PATTERNS[strength]);
  } catch {
    // noop
  }
}

// ------------------------------------------------------------
// 効果音の ON/OFF (やさしさの配慮) — 既定は ON、localStorage に保存
// ------------------------------------------------------------
const SOUND_KEY = 'core-ui-sound';
let soundEnabledCache: boolean | null = null;

export function isSoundEnabled(): boolean {
  if (soundEnabledCache !== null) return soundEnabledCache;
  if (typeof localStorage === 'undefined') return true;
  try {
    soundEnabledCache = localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    soundEnabledCache = true;
  }
  return soundEnabledCache;
}

export function setSoundEnabled(on: boolean): void {
  soundEnabledCache = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // noop
  }
}

// ------------------------------------------------------------
// 共有 AudioContext (作りっぱなしを避け、1 つだけ使い回す)
// ------------------------------------------------------------
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  if (!audioCtx) {
    try { audioCtx = new Ctor(); } catch { return null; }
  }
  return audioCtx;
}

// ------------------------------------------------------------
// 1 音を鳴らす土台 — ローパス + グライド + なめらかな減衰
// ------------------------------------------------------------
type Voice = {
  /** 着地する周波数 (Hz) */
  freq: number;
  type: OscillatorType;
  /** 鳴っている長さ (秒) */
  duration: number;
  /** 音量 (0〜1、実際は 0.06 前後で十分) */
  gain: number;
  /** 立ち上がり時間 (秒)。短いほど打感が鋭い */
  attack?: number;
  /** 開始周波数。指定すると freq へ滑らかに着地し、生っぽい打感になる */
  glideFrom?: number;
  /** ローパス遮断周波数。指定すると高音の角が取れて温かい音色に */
  lowpass?: number;
  /** 再生開始のずらし (秒) — 和音やアルペジオに使う */
  delay?: number;
};

function playVoice(ctx: AudioContext, v: Voice): void {
  const t0 = ctx.currentTime + (v.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = v.type;

  if (v.glideFrom) {
    osc.frequency.setValueAtTime(v.glideFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(v.freq, t0 + Math.min(v.duration, 0.12));
  } else {
    osc.frequency.setValueAtTime(v.freq, t0);
  }

  const attack = v.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.duration);

  let tail: AudioNode = osc;
  if (v.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = v.lowpass;
    lp.Q.value = 0.7;
    osc.connect(lp);
    tail = lp;
  }
  tail.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + v.duration + 0.05);
}

// ------------------------------------------------------------
// 単音プリセット — タップや開閉のひびき
// ------------------------------------------------------------
type ClickTone = 'tap' | 'open' | 'close' | 'success';

const TONE_CONFIG: Record<ClickTone, Voice> = {
  // 薄い 1800Hz ビープ → 低めで木のような「コツッ」へ
  tap:     { freq: 430,  glideFrom: 620, type: 'triangle', duration: 0.055, gain: 0.05,  lowpass: 1300, attack: 0.004 },
  open:    { freq: 780,  glideFrom: 540, type: 'sine',     duration: 0.13,  gain: 0.045, lowpass: 2400, attack: 0.012 },
  close:   { freq: 410,  glideFrom: 600, type: 'sine',     duration: 0.12,  gain: 0.045, lowpass: 1700, attack: 0.012 },
  success: { freq: 1180, glideFrom: 880, type: 'sine',     duration: 0.18,  gain: 0.05,  lowpass: 3200, attack: 0.01 },
};

export function playClick(tone: ClickTone = 'tap'): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    playVoice(ctx, TONE_CONFIG[tone]);
  } catch {
    // noop
  }
}

// ------------------------------------------------------------
// 和音チャイム — 完了・ごほうび・やさしいエラー
// ------------------------------------------------------------
type ChimeName = 'success' | 'reward' | 'error' | 'celebrate';

const CHIMES: Record<ChimeName, Voice[]> = {
  // ふわっとした「できました」 (E5 → B5 の長三度上行)
  success: [
    { freq: 659.25, type: 'sine', duration: 0.42, gain: 0.05,  lowpass: 3200, attack: 0.02 },
    { freq: 987.77, type: 'sine', duration: 0.52, gain: 0.045, lowpass: 3600, attack: 0.02, delay: 0.085 },
  ],
  // AI 生成が終わった瞬間のごほうび (E5 → G#5 → C#6 の明るい三和音)
  reward: [
    { freq: 659.25,  type: 'sine', duration: 0.45, gain: 0.055, lowpass: 3200, attack: 0.02 },
    { freq: 830.61,  type: 'sine', duration: 0.50, gain: 0.05,  lowpass: 3400, attack: 0.02,  delay: 0.085 },
    { freq: 1108.73, type: 'sine', duration: 0.62, gain: 0.045, lowpass: 3900, attack: 0.025, delay: 0.17 },
  ],
  // 角のない低め 2 音下行 — 「叱る音」にしない。やさしく気づかせるだけ
  error: [
    { freq: 392.00, type: 'triangle', duration: 0.22, gain: 0.045, lowpass: 1400, attack: 0.012 },
    { freq: 311.13, type: 'triangle', duration: 0.30, gain: 0.04,  lowpass: 1200, attack: 0.012, delay: 0.11 },
  ],
  // 大きな達成のお祝い (C5 → E5 → G5 → C6 のアルペジオ)
  celebrate: [
    { freq: 523.25,  type: 'sine', duration: 0.40, gain: 0.05, lowpass: 3000, attack: 0.02 },
    { freq: 659.25,  type: 'sine', duration: 0.40, gain: 0.05, lowpass: 3200, attack: 0.02,  delay: 0.08 },
    { freq: 783.99,  type: 'sine', duration: 0.45, gain: 0.05, lowpass: 3400, attack: 0.02,  delay: 0.16 },
    { freq: 1046.50, type: 'sine', duration: 0.72, gain: 0.05, lowpass: 4200, attack: 0.025, delay: 0.24 },
  ],
};

export function playChime(name: ChimeName = 'success'): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    for (const v of CHIMES[name]) playVoice(ctx, v);
  } catch {
    // noop
  }
}

// ------------------------------------------------------------
// プリセット: 振動 + 音をまとめて鳴らす
// ------------------------------------------------------------
export function tactileTap(): void {
  triggerHaptic('light');
  playClick('tap');
}

export function tactileOpen(): void {
  triggerHaptic('medium');
  playClick('open');
}

export function tactileClose(): void {
  triggerHaptic('light');
  playClick('close');
}

export function tactileSuccess(): void {
  triggerHaptic('success');
  playChime('success');
}

export function tactileReward(): void {
  triggerHaptic('success');
  playChime('reward');
}

export function tactileError(): void {
  triggerHaptic('error');
  playChime('error');
}
