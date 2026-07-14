// ============================================================
// useEmailBlobSync — 同一メール基準の軽量クラウド同期（/api/account/blob）
//
// 目的: 同じメールアドレスなら端末が変わっても、無料期間中に貯めたデータを
//       そのまま引き継ぐ（PC→スマホで「また1から」を根治）。
//
// Supabase認証に依存せず、アプリ既存の email ログインだけで動く。
// - ログイン中(email あり)で、初回マウント時に cloud → local を pull（マージ）
// - 以降 value 変化で cloud へ push（debounce）
// - email が無い／サーバー未設定なら完全 no-op（localStorage が唯一の永続層のまま）
// ============================================================
import { useEffect, useRef } from 'react';

interface Options<T> {
  /** blob API の key（'knowledge' | 'personas' | 'settings'） */
  key: 'knowledge' | 'personas' | 'settings';
  /** ログイン中ユーザーのメール（無ければ同期しない） */
  email: string | null | undefined;
  /** 現在の値 */
  value: T;
  /** cloud から来た値をローカルへ反映するハンドラ（マージ結果を渡す） */
  onRemote: (remote: T) => void;
  /** ローカルとリモートをマージ（既定: リモート優先で結合しない＝呼び出し側で指定推奨） */
  merge?: (local: T, remote: T) => T;
  /** 空判定（空を push して上書き事故を防ぐ） */
  isEmpty?: (v: T) => boolean;
  /** push を止めるフラグ */
  enabled?: boolean;
  debounceMs?: number;
}

export function useEmailBlobSync<T>({
  key,
  email,
  value,
  onRemote,
  merge,
  isEmpty,
  enabled = true,
  debounceMs = 2000,
}: Options<T>) {
  const pulledRef = useRef(false);
  const lastPushedRef = useRef<string>('');
  const valueRef = useRef<T>(value);
  valueRef.current = value;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. ログイン確定時に一度だけ cloud → local を pull（端末引き継ぎ） ──
  useEffect(() => {
    if (!enabled || !email) return;
    pulledRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/account/blob?email=${encodeURIComponent(email)}&key=${key}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok && j?.value != null) {
          const remote = j.value as T;
          const next = merge ? merge(valueRef.current, remote) : remote;
          onRemote(next);
          lastPushedRef.current = JSON.stringify(next);
        }
      } catch { /* 失敗してもローカルはそのまま使える */ } finally {
        pulledRef.current = true;
      }
    })();
    return () => { cancelled = true; };
    // email 変化（ログイン）時のみ再 pull
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, key, enabled]);

  // ── 2. 変更を cloud へ push（pull 完了後・debounce・空は送らない） ──
  useEffect(() => {
    if (!enabled || !email) return;
    if (!pulledRef.current) return;
    if (isEmpty?.(value)) return;
    const serialized = JSON.stringify(value);
    if (serialized === lastPushedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch('/api/account/blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, key, value }),
      }).then(() => { lastPushedRef.current = serialized; }).catch(() => { /* 次の変更で再試行 */ });
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, email, key, enabled]);
}
