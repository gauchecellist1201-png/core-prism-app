// ============================================================
// CORE Prism ▸ 今日のカラダ カード
//
// /api/health/ingest から email-hash で本日分の健康データを取得し、
// 歩数 / 睡眠 / 心拍 / 体重 / 気分 をひと目で表示する。
// データが無いときは「セットアップしましょう」ボタンを出して
// HealthShortcutGuide に誘導する。
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HealthShortcutGuide from './HealthShortcutGuide';
import {
  getAppleHealthSyncState,
  normalizeIngestedDays,
  type AppleHealthSyncState,
} from '../lib/healthIngest';
import type { DailyHealth } from '../types/health';

interface Props {
  email: string;
  onSyncedDays?: (days: DailyHealth[]) => void;
}

interface ServerDay {
  date: string;
  source?: string;
  appleHealthReceived?: boolean;
  metrics: {
    steps?: number;
    restingHR?: number;
    heartRate?: number;
    sleepHours?: number;
    weightKg?: number;
    mood?: number;
  };
  ts?: number;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😣',
  2: '😕',
  3: '🙂',
  4: '😊',
  5: '🤩',
};

function fmt(v: number | undefined, suffix = '', digits = 0): string {
  if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '—';
  return digits === 0 ? `${Math.round(v).toLocaleString()}${suffix}` : `${v.toFixed(digits)}${suffix}`;
}

