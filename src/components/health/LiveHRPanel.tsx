import { useEffect, useRef, useState } from 'react';
import { Activity, Bluetooth, Heart, AlertTriangle, BatteryFull, Save, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRISM, Pill } from '../prism/MockShell';
import { HeartRateMonitor, isWebBluetoothSupported, type BleDeviceInfo, type HRReading } from '../../lib/webBluetoothHR';
import { saveLiveHRSession, type HealthIdentity } from '../../lib/healthLiveSession';

interface Props {
  onSample?: (r: HRReading) => void;
  /** 計測結果を PHR (今日のカラダ) に保存するための本人識別。渡すと「保存」ボタンが出る。 */
  identity?: HealthIdentity | null;
}

export function LiveHRPanel({ onSample, identity }: Props) {
  const monitorRef = useRef<HeartRateMonitor | null>(null);
  const [info, setInfo] = useState<BleDeviceInfo | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [contact, setContact] = useState<boolean | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'pairing' | 'connected' | 'reconnecting' | 'disconnected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<number[]>([]);
  const [supported] = useState(isWebBluetoothSupported());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => { monitorRef.current?.disconnect(); };
  }, []);

  const saveSession = async () => {
    const m = monitorRef.current;
    if (!m || !identity) return;
    const summary = m.sessionSummary();
    if (!summary) { setSaveState('error'); setSaveMsg('もう少し計測してから保存してください（数十秒ほど）。'); return; }
    setSaveState('saving'); setSaveMsg(null);
    const r = await saveLiveHRSession(identity, summary);
    setSaveState(r.ok ? 'saved' : 'error');
    setSaveMsg(r.message);
  };

  const connect = async () => {
    setError(null);
    if (!supported) {
      setError('Chrome / Edge / Brave で開いてください (iOS Safari は Web Bluetooth 非対応)');
      return;
    }
    const m = new HeartRateMonitor();
    monitorRef.current = m;
    m.onStatus((s, detail) => {
      setStatus(s as any);
      if (s === 'error') setError(detail || '接続エラー');
    });
    m.onReading((r) => {
      setBpm(r.bpm);
      setContact(r.contact);
      setTrend((prev) => [...prev.slice(-59), r.bpm]);
      setHrv(Math.round(m.computeHRV()));
      onSample?.(r);
    });

    try {
      const i = await m.pair();
      setInfo(i);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // ユーザーキャンセルは静かに
      if (!/user cancel/i.test(msg)) setError(msg);
      setStatus('idle');
    }
  };

  const disconnect = async () => {
    await monitorRef.current?.disconnect();
    monitorRef.current = null;
    setInfo(null);
    setBpm(null);
    setHrv(null);
    setStatus('idle');
    setTrend([]);
    setSaveState('idle');
    setSaveMsg(null);
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">LIVE HEART RATE</div>
        {status === 'connected' ? (
          <Pill color={PRISM.action}>● 接続中</Pill>
        ) : status === 'pairing' ? (
          <Pill color={PRISM.creative}>… ペアリング中</Pill>
        ) : status === 'reconnecting' ? (
          <Pill color={PRISM.creative}>… 再接続中</Pill>
        ) : (
          <Pill color="#9C9C9C">未接続</Pill>
        )}
      </div>

      {!supported && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-300/10 px-3 py-2 text-[12px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>このブラウザは Web Bluetooth に対応していません。Chrome / Edge / Brave (デスクトップ・Android) でご利用ください。</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-4">
        {/* 大型 BPM 表示 */}
        <div className="rounded-2xl bg-black/30 p-5">
          <div className="flex items-baseline gap-3">
            <motion.div
              animate={bpm ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 60 / Math.max(40, bpm || 60), repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center gap-2"
            >
              <Heart className="h-5 w-5" style={{ color: PRISM.action }} />
            </motion.div>
            <div className="font-mono text-6xl font-light text-fg leading-none">
              {bpm ?? '—'}
            </div>
            <div className="text-[12px] tracking-[0.3em] text-fg-subtle">BPM</div>
          </div>

          {/* スパークライン */}
          <div className="mt-3 h-12 w-full">
            {trend.length > 1 ? (
              <Sparkline values={trend} color={PRISM.action} />
            ) : (
              <div className="flex h-full items-center text-[12px] text-fg-subtle">
                {status === 'connected' ? '心拍データ待機中…' : '未接続'}
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-fg-subtle">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-fg-subtle">HRV (RMSSD)</div>
              <div className="font-mono text-[14px] text-fg">{hrv != null ? `${hrv} ms` : '—'}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-fg-subtle">CONTACT</div>
              <div className="font-mono text-[14px] text-fg">
                {contact === undefined ? '—' : contact ? '装着中' : '未装着'}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-fg-subtle">SAMPLES</div>
              <div className="font-mono text-[14px] text-fg">{trend.length}</div>
            </div>
          </div>
        </div>

        {/* デバイス情報 + 操作 */}
        <div className="flex w-[240px] flex-col gap-2">
          {info && (
            <div className="rounded-xl border border-white/8 bg-surface-2 p-3">
              <div className="text-[11px] tracking-[0.3em] text-fg-subtle">DEVICE</div>
              <div className="mt-1 text-[14px] text-fg">{info.name}</div>
              <div className="mt-1 text-[12px] text-fg-subtle">
                {info.bodyLocation && `位置: ${info.bodyLocation}`}
              </div>
              {info.batteryLevel != null && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-fg">
                  <BatteryFull className="h-3 w-3" />
                  {info.batteryLevel}%
                </div>
              )}
            </div>
          )}

          {status === 'idle' || status === 'disconnected' || status === 'error' ? (
            <button
              onClick={connect}
              disabled={!supported}
              className="flex items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium disabled:opacity-40"
              style={{ minHeight: 44, background: `${PRISM.action}1f`, color: PRISM.action, border: `1px solid ${PRISM.action}55` }}
            >
              <Bluetooth className="h-3.5 w-3.5" />
              心拍計を接続
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium"
              style={{ minHeight: 44, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              切断
            </button>
          )}

          {/* 計測を PHR に保存 (identity が渡されているときのみ) */}
          {identity && (status === 'connected' || status === 'reconnecting') && (
            <button
              onClick={saveSession}
              disabled={saveState === 'saving'}
              className="flex items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium disabled:opacity-50"
              style={{ minHeight: 44, background: saveState === 'saved' ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.06)', color: saveState === 'saved' ? '#34d399' : '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {saveState === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : saveState === 'saved' ? <Check className="h-3.5 w-3.5" />
                : <Save className="h-3.5 w-3.5" />}
              {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '保存しました' : 'この計測を保存'}
            </button>
          )}
          {saveMsg && (
            <div className="rounded-md px-2 py-1.5 text-[12px]" style={{ background: saveState === 'error' ? 'rgba(244,63,94,0.10)' : 'rgba(52,211,153,0.08)', color: saveState === 'error' ? '#fecdd3' : '#a7f3d0' }}>
              {saveMsg}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-rose-500/10 px-2 py-1.5 text-[12px] text-rose-200">
              {error}
            </div>
          )}

          <div className="text-[11px] leading-relaxed text-fg-subtle">
            <Activity className="mr-1 inline h-2.5 w-2.5" />
            対応: Polar H10 / H9 / Wahoo Tickr / Garmin HRM-Dual / 他 BLE 標準心拍計
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bpm != null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-md bg-emerald-300/5 px-3 py-2 text-[12px] text-emerald-200/85"
          >
            ライブ心拍データを取得中。RR間隔から RMSSD を算出して HRV を可視化しています。
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 100, h = 100;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default LiveHRPanel;
