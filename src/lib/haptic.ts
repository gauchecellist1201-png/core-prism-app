// ============================================================
// 触感フィードバック — ボタン押下時の振動 + 微音
// iOS Safari は vibrate 非対応のため、視覚側 (scale) で吸収する前提
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

type ClickTone = 'tap' | 'open' | 'close' | 'success';

const TONE_CONFIG: Record<ClickTone, { freq: number; duration: number; type: OscillatorType; gain: number }> = {
  tap:     { freq: 1800, duration: 0.04, type: 'sine',     gain: 0.04 },
  open:    { freq: 880,  duration: 0.09, type: 'triangle', gain: 0.05 },
  close:   { freq: 420,  duration: 0.08, type: 'triangle', gain: 0.05 },
  success: { freq: 1320, duration: 0.18, type: 'sine',     gain: 0.06 },
};

export function playClick(tone: ClickTone = 'tap'): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const cfg = TONE_CONFIG[tone];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.value = cfg.freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(cfg.gain, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + cfg.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + cfg.duration + 0.02);
  } catch {
    // noop
  }
}

// プリセット: 押した瞬間のタクタイル (振動 + 微音)
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
  playClick('success');
}
