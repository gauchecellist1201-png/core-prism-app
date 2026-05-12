// ============================================================
// Iris Health View — クリエイター向けヘルスタブ
// 美しさ = 健康。Apple Watch / Apple Health からのデータを取込み、
// 心拍・睡眠・歩数・ワークアウトを Iris のトーンで表示
// ============================================================
import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppleHealthImport } from '../components/health/AppleHealthImport';
import type { useHealth } from '../hooks/useHealth';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  health: ReturnType<typeof useHealth>;
}

type HealthAdvice = {
  score: number; // 0-100
  summary: string;
  sleep: string;
  diet: string;
  exercise: string;
  beauty: string;
  generatedAt: string;
};

const ADVICE_CACHE_KEY = 'iris_health_advice_v1';

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

  // 起動時にキャッシュ読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADVICE_CACHE_KEY);
      if (raw) setAdvice(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const hasData = !!today || !!avg;

  const fetchAdvice = useCallback(async () => {
    if (!hasData || adviceBusy) return;
    setAdviceBusy(true);
    setAdviceError('');
    try {
      const sys = `あなたは美容/健康/睡眠の専門家。Apple Health データを見て、クリエイター女性(20-40代想定)向けに「美しさは内側から」の観点で実践的アドバイスを返す。
返却 JSON のみ (説明やコードフェンス不要):
{
  "score": number (0-100, 総合健康スコア),
  "summary": "string (40-70字, 一言サマリー)",
  "sleep": "string (60-100字, 睡眠への具体アドバイス)",
  "diet": "string (60-100字, 食生活への具体アドバイス)",
  "exercise": "string (60-100字, 運動への具体アドバイス)",
  "beauty": "string (60-100字, 美容への具体アドバイス)"
}`;
      const todayStr = today
        ? `今日: 安静時心拍 ${today.restingHR ?? '—'}bpm / 歩数 ${today.steps ?? '—'}歩 / 睡眠 ${today.sleepHours?.toFixed(1) ?? '—'}h / アクティブ ${today.activeMinutes ?? '—'}分`
        : '今日のデータなし';
      const avgStr = avg
        ? `7日平均: 心拍 ${avg.hr}bpm / 歩数 ${avg.steps}歩 / 睡眠 ${avg.sleep}h / 運動 ${avg.activeMin}分`
        : '7日平均データなし';

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${todayStr}\n${avgStr}\n\nこのデータを分析して、JSON で4分野のアドバイスを返してください。` }],
          system: sys,
          max_tokens: 700,
        }),
      });
      const data = await res.json();
      const text: string = data.text || data.content || data.message || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 応答に JSON が含まれていません');
      const j = JSON.parse(match[0]);
      const next: HealthAdvice = {
        score: Math.max(0, Math.min(100, Number(j.score) || 0)),
        summary: String(j.summary || ''),
        sleep: String(j.sleep || ''),
        diet: String(j.diet || ''),
        exercise: String(j.exercise || ''),
        beauty: String(j.beauty || ''),
        generatedAt: new Date().toISOString(),
      };
      setAdvice(next);
      localStorage.setItem(ADVICE_CACHE_KEY, JSON.stringify(next));
    } catch (e: any) {
      setAdviceError(e?.message || '取得に失敗しました');
    } finally {
      setAdviceBusy(false);
    }
  }, [hasData, adviceBusy, today, avg]);

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
          <Stat bg={bg} label="安静時心拍" value={today.restingHR ? String(Math.round(today.restingHR)) : '—'} unit="bpm" emoji="❤️" />
          <Stat bg={bg} label="歩数" value={today.steps?.toLocaleString('ja-JP') ?? '—'} unit="歩" emoji="👟" />
          <Stat bg={bg} label="睡眠" value={today.sleepHours ? today.sleepHours.toFixed(1) : '—'} unit="時間" emoji="🌙" />
          <Stat bg={bg} label="アクティブ時間" value={today.activeMinutes ? String(today.activeMinutes) : '—'} unit="分" emoji="🌸" />
        </div>
      ) : (
        <div style={{
          padding: '1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 14,
          textAlign: 'center',
          color: bg.inkSoft,
          fontSize: '0.9rem',
          fontFamily: IRIS_FONTS.serif,
          fontStyle: 'italic',
        }}>
          まだ健康データがありません。下の「Apple Health から取込」で開始してください。
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
                background: adviceBusy ? `${bg.accent}80` : `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '0.55rem 1.1rem',
                fontSize: '0.82rem',
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
                  { key: 'sleep', title: '睡眠', label: 'SLEEP', text: advice.sleep, icon: '🌙' },
                  { key: 'diet', title: '食生活', label: 'DIET', text: advice.diet, icon: '🥗' },
                  { key: 'exercise', title: '運動', label: 'EXERCISE', text: advice.exercise, icon: '👟' },
                  { key: 'beauty', title: '美容', label: 'BEAUTY', text: advice.beauty, icon: '🌸' },
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

              <p style={{ fontSize: '0.72rem', color: bg.inkSoft, textAlign: 'right', fontStyle: 'italic', fontFamily: IRIS_FONTS.serif }}>
                生成: {new Date(advice.generatedAt).toLocaleString('ja-JP')} ・ AI は医療判断の代わりではありません
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
            { icon: '🌙', text: '睡眠 7 時間以上 — 肌のターンオーバーは寝ている時間に' },
            { icon: '💧', text: '水 1.5L — 朝起きてすぐコップ 1 杯から' },
            { icon: '👟', text: '歩数 8000 歩 — 短時間でも血流が変わる' },
            { icon: '🌸', text: '深呼吸 5 分 — 自律神経が整い、表情が柔らかくなる' },
          ].map((t, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: bg.ink, lineHeight: 1.85, fontFamily: IRIS_FONTS.body }}>
              <span style={{ flexShrink: 0 }}>{t.icon}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      </div>
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
