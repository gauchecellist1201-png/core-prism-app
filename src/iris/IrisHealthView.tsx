// ============================================================
// Iris Health View — クリエイター向けヘルスタブ
// 美しさ = 健康。Apple Watch / Apple Health からのデータを取込み、
// 心拍・睡眠・歩数・ワークアウトを Iris のトーンで表示
// ============================================================
import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppleHealthImport } from '../components/health/AppleHealthImport';
import { HealthAutoSyncModal } from '../components/health/HealthAutoSyncModal';
import type { useHealth } from '../hooks/useHealth';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { generateHealthAdvice, buildStatBundle, type HealthAdvice } from '../lib/healthAdvisor';
import { getHealthToken, getLastPullAt, pullIngestedDays } from '../lib/healthIngest';
import type { DailyHealth } from '../types/health';

interface Props {
  bg: IrisBackgroundDef;
  health: ReturnType<typeof useHealth>;
}

const ADVICE_CACHE_KEY = 'iris_health_advice_v2';

export default function IrisHealthView({ bg, health }: Props) {
  const today = health.today;
  const week = health.week;

  // 7 日平均
  const avg = useMemo(() => {
    if (!week.length) return null;
    const sum = (k: keyof typeof week[0]) => week.reduce((s, d) => s + (Number(d[k]) || 0), 0);
    const n = week.length;
    return {
      steps: Math.round(sum('steps') / n),
      hr: Math.round(sum('restingHR') / n),
      sleep: +(sum('sleepHours') / n).toFixed(1),
      activeMin: Math.round(sum('activeMinutes') / n),
    };
  }, [week]);

  // AI アドバイス
  const [advice, setAdvice] = useState<HealthAdvice | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceError, setAdviceError] = useState<string>('');

  // 自動同期 (iOS ショートカット)
  const [syncOpen, setSyncOpen] = useState(false);
  const [autoSyncToken, setAutoSyncToken] = useState<string | null>(null);
  const [autoSyncBusy, setAutoSyncBusy] = useState(false);
  const [autoSyncMsg, setAutoSyncMsg] = useState<string>('');
  const [lastPullAt, setLastPullAt] = useState<number | null>(null);

  // 起動時にキャッシュ読み込み + token 状態
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADVICE_CACHE_KEY);
      if (raw) setAdvice(JSON.parse(raw));
    } catch { /* ignore */ }
    setAutoSyncToken(getHealthToken());
    setLastPullAt(getLastPullAt());
  }, []);

  // トークンがある場合: マウント時に 1 度だけサーバーから取り込み
  const runAutoPull = useCallback(async (silent: boolean = true) => {
    const t = getHealthToken();
    if (!t) return;
    setAutoSyncBusy(true);
    try {
      const r = await pullIngestedDays(t);
      setLastPullAt(getLastPullAt());
      if (r.merged.length > 0) {
        health.mergeDays(r.merged as DailyHealth[]);
        health.markAppleHealthImported(r.merged.length);
        setAutoSyncMsg(`✓ ${r.merged.length} 日分を取り込みました`);
      } else if (!silent) {
        setAutoSyncMsg(r.configured ? 'まだサーバーにデータがありません' : 'サーバー永続化が未設定です (運用者: UPSTASH を設定してください)');
      }
    } catch {
      if (!silent) setAutoSyncMsg('取り込みに失敗しました');
    } finally {
      setAutoSyncBusy(false);
      setTimeout(() => setAutoSyncMsg(''), 4000);
    }
  }, [health]);

  useEffect(() => {
    if (autoSyncToken) runAutoPull(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncToken]);

  const hasData = !!today || !!avg;

  const fetchAdvice = useCallback(async () => {
    if (!hasData || adviceBusy) return;
    setAdviceBusy(true);
    setAdviceError('');
    try {
      const next = await generateHealthAdvice({
        stats: buildStatBundle(today ?? null, health.days),
        tone: 'iris',
      });
      setAdvice(next);
      localStorage.setItem(ADVICE_CACHE_KEY, JSON.stringify(next));
    } catch (e: any) {
      setAdviceError(e?.message || '取得に失敗しました');
    } finally {
      setAdviceBusy(false);
    }
  }, [hasData, adviceBusy, today, health.days]);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>HEALTH</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          美しさは、内側から。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          Apple Watch のデータを取り込んで、心と体の状態を可視化します。
        </p>
      </div>

      {/* 今日のサマリー */}
      {today ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem',
        }}>
          <Stat bg={bg} label="安静時心拍" value={today.restingHR ? String(Math.round(today.restingHR)) : '—'} unit="bpm" emoji="" />
          <Stat bg={bg} label="歩数" value={today.steps?.toLocaleString('ja-JP') ?? '—'} unit="歩" emoji="" />
          <Stat bg={bg} label="睡眠" value={today.sleepHours ? today.sleepHours.toFixed(1) : '—'} unit="時間" emoji="" />
          <Stat bg={bg} label="アクティブ時間" value={today.activeMinutes ? String(today.activeMinutes) : '—'} unit="分" emoji="" />
        </div>
      ) : (
        <div style={{
          padding: '1.75rem 1.5rem',
          background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}06)`,
          border: `1px solid ${bg.accent}38`,
          borderRadius: 16,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
            fontSize: '1.3rem', color: bg.ink, fontWeight: 500, margin: '0 0 0.5rem',
          }}>
            まだ、何も記録がありません。
          </p>
          <p style={{
            fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8,
            fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
            margin: '0 auto 1.25rem', maxWidth: 380,
          }}>
            このタブでは、睡眠・心拍・歩数を見やすくまとめ、<br />
            AI が「今日の整え方」を一言で教えてくれます。<br />
            まずはサンプルで、できあがりを見てみませんか。
          </p>
          <button
            type="button"
            onClick={() => health.reseed()}
            style={{
              padding: '0.7rem 1.6rem', borderRadius: 999,
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              border: 'none', cursor: 'pointer',
              boxShadow: `0 8px 22px ${bg.accent}44`,
              minHeight: 44,
            }}
          >
            サンプルで試してみる
          </button>
          <p style={{
            fontSize: '0.72rem', color: bg.inkSoft, marginTop: '0.9rem', opacity: 0.85,
          }}>
            自分のデータは、下の「Apple Health から取込」で（約30秒）。サンプルはあとで消せます。
          </p>
        </div>
      )}

      {/* 7 日平均 */}
      {avg && (
        <div style={{
          padding: '1.25rem 1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 14,
        }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.85rem' }}>WEEKLY AVERAGE</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }} className="lp-info-row">
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>心拍</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.hr} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>bpm</span></p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>歩数</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.steps.toLocaleString('ja-JP')}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>睡眠</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.sleep}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>h</span></p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>運動</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.activeMin}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>分</span></p>
            </div>
          </div>
        </div>
      )}

      {/* AI ヘルスアドバイス */}
      {hasData && (
        <div style={{
          padding: '1.5rem',
          background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}06)`,
          border: `1px solid ${bg.accent}38`,
          borderRadius: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: advice ? '1rem' : '0.5rem' }}>
            <div>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>AI ADVICE</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500, margin: 0 }}>
                あなただけの処方箋。
              </h3>
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: 4 }}>
                今日と7日平均のデータを AI が分析し、睡眠・食事・運動・美容のアドバイスを返します。
              </p>
            </div>
            <button
              onClick={fetchAdvice}
              disabled={adviceBusy || !hasData}
              style={{
                minHeight: 44,
                background: adviceBusy ? `${bg.accent}80` : `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '0.7rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: adviceBusy || !hasData ? 'not-allowed' : 'pointer',
                opacity: !hasData ? 0.5 : 1,
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                fontFamily: IRIS_FONTS.body,
                whiteSpace: 'nowrap',
              }}>
              {adviceBusy ? '分析中…' : advice ? 'アドバイスを更新' : 'アドバイスを取得'}
            </button>
          </div>

          {adviceError && (
            <div style={{ padding: '0.7rem 0.9rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 10, fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {adviceError}
            </div>
          )}

          {advice && (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {/* スコア + サマリー */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.15rem',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 12,
                border: `1px solid ${bg.cardBorder}`,
              }}>
                <div style={{
                  flexShrink: 0,
                  width: 72, height: 72, borderRadius: '50%',
                  background: `conic-gradient(${bg.accent} ${advice.score * 3.6}deg, ${bg.accent}22 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', inset: 6, borderRadius: '50%',
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', fontWeight: 800, color: bg.accent }}>
                      {advice.score}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.7rem', color: bg.inkSoft, letterSpacing: '0.15em', fontWeight: 600 }}>HEALTH SCORE</p>
                  <p style={{ fontSize: '0.92rem', color: bg.ink, lineHeight: 1.65, marginTop: 4, fontFamily: IRIS_FONTS.body }}>
                    {advice.summary}
                  </p>
                </div>
              </div>

              {/* 4 分野アドバイス */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {[
                  { key: 'sleep', title: '睡眠', label: 'SLEEP', text: advice.sleep, icon: '' },
                  { key: 'diet', title: '食生活', label: 'DIET', text: advice.diet, icon: '' },
                  { key: 'exercise', title: '運動', label: 'EXERCISE', text: advice.exercise, icon: '' },
                  { key: 'beauty', title: '美容', label: 'BEAUTY', text: advice.beauty, icon: '' },
                ].map(b => (
                  <div key={b.key} style={{
                    padding: '1rem 1.1rem',
                    background: 'rgba(255,255,255,0.7)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.95rem' }}>{b.icon}</span>
                      <p style={{ fontSize: '0.62rem', color: bg.accent, letterSpacing: '0.2em', fontWeight: 700 }}>{b.label}</p>
                    </div>
                    <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.05rem', color: bg.ink, fontWeight: 500, marginBottom: 6 }}>
                      {b.title}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: bg.ink, lineHeight: 1.75, fontFamily: IRIS_FONTS.body }}>
                      {b.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* 強化版: 今夜のアクション / 明日の運動 / 夕食 */}
              {(advice.tonightAction || advice.tomorrowWorkout || advice.dinnerTiming) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {advice.tonightAction && (
                    <div style={{ padding: '0.95rem 1.05rem', background: `linear-gradient(135deg, ${bg.accent}1c, ${bg.accent}08)`, border: `1px solid ${bg.accent}40`, borderRadius: 12 }}>
                      <p style={{ fontSize: '0.62rem', color: bg.accent, letterSpacing: '0.22em', fontWeight: 700, marginBottom: 4 }}>TONIGHT</p>
                      <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.02rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>今夜のアクション</p>
                      <p style={{ fontSize: '0.83rem', color: bg.ink, lineHeight: 1.7 }}>{advice.tonightAction}</p>
                    </div>
                  )}
                  {advice.tomorrowWorkout && (
                    <div style={{ padding: '0.95rem 1.05rem', background: `linear-gradient(135deg, ${bg.accent}1c, ${bg.accent}08)`, border: `1px solid ${bg.accent}40`, borderRadius: 12 }}>
                      <p style={{ fontSize: '0.62rem', color: bg.accent, letterSpacing: '0.22em', fontWeight: 700, marginBottom: 4 }}>TOMORROW</p>
                      <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.02rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>明日の運動</p>
                      <p style={{ fontSize: '0.83rem', color: bg.ink, lineHeight: 1.7 }}>{advice.tomorrowWorkout}</p>
                    </div>
                  )}
                  {advice.dinnerTiming && (
                    <div style={{ padding: '0.95rem 1.05rem', background: `linear-gradient(135deg, ${bg.accent}1c, ${bg.accent}08)`, border: `1px solid ${bg.accent}40`, borderRadius: 12 }}>
                      <p style={{ fontSize: '0.62rem', color: bg.accent, letterSpacing: '0.22em', fontWeight: 700, marginBottom: 4 }}>DINNER</p>
                      <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.02rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>夕食タイミング</p>
                      <p style={{ fontSize: '0.83rem', color: bg.ink, lineHeight: 1.7 }}>{advice.dinnerTiming}</p>
                    </div>
                  )}
                </div>
              )}

              <p style={{ fontSize: '0.72rem', color: bg.inkSoft, textAlign: 'right', fontStyle: 'italic', fontFamily: IRIS_FONTS.serif }}>
                生成: {new Date(advice.generatedAt).toLocaleString('ja-JP')}
                {advice.trend && ` ・ トレンド: ${advice.trend === 'improving' ? '改善傾向' : advice.trend === 'worsening' ? '悪化傾向' : '安定'}`}
                ・ AI は医療判断の代わりではありません
              </p>
            </div>
          )}

          {!advice && !adviceBusy && !adviceError && (
            <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, marginTop: '0.5rem' }}>
              「アドバイスを取得」を押すと、今日と週平均のデータをもとに、AI が4分野の処方箋をくれます。
            </p>
          )}
        </div>
      )}

      {/* 自動連携 (iOS ショートカット) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '1.5rem',
          background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}05)`,
          border: `1px solid ${bg.accent}40`,
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '0.7rem' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>AUTO SYNC ✦ NEW</p>
            <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>
              ZIP は、もう要らない。
            </h3>
            <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8 }}>
              iOS ショートカットで毎朝の Apple Health データを自動で Iris に届けます。
              書き出しの手間が消え、AI 処方箋も毎日更新されます。
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={() => setSyncOpen(true)}
              style={{
                minHeight: 44,
                background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                color: '#fff', border: 'none', borderRadius: 999,
                padding: '0.75rem 1.3rem', fontSize: '0.9rem', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: IRIS_FONTS.body,
                boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
              }}
            >
              {autoSyncToken ? '⚙ 設定を見直す' : '✦ 自動連携を始める'}
            </button>
            {autoSyncToken && (
              <button
                onClick={() => runAutoPull(false)}
                disabled={autoSyncBusy}
                style={{
                  minHeight: 44,
                  background: 'transparent',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999,
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  color: bg.ink,
                  cursor: autoSyncBusy ? 'not-allowed' : 'pointer',
                  fontFamily: IRIS_FONTS.body,
                }}
              >
                {autoSyncBusy ? '取得中…' : '今すぐ取り込む'}
              </button>
            )}
          </div>
        </div>
        {autoSyncToken && (
          <div style={{ fontSize: '0.74rem', color: bg.inkSoft, lineHeight: 1.7 }}>
            状態: <span style={{ color: bg.ink, fontWeight: 600 }}>連携トークン発行済</span>
            {lastPullAt && (
              <>
                {' · '}最終取得: {new Date(lastPullAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </div>
        )}
        {autoSyncMsg && (
          <div style={{
            marginTop: '0.6rem',
            padding: '0.55rem 0.8rem',
            background: 'rgba(255,255,255,0.55)',
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 10,
            fontSize: '0.78rem',
            color: bg.ink,
          }}>
            {autoSyncMsg}
          </div>
        )}
      </motion.div>

      {/* Apple Health インポート */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>APPLE HEALTH SYNC</p>
          <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>
            データを取込む
          </h3>
          <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.85 }}>
            iPhone の「ヘルスケア」アプリ → プロフィール → 「すべての健康データを書き出す」で
            出力された <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>export.zip</code> をドラッグ＆ドロップしてください。
          </p>
        </div>

        <AppleHealthImport health={health} />
      </motion.div>

      {/* 自動連携モーダル */}
      <HealthAutoSyncModal
        bg={bg}
        open={syncOpen}
        onClose={() => {
          setSyncOpen(false);
          setAutoSyncToken(getHealthToken());
          setLastPullAt(getLastPullAt());
        }}
        onPulled={(count) => {
          // モーダル内で取り込んだ場合、ヘルスフックにマージ
          if (count > 0) {
            const t = getHealthToken();
            if (t) {
              pullIngestedDays(t).then((r) => {
                if (r.merged.length > 0) {
                  health.mergeDays(r.merged as DailyHealth[]);
                  health.markAppleHealthImported(r.merged.length);
                }
              });
            }
          }
        }}
      />

      {/* クリエイター向け 3 プリセット (撮影前 / 立ち仕事 / 徹夜後) */}
      <CreatorRoutines bg={bg} />

      {/* セルフケアのヒント (Iris らしい) */}
      <div style={{
        padding: '1.5rem',
        background: `linear-gradient(135deg, ${bg.accent}10, ${bg.accent}05)`,
        border: `1px solid ${bg.accent}30`,
        borderRadius: 16,
      }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 8 }}>SELF-CARE</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.25rem', color: bg.ink, fontWeight: 500, marginBottom: '0.85rem' }}>
          光を、内側から。
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {[
            { icon: '', text: '睡眠 7 時間以上 — 肌のターンオーバーは寝ている時間に' },
            { icon: '', text: '水 1.5L — 朝起きてすぐコップ 1 杯から' },
            { icon: '', text: '歩数 8000 歩 — 短時間でも血流が変わる' },
            { icon: '', text: '深呼吸 5 分 — 自律神経が整い、表情が柔らかくなる' },
          ].map((t, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.95rem', color: bg.ink, lineHeight: 1.85, fontFamily: IRIS_FONTS.body }}>
              <span style={{ flexShrink: 0 }}>{t.icon}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 免責 */}
      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: bg.inkSoft, fontStyle: 'italic', fontFamily: IRIS_FONTS.serif, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        これは医療アドバイスではありません。気になる症状は医師にご相談ください。
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CreatorRoutines — 撮影前ルーティン / 立ち仕事疲労 / 徹夜後リカバリ
// クリエイター女性向け固定プリセット (AI 不要、即表示)
// ─────────────────────────────────────────────────────────────
const ROUTINES = [
  {
    key: 'pre-shoot',
    label: 'BEFORE SHOOT',
    title: '撮影前ルーティン',
    bullets: [
      '前夜 23 時までに就寝、深睡眠 90 分を確保',
      '当日朝に温水 + レモン 1 杯で代謝 ON',
      '撮影 3 時間前に塩分カット (むくみ防止)',
      '直前にチークと深呼吸 5 回で血色を整える',
    ],
  },
  {
    key: 'long-stand',
    label: 'STANDING WORK',
    title: '立ち仕事疲労ケア',
    bullets: [
      '60 分ごとに 1 分のふくらはぎポンプ (踵上げ 30 回)',
      '昼休みに 5 分の壁ストレッチで腰を解放',
      '帰宅後すぐ 38℃ 風呂 15 分 → むくみリセット',
      '寝る前に脚を心臓より高く上げて 10 分',
    ],
  },
  {
    key: 'all-night-recover',
    label: 'AFTER ALL-NIGHTER',
    title: '徹夜後リカバリ',
    bullets: [
      '帰ったら即シャワー → 真っ暗で 90 分仮眠',
      'カフェイン NG。代わりに水 + 塩で脱水を回復',
      '昼食はタンパク質 30g (鶏 / 卵) + 緑黄色野菜',
      '夜は 22 時に消灯、無理に眠ろうとせず横になる',
    ],
  },
];

function CreatorRoutines({ bg }: { bg: IrisBackgroundDef }) {
  const [openKey, setOpenKey] = useState<string | null>('pre-shoot');
  return (
    <div style={{
      padding: '1.5rem',
      background: `linear-gradient(135deg, ${bg.accent}0E, ${bg.accent}04)`,
      border: `1px solid ${bg.accent}38`,
      borderRadius: 16,
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>CREATOR ROUTINES</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>
          シーンに、整える。
        </h3>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.7 }}>
          クリエイターの「明日」を支える 3 つの定番ルーティン。
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.55rem', marginBottom: openKey ? '0.85rem' : 0 }}>
        {ROUTINES.map(r => {
          const active = openKey === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setOpenKey(active ? null : r.key)}
              style={{
                minHeight: 44,
                padding: '0.7rem 0.95rem',
                background: active
                  ? `linear-gradient(135deg, ${bg.accent}38, ${bg.accent}18)`
                  : 'rgba(255,255,255,0.55)',
                border: `1px solid ${active ? bg.accent : bg.cardBorder}`,
                borderRadius: 12,
                color: bg.ink,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: IRIS_FONTS.body,
              }}
              aria-expanded={active}
            >
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: bg.accent, fontWeight: 700, marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1rem', fontWeight: 500 }}>{r.title}</div>
            </button>
          );
        })}
      </div>
      {openKey && (() => {
        const r = ROUTINES.find(x => x.key === openKey)!;
        return (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '1rem 1.2rem',
              background: 'rgba(255,255,255,0.7)',
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 12,
            }}
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
              {r.bullets.map((b, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.95rem', color: bg.ink, lineHeight: 1.7, fontFamily: IRIS_FONTS.body }}>
                  <span style={{
                    flexShrink: 0,
                    width: 20, height: 20, borderRadius: '50%',
                    background: `${bg.accent}22`, color: bg.accent,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.72rem',
                  }}>{i + 1}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        );
      })()}
    </div>
  );
}

function Stat({ bg, label, value, unit, emoji }: { bg: IrisBackgroundDef; label: string; value: string; unit: string; emoji: string }) {
  return (
    <div style={{
      padding: '1.1rem 1rem',
      background: bg.card,
      border: `1px solid ${bg.cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.95rem' }}>{emoji}</span>
        <p style={{ fontSize: '0.7rem', color: bg.inkSoft, letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.45rem', fontWeight: 700, color: bg.ink }}>
        {value}<span style={{ fontSize: '0.7rem', color: bg.inkSoft, marginLeft: 4, fontWeight: 500 }}>{unit}</span>
      </p>
    </div>
  );
}
