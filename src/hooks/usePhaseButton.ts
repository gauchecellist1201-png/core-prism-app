// ============================================================
// usePhaseButton — 「押した瞬間の手応え」共通フック
// idle → pending (スピナー) → success (緑フラッシュ) → idle と
// 状態遷移を 1 行で扱えるようにする。
// 使い方:
//   const send = usePhaseButton();
//   <button disabled={send.isPending} className={send.successClass}
//           onClick={() => send.run(async () => { await onSend(msg); })}>
//     {send.isPending ? '送信中…' : send.isSuccess ? '送れました' : '送信'}
//   </button>
// 参考: src/components/ApiErrorCard.tsx で同じ思想を直書きしている。
// CSS: .cp-phase-spin / .cp-phase-success は src/index.css に既存。
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionPhase = 'idle' | 'pending' | 'success';

interface Options {
  /** 成功フラッシュを見せる時間 (ms)。default 900ms。close 動作の前に光らせたい場合に上げる */
  successDuration?: number;
}

export interface PhaseButtonApi {
  phase: ActionPhase;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  /** 押した瞬間に pending に遷移し、与えられた task の完了で success に。
   *  task は同期/Promise どちらでも OK。例外は捕捉して呼び元の親で error 表示する想定。 */
  run: (task: () => unknown | Promise<unknown>) => Promise<void>;
  /** task を走らせずに直接 success を 1 回点灯させたい時 (確定動作) */
  flashSuccess: () => void;
  /** undefined 互換: success の時だけ `cp-phase-success` を付ける className 値 */
  successClass: string | undefined;
}

export function usePhaseButton(options?: Options): PhaseButtonApi {
  const successDuration = options?.successDuration ?? 900;
  const [phase, setPhase] = useState<ActionPhase>('idle');
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (mounted.current) setPhase('idle');
    }, successDuration);
  }, [successDuration]);

  const run = useCallback(async (task: () => unknown | Promise<unknown>) => {
    setPhase(prev => (prev === 'pending' ? prev : 'pending'));
    try {
      await Promise.resolve(task());
    } catch {
      // 失敗時は静かに idle に戻す (エラー表示は親側 ApiErrorCard 等に任せる)
      if (mounted.current) setPhase('idle');
      return;
    }
    if (!mounted.current) return;
    setPhase('success');
    scheduleReset();
  }, [scheduleReset]);

  const flashSuccess = useCallback(() => {
    setPhase('success');
    scheduleReset();
  }, [scheduleReset]);

  return {
    phase,
    isIdle: phase === 'idle',
    isPending: phase === 'pending',
    isSuccess: phase === 'success',
    run,
    flashSuccess,
    successClass: phase === 'success' ? 'cp-phase-success' : undefined,
  };
}
