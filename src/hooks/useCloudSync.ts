// ============================================================
// useCloudSync — localStorage ↔ Supabase user_state の薄い同期レイヤ
// 既存 hooks に最小侵襲で挿し込めるよう、state と localStorage キーを渡すだけで動く。
// 未認証 / Supabase 未設定 → 何もしない (localStorage がそのまま唯一の永続層)
// ログイン中 → 起動時に cloud → local 一方向 pull、以降 state 変化で push (debounce)
// ============================================================
import { useEffect, useRef } from 'react';
import { kvGet, kvSet, isSupabaseConfigured } from '../lib/db';

interface Options<T> {
  /** localStorage キー兼 user_state.key */
  key: string;
  /** 現在の state */
  value: T;
  /** クラウドから取得したときの上書きハンドラ */
  setValue: (next: T) => void;
  /** push を抑制したいフラグ (任意) */
  enabled?: boolean;
  /** 既定値判定 (空配列など、無意味な空 push を防ぐ) */
  isEmpty?: (v: T) => boolean;
  /** debounce 間隔 (ms) */
  debounceMs?: number;
}

export function useCloudSync<T>({
  key,
  value,
  setValue,
  enabled = true,
  isEmpty,
  debounceMs = 1500,
}: Options<T>) {
  const hydratedRef = useRef(false);
  const lastPushedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. 初回ハイドレート: cloud → local (cloud が空なら無視) ──
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const remote = await kvGet<T>(key);
      if (cancelled) return;
      hydratedRef.current = true;
      if (remote == null) return;
      // 配列で remote が空ならローカルを尊重
      if (Array.isArray(remote) && (remote as unknown[]).length === 0) return;
      try {
        setValue(remote);
        lastPushedRef.current = JSON.stringify(remote);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
    // key 変更時のみ再ハイドレート
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // ── 2. state → cloud push (debounce、初回ハイドレート完了後のみ) ──
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;
    if (!hydratedRef.current) return;
    if (isEmpty?.(value)) return;
    const serialized = JSON.stringify(value);
    if (serialized === lastPushedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      kvSet(key, value).then(ok => {
        if (ok) lastPushedRef.current = serialized;
      });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, value, enabled, isEmpty, debounceMs]);
}
