// ============================================================
// HealthPrescriptionView — Prism 側 AI 処方箋ビュー
// 今日 / 7日 / 30日 のヘルスデータを AI が分析し、
// 睡眠 / 食事 / 運動 / 美容 の 4 分野と今夜の具体アクションを返す
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, UtensilsCrossed, Footprints, Sparkles, Sun, Loader2, RefreshCw } from 'lucide-react';
import type { useHealth } from '../../hooks/useHealth';
import { PRISM } from '../prism/MockShell';
import { generateHealthAdvice, buildStatBundle, type HealthAdvice } from '../../lib/healthAdvisor';
import ApiErrorCard from '../ApiErrorCard';

interface Props {
  health: ReturnType<typeof useHealth>;
  userName?: string;
}

const CACHE_KEY = 'prism_health_advice_v2';

export default function HealthPrescriptionView({ health, userName }: Props) {
  const today = health.today;
  const hasData = !!today || health.days.length > 0;

  const [advice, setAdvice] = useState<HealthAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setAdvice(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const fetchAdvice = useCallback(async () => {
    if (!hasData || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await generateHealthAdvice({
        stats: buildStatBundle(today ?? null, health.days),
        tone: 'prism',
      });
      setAdvice(next);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (e: any) {
      setError(e?.message || 'AI からの取得に失敗しました');
    } finally {
      setBusy(false);
    }
  }, [hasData, busy, today, health.days]);

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
        <div className="text-[12px] tracking-[0.3em] text-fg-muted mb-2">AI PRESCRIPTION</div>
        <p className="text-[14px] text-fg-muted">
          ヘルスデータを取り込むと、AI が個別の処方箋を生成します。<br />
          <span className="text-fg">Sources</span> タブから Apple Health の export.zip を読み込んでください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">AI PRESCRIPTION</div>
          <h2 className="mt-1 text-[20px] font-medium text-fg">
            {userName ? `${userName} さんへの処方箋` : 'あなただけの処方箋'}
          </h2>
          <p className="mt-1 text-[12px] text-fg-subtle">
            今日 / 7日平均 / 30日トレンドを分析し、睡眠・食事・運動・美容の 4 分野で実践アドバイスを返します。
          </p>
        </div>
        <button
          onClick={fetchAdvice}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${PRISM.empathy}, ${PRISM.creative})` }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {busy ? '分析中…' : advice ? 'アドバイスを更新' : 'アドバイスを取得'}
        </button>
      </div>

      {error && !busy && (
        <ApiErrorCard error={error} onRetry={fetchAdvice} variant="dark" />
      )}

      {advice && (
        <>
          {/* スコア + サマリー */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-4"
          >
            <div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${PRISM.empathy} ${advice.score * 3.6}deg, rgba(255,255,255,0.08) 0)`,
              }}
            >
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-black/80">
                <span className="text-[18px] font-bold" style={{ color: PRISM.empathy }}>
                  {advice.score}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.3em] text-fg-muted">HEALTH SCORE</div>
              <p className="mt-1 text-[14px] leading-relaxed text-fg">{advice.summary}</p>
              {advice.trend && (
                <p className="mt-1 text-[11px] text-fg-subtle">
                  トレンド: {advice.trend === 'improving' ? '改善傾向' : advice.trend === 'worsening' ? '悪化傾向' : '安定'}
                </p>
              )}
            </div>
          </motion.div>

          {/* 4 分野 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: 'sleep',    label: 'SLEEP',    title: '睡眠',    text: advice.sleep,    Icon: Moon },
              { key: 'diet',     label: 'DIET',     title: '食生活',  text: advice.diet,     Icon: UtensilsCrossed },
              { key: 'exercise', label: 'EXERCISE', title: '運動',    text: advice.exercise, Icon: Footprints },
              { key: 'beauty',   label: 'BEAUTY',   title: '美容',    text: advice.beauty,   Icon: Sparkles },
            ].map((b, i) => (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-white/10 bg-white/3 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <b.Icon className="h-4 w-4" style={{ color: PRISM.empathy }} />
                  <span className="text-[10px] tracking-[0.25em] font-bold" style={{ color: PRISM.empathy }}>
                    {b.label}
                  </span>
                </div>
                <div className="mb-1 text-[15px] font-medium text-fg">{b.title}</div>
                <p className="text-[13px] leading-relaxed text-fg-muted">{b.text}</p>
              </motion.div>
            ))}
          </div>

          {/* 今夜 / 明日 / 夕食 */}
          {(advice.tonightAction || advice.tomorrowWorkout || advice.dinnerTiming) && (
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 sm:grid-cols-3">
              {advice.tonightAction && (
                <ActionLine icon={Moon} label="TONIGHT" text={advice.tonightAction} />
              )}
              {advice.dinnerTiming && (
                <ActionLine icon={UtensilsCrossed} label="DINNER" text={advice.dinnerTiming} />
              )}
              {advice.tomorrowWorkout && (
                <ActionLine icon={Sun} label="TOMORROW" text={advice.tomorrowWorkout} />
              )}
            </div>
          )}

          <p className="text-right text-[11px] italic text-fg-subtle">
            生成: {new Date(advice.generatedAt).toLocaleString('ja-JP')} · AI は医療判断の代わりではありません
          </p>
        </>
      )}

      {!advice && !busy && !error && (
        <p className="text-[13px] text-fg-muted">
          「アドバイスを取得」を押すと、データから 4 分野の処方箋を生成します。
        </p>
      )}
    </div>
  );
}

function ActionLine({ icon: Icon, label, text }: { icon: any; label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-fg-muted" />
        <span className="text-[10px] tracking-[0.25em] font-bold text-fg-muted">{label}</span>
      </div>
      <p className="text-[13px] leading-snug text-fg">{text}</p>
    </div>
  );
}
