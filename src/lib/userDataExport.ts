// ============================================================
// userDataExport.ts — GDPR / 個情法 対応「データ全件 持ち出し」
//
// オーナー指示 (2026-06-04 第 16 波 JJJ):
//   ユーザーが「自分のデータを全部 JSON で持ち出す」を 1 タップで可能に。
//
// 集約対象:
//   1. localStorage の全キー (core_* / iris_* / 暗号化されていないもの)
//   2. ブラウザ環境メタ (timezone, language, ua) — 個人特定情報は除外
//   3. Stripe Customer / Subscriptions / Charges (任意。/api/user/export 経由)
//   4. Upstash 保存分 — DAU device id / オンボ funnel カウンタ など (端末 ID で取れる範囲)
//
// 出力:
//   - 単一 JSON ファイル (zip は依存追加を避けるため見送り。JSON で十分)
//   - 1 ファイル ダウンロード (Date.now() のタイムスタンプ付き)
// ============================================================

const RELEVANT_LOCAL_PREFIXES = ['core_', 'iris_', 'lang', 'theme'];

interface ExportPayload {
  meta: {
    generatedAt: string;
    appVersion: string;
    timezone: string;
    language: string;
    userAgent: string;
    note: string;
  };
  localStorage: Record<string, unknown>;
  server: {
    fetched: boolean;
    fetchedAt: string | null;
    stripe?: unknown;
    subscriptions?: unknown;
    retention?: unknown;
    onboardingFunnel?: unknown;
    feedback?: unknown;
    error?: string | null;
  };
}

function readAllLocal(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // 関心のあるプレフィクスのみ集約 (関係ない 3rd-party キーは除外)
      if (!RELEVANT_LOCAL_PREFIXES.some(p => k === p || k.startsWith(p))) continue;
      const v = localStorage.getItem(k);
      if (v == null) continue;
      // JSON として読めるなら構造化、ダメなら文字列のまま
      try { out[k] = JSON.parse(v); }
      catch { out[k] = v; }
    }
  } catch { /* */ }
  return out;
}

function metaInfo(): ExportPayload['meta'] {
  const safeUa = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  return {
    generatedAt: new Date().toISOString(),
    appVersion: 'core-prism (export v1)',
    timezone: Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || 'unknown',
    language: (typeof navigator !== 'undefined' && navigator.language) || 'unknown',
    userAgent: safeUa.slice(0, 300),
    note: '本ファイルは CORE Prism のユーザーデータ エクスポートです。個人で保管し、共有時は注意してください。',
  };
}

async function fetchServerData(stripeUserKey: string | null, deviceId: string | null): Promise<ExportPayload['server']> {
  try {
    const res = await fetch('/api/user/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripeUserKey: stripeUserKey || null, deviceId: deviceId || null }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { fetched: false, fetchedAt: new Date().toISOString(), error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    const j = await res.json();
    return { fetched: true, fetchedAt: new Date().toISOString(), ...j, error: null };
  } catch (e) {
    return { fetched: false, fetchedAt: new Date().toISOString(), error: (e as Error).message };
  }
}

export async function buildUserExport(): Promise<ExportPayload> {
  const local = readAllLocal();
  const deviceId = (typeof local['core_device_id_v1'] === 'string' ? local['core_device_id_v1'] : null) as string | null;
  const stripeUserKey = (typeof local['core_stripe_user_key_v1'] === 'string' ? local['core_stripe_user_key_v1'] : null) as string | null;
  const server = await fetchServerData(stripeUserKey, deviceId);
  return { meta: metaInfo(), localStorage: local, server };
}

export async function downloadUserExport(): Promise<void> {
  const payload = await buildUserExport();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob(['﻿', json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `core-prism_user-data_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