function fmtSleep(h: number | undefined): string {
  if (typeof h !== 'number' || !isFinite(h) || h <= 0) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

function presentSyncStatus(syncState: AppleHealthSyncState, loading: boolean, error: string | null) {
  if (loading) return { label: '同期を確認中', tone: 'neutral' as const };
  if (error) return { label: '状態を確認できません', tone: 'neutral' as const };
  if (syncState.kind === 'stale') return { label: '同期が止まっています', tone: 'warning' as const };
  if (syncState.kind === 'current') {
    return {
      label: syncState.daysBehind === 0 ? '今朝 同期済み' : '昨日まで同期済み',
      tone: 'ok' as const,
    };
  }
  return { label: 'Apple Health 未接続', tone: 'neutral' as const };
}

export default function TodaysBodyCard({ email, onSyncedDays }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [remote, setRemote] = useState<{
    email: string;
    day: ServerDay | null;
    syncState: AppleHealthSyncState;
    configured: boolean | null;
    error: string | null;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!email) return;
    const controller = new AbortController();
    sha256Hex(email)
      .then((hash) => fetch(`/api/health/ingest?hash=${hash}`, {
        method: 'GET',
        headers: { 'X-User-Email-Hash': hash },
        signal: controller.signal,
      }))
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json: unknown = await response.json();
        if (!json || typeof json !== 'object') throw new Error('invalid_response');
        return json as { configured?: boolean; days?: unknown };
      })
      .then((j) => {
        if (!alive) return;
        const days: ServerDay[] = Array.isArray(j?.days) ? j.days : [];
        const syncedDays = normalizeIngestedDays(days);
        if (syncedDays.length > 0) onSyncedDays?.(syncedDays);
        const t = today();
        const todayDay = days.find((d) => d.date === t);
        setRemote({
          email,
          day: todayDay ?? days[days.length - 1] ?? null,
          syncState: getAppleHealthSyncState(days, t),
          configured: typeof j.configured === 'boolean' ? j.configured : null,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!alive || controller.signal.aborted) return;
        setRemote({
          email,
          day: null,
          syncState: { kind: 'not-connected' },
          configured: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [email, onSyncedDays, refreshKey]);

  // ショートカット実行後にアプリへ戻った時と、日付が変わった時に状態を再確認する。
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1);
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 1, 0, 0);
    const midnightTimer = window.setTimeout(() => setRefreshKey((key) => key + 1), nextDay.getTime() - now.getTime());
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearTimeout(midnightTimer);
    };
  }, [refreshKey]);

  // emailと結び付かない結果は描画しない。アカウント切替中に前の健康情報を見せない。
  const currentRemote = remote?.email === email ? remote : null;
  const loading = Boolean(email) && currentRemote === null;
  const day = currentRemote?.day ?? null;
  const syncState: AppleHealthSyncState = currentRemote?.syncState ?? { kind: 'not-connected' };
  const configured = currentRemote?.configured ?? null;
  const error = currentRemote?.error ?? null;

  const m = day?.metrics ?? {};
  const hr = m.restingHR ?? m.heartRate;
  const isToday = day?.date === today();

  const subtitle = useMemo(() => {
    if (loading) return '読み込み中…';
    if (error) return `読み込みに失敗: ${error}`;
    // 見出しが既に「まだ届いていません」なので、ここで繰り返さない。
    // 同じ言葉が 2 行続くと、読む人は 2 回目を読み飛ばす。
    if (!day) return 'iPhone とつなぐと、明日の朝から自動で届きます';
    if (isToday) return '今朝の iPhone から届きました';
    return `${day.date} に届いた最新データ`;
  }, [loading, error, day, isToday]);

  const empty = !loading && !day;
  const syncStatus = presentSyncStatus(syncState, loading, error);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-2xl p-4 sm:p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(46,111,255,0.10), rgba(232,75,151,0.07))',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.18em] font-semibold uppercase opacity-60">今日のカラダ</div>
            <div className="text-base sm:text-lg font-semibold mt-1">
              {isToday ? '今朝のあなた' : day ? `${day.date} のあなた` : 'まだ届いていません'}
            </div>
            <div className="text-xs opacity-70 mt-0.5">{subtitle}</div>
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-2 text-xs font-semibold"
              style={{
                color: syncStatus.tone === 'warning' ? '#FDE68A' : syncStatus.tone === 'ok' ? '#A7F3D0' : 'rgba(255,255,255,0.78)',
                background: syncStatus.tone === 'warning' ? 'rgba(180,83,9,0.28)' : syncStatus.tone === 'ok' ? 'rgba(5,150,105,0.20)' : 'rgba(255,255,255,0.08)',
                border: syncStatus.tone === 'warning' ? '1px solid rgba(251,191,36,0.45)' : syncStatus.tone === 'ok' ? '1px solid rgba(52,211,153,0.34)' : '1px solid rgba(255,255,255,0.12)',
              }}
              role="status"
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: syncStatus.tone === 'warning' ? '#FBBF24' : syncStatus.tone === 'ok' ? '#34D399' : '#94A3B8',
                  flexShrink: 0,
                }}
              />
              {syncStatus.label}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="text-xs px-2.5 rounded-md font-medium flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              // 375px で「3分で設定する」が 2 行に折れて潰れていた。折らずに 44px を確保する
              whiteSpace: 'nowrap',
              minHeight: 44,
            }}
          >
            {empty ? '3分で設定する' : '同期の設定'}
          </button>
        </header>

        {!empty && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            <Metric emoji="🚶" label="歩数" value={fmt(m.steps)} />
            <Metric emoji="😴" label="睡眠" value={fmtSleep(m.sleepHours)} />
            <Metric emoji="❤" label="心拍" value={fmt(hr, ' bpm')} />
            <Metric emoji="⚖" label="体重" value={fmt(m.weightKg, ' kg', 1)} />
            <Metric
              emoji={typeof m.mood === 'number' ? (MOOD_EMOJI[Math.round(m.mood)] ?? '🙂') : '🙂'}
              label="気分"
              value={typeof m.mood === 'number' ? `${Math.round(m.mood)} / 5` : '—'}
            />
          </div>
        )}

        {syncState.kind === 'stale' && !loading && !error && (
          <div
            className="mt-4 rounded-xl p-3 sm:p-4"
            style={{
              background: 'rgba(180,83,9,0.20)',
              border: '1px solid rgba(251,191,36,0.42)',
            }}
          >
            <div className="text-sm font-semibold" style={{ color: '#FDE68A' }}>
              {syncState.daysBehind}日間、Apple Healthから届いていません
            </div>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
              最後に届いたのは {syncState.latestDate} です。iPhoneの「ショートカット」→「オートメーション」で、毎朝の実行がオンか確認してください。
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="mt-3 rounded-lg px-4 text-sm font-semibold"
              style={{
                minHeight: 44,
                color: '#111827',
                background: '#FDE68A',
                border: '1px solid #FBBF24',
              }}
            >
              同期の設定を確認する
            </button>
          </div>
        )}

        {/* 空っぽの時、文章だけだと「何が埋まるのか」が想像できず設定する気にならない。
            埋まる枠そのものを（数字は入れず「—」のまま）先に見せる。
            嘘の数字は絶対に出さない — 見えているのは空欄と見出しだけ (2026-08-08 わかりやすさ回) */}
        {empty && (
          <>
            <p className="text-sm opacity-80 mt-3">
              iPhone の「ショートカット」を一度だけ設定すれば、明日の朝から毎日この欄が埋まります。
              アプリの追加は要りません。3 分ほどで終わります。
            </p>
            {/* Metric をそのまま並べると、空欄用の opacity 0.55 が全部に掛かって
                文字が読めないうえ、2 列 × 3 段で画面が伸びる。
                「何が届くか」だけ伝わればいいので、読める濃さの 1 行にする */}
            <div className="text-[11px] tracking-wide opacity-75 mt-4 mb-2">明日の朝、ここに届くもの</div>
            <div className="flex flex-wrap gap-1.5">
              {[['🚶', '歩数'], ['😴', '睡眠'], ['❤', '心拍'], ['⚖', '体重'], ['🙂', '気分']].map(([e, l]) => (
                <span
                  key={l}
                  className="text-[11.5px] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <span aria-hidden>{e}</span>{l}
                </span>
              ))}
            </div>
          </>
        )}

        {configured === false && (
          <p className="text-[11px] opacity-50 mt-3">
            ※ サーバー側の永続化 (Upstash) が未設定です。設定すれば毎日の履歴も貯まります。
          </p>
        )}
      </motion.div>

      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowGuide(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full">
              <HealthShortcutGuide email={email} onClose={() => setShowGuide(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Metric({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  const muted = value === '—';
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-0.5"
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: muted ? 0.55 : 1,
      }}
    >
      <div className="text-[10px] opacity-60 tracking-wide uppercase">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-base">{emoji}</span>
        <span className="text-base sm:text-lg font-semibold">{value}</span>
      </div>
    </div>
  );
}
