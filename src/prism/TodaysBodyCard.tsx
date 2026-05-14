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

interface Props {
  email: string;
}

interface ServerDay {
  date: string;
  source?: string;
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

export default function TodaysBodyCard({ email }: Props) {
  const [hash, setHash] = useState<string>('');
  const [day, setDay] = useState<ServerDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    sha256Hex(email).then((h) => { if (alive) setHash(h); });
    return () => { alive = false; };
  }, [email]);

  useEffect(() => {
    if (!hash) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/health/ingest?hash=${hash}`, {
      method: 'GET',
      headers: { 'X-User-Email-Hash': hash },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setConfigured(!!j?.configured);
        const days: ServerDay[] = Array.isArray(j?.days) ? j.days : [];
        const t = today();
        const todayDay = days.find((d) => d.date === t);
        // 今日が無ければ最新を表示
        setDay(todayDay ?? days[days.length - 1] ?? null);
      })
      .catch((e) => { if (alive) setError(String(e?.message || e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hash]);

  const m = day?.metrics ?? {};
  const hr = m.restingHR ?? m.heartRate;
  const isToday = day?.date === today();

  const subtitle = useMemo(() => {
    if (loading) return '読み込み中…';
    if (error) return `読み込みに失敗: ${error}`;
    if (!day) return 'まだ届いていません — 下のボタンから iPhone の設定をしましょう';
    if (isToday) return '今朝の iPhone から届きました';
    return `${day.date} に届いた最新データ`;
  }, [loading, error, day, isToday]);

  const empty = !loading && !day;

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
          <div>
            <div className="text-[10px] tracking-[0.18em] font-semibold uppercase opacity-60">今日のカラダ</div>
            <div className="text-base sm:text-lg font-semibold mt-1">
              {isToday ? '今朝のあなた' : day ? `${day.date} のあなた` : 'まだ届いていません'}
            </div>
            <div className="text-xs opacity-70 mt-0.5">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="text-xs px-2.5 py-1.5 rounded-md font-medium"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {empty ? 'セットアップする' : '同期の設定'}
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

        {empty && (
          <p className="text-sm opacity-80 mt-3">
            iPhone の「ショートカット」を一度だけ設定すれば、明日の朝から毎日この欄が埋まります。
          </p>
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
