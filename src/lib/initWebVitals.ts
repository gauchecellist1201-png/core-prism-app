// ============================================================
// initWebVitals.ts — Core Web Vitals を /api/track/web-vitals に送信
//
// オーナー指示 (2026-06-04 第 39 波 AAAAAA):
//   web-vitals npm 依存なし。Performance API のみで LCP / CLS / INP / FCP / TTFB を
//   軽量に観測 → sendBeacon で 投げる。
//
// 使い方:
//   import { initWebVitals } from './lib/initWebVitals';
//   initWebVitals();  // App.tsx で 1 度だけ
// ============================================================

const ENDPOINT = '/api/track/web-vitals';

let initialized = false;

function deviceId(): string {
  try {
    let id = localStorage.getItem('core_device_id');
    if (!id) {
      id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('core_device_id', id);
    }
    return id;
  } catch { return 'anon'; }
}

function send(name: string, value: number, rating?: string) {
  try {
    const payload = JSON.stringify({
      name,
      value: Math.round(value * 100) / 100,
      id: deviceId(),
      path: location.pathname,
      rating,
      ua: navigator.userAgent?.slice(0, 200),
    });
    // sendBeacon は keepalive 同等 + ページ離脱時にも 送れる
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* */ });
  } catch { /* */ }
}

function rate(name: string, value: number): string {
  // Core Web Vitals 公式しきい値 (2024-12 時点)
  switch (name) {
    case 'LCP':  return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'CLS':  return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'INP':  return value <= 200  ? 'good' : value <= 500  ? 'needs-improvement' : 'poor';
    case 'FCP':  return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800  ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
  }
  return 'unknown';
}

export function initWebVitals(opts?: { sampleRate?: number }) {
  if (initialized) return;
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  initialized = true;

  // 軽量サンプリング (既定 100%、ただし 過剰送信 防止に 重複 抑制)
  const sample = Math.max(0, Math.min(1, opts?.sampleRate ?? 1));
  const sent = new Set<string>();
  const dedup = (k: string) => sent.has(k) ? false : (sent.add(k), true);
  const should = () => Math.random() < sample;

  // ─── FCP ─────────────────────────
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint' && dedup('FCP') && should()) {
          send('FCP', entry.startTime, rate('FCP', entry.startTime));
        }
      }
    });
    obs.observe({ type: 'paint', buffered: true });
  } catch { /* */ }

  // ─── LCP (最終 LCP は ページ離脱 / visibility hidden 時に確定) ─────────
  try {
    let lcpValue = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if ((entry.size || 0) > 0) lcpValue = entry.startTime;
      }
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });
    const flush = () => {
      if (lcpValue > 0 && dedup('LCP') && should()) {
        send('LCP', lcpValue, rate('LCP', lcpValue));
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    }, { once: false });
    window.addEventListener('pagehide', flush, { once: true });
  } catch { /* */ }

  // ─── CLS (cumulative; flush on hide) ─────────────────────────
  try {
    let cls = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });
    obs.observe({ type: 'layout-shift', buffered: true });
    const flush = () => {
      if (dedup('CLS') && should()) {
        send('CLS', cls, rate('CLS', cls));
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush, { once: true });
  } catch { /* */ }

  // ─── INP (Interaction to Next Paint, max(event processing latency)) ──
  try {
    let inp = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        const d = entry.duration ?? 0;
        if (d > inp) inp = d;
      }
    });
    obs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
    const flush = () => {
      if (inp > 0 && dedup('INP') && should()) {
        send('INP', inp, rate('INP', inp));
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush, { once: true });
  } catch { /* */ }

  // ─── TTFB (Navigation Timing) ─────────────────────────
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0 && dedup('TTFB') && should()) {
      send('TTFB', nav.responseStart, rate('TTFB', nav.responseStart));
    }
  } catch { /* */ }
}
