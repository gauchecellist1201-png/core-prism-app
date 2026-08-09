import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, BarChart3, MessageCircle, Stethoscope, FileText, Cable, Pill } from 'lucide-react';
import { MockShell, PRISM } from '../prism/MockShell';
import PulseBanner from '../../pulse/PulseBanner';
import { useHealth } from '../../hooks/useHealth';
import { useMedicalHistory } from '../../hooks/useMedicalHistory';
import { detectAnomalies } from '../../data/healthAnomaly';
import type { AppSettings, Persona } from '../../types/identity';
import type { SymptomSeed } from '../../data/symptomDetect';

import { HealthOverview } from './HealthOverview';
import { HealthVitals } from './HealthVitals';
import { HealthCoachView } from './HealthCoachView';
import HealthPrescriptionView from './HealthPrescriptionView';
import { HealthSymptomCheck } from './HealthSymptomCheck';
import { HealthHistoryView } from './HealthHistoryView';
import { HealthSourcesView } from './HealthSourcesView';
import { StudioIntro } from '../StudioIntro';

type Tab = 'overview' | 'rx' | 'vitals' | 'coach' | 'symptoms' | 'history' | 'sources';

// タブ名はやさしい日本語で。英語（Overview / Vitals …）だと一般ユーザーが読めない。
const NAV = [
  { key: 'overview',  label: '今日の状態',   Icon: BarChart3 },
  { key: 'rx',        label: 'AI 処方箋',    Icon: Pill },
  { key: 'vitals',    label: '数値で見る',   Icon: Activity },
  { key: 'coach',     label: 'AI に相談',    Icon: MessageCircle },
  { key: 'symptoms',  label: '症状チェック', Icon: Stethoscope },
  { key: 'history',   label: '通院・服薬',   Icon: FileText },
  { key: 'sources',   label: 'データ連携',   Icon: Cable },
] as const;

// ── 「こんなのが出ます」の見本 ──────────────────────────────
// 言葉の説明だけだと「押したら何が返ってくるのか」が想像できない。
// 出てくるモノの姿を、押す前に 1 枚だけ小さく見せる。
//
// ここの数字はすべて **説明用の例** で、実データではない。
// StudioIntro 側が「こんなのが出ます」と明示し、点線の枠で囲んで出すので
// 本物の計測値と取り違えられない (嘘の数字を出さないルール)。
//
// 色は白い紙の上に決め打ちで置く。テーマ (明るい/暗い) がどちらでも
// 文字と面が必ずセットで決まり、読めなくならない。
const SAMPLE_INK = '#0f172a';      // 白地に 17:1
const SAMPLE_MUTED = '#475569';    // 白地に 7.5:1
const SAMPLE_GOOD = '#15803D';     // 白地に 4.8:1
const SAMPLE_WARN = '#B45309';     // 白地に 4.9:1

/** 見本の台紙。出力物らしく見えるよう小さな白い紙にする */
function SampleSheet({ title, aria, children }: { title: string; aria: string; children: ReactNode }) {
  return (
    <div
      aria-label={aria}
      style={{
        width: 136,
        background: '#ffffff',
        color: SAMPLE_INK,
        borderRadius: 6,
        borderTop: `3px solid ${PRISM.empathy}`,
        padding: '7px 8px',
        fontSize: 8,
        lineHeight: 1.45,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
      }}
    >
      {/* すぐ下に本物の数値が並ぶので、見本だと一目で分かるよう題に書いておく */}
      <div style={{ fontSize: 8.5, fontWeight: 800, marginBottom: 4 }}>
        {title}
        <span style={{ fontWeight: 700, color: SAMPLE_MUTED }}>（見本）</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  );
}

/** 見本の 1 行 (項目名 + 値) */
function SampleRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ color: SAMPLE_MUTED }}>{label}</span>
      <span style={{ fontWeight: 700, color: color || SAMPLE_INK }}>{value}</span>
    </div>
  );
}

/** 見本の 1 行 (文章) */
function SampleLine({ text, color }: { text: string; color?: string }) {
  return <div style={{ color: color || SAMPLE_INK }}>{text}</div>;
}

// 各タブの一番上に出す「3 秒でわかる説明」。初見の人が触らずに
// 「この画面は何ができて / まず何を押すか / どんな結果になるか」を分かるようにする。
const INTROS: Record<Tab, {
  icon: typeof BarChart3;
  what: string;
  tryThis: string;
  example: string;
  /** 押す前に見せる「こんなのが出ます」の見本 (説明用の例。実データではない) */
  sample: ReactNode;
}> = {
  overview: {
    icon: BarChart3,
    what: '今日のからだの状態を 1 画面でまとめて確認できます',
    tryThis: '睡眠・心拍・回復スコアと「注意点」に目を通す',
    example: '睡眠 6.2h ／ 安静時心拍 58 ／ 回復スコア 72',
    sample: (
      <SampleSheet title="今日の状態" aria="今日の状態のサンプル">
        <SampleRow label="睡眠" value="6.2h" />
        <SampleRow label="安静時心拍" value="58" />
        <SampleRow label="回復スコア" value="72" color={SAMPLE_GOOD} />
        <SampleLine text="注意点 1 件: 睡眠が短め" color={SAMPLE_WARN} />
      </SampleSheet>
    ),
  },
  rx: {
    icon: Pill,
    what: '今日のからだに合った過ごし方を AI が「処方」します',
    tryThis: '「処方箋を作る」を押す',
    example: '午前は集中作業 → 15 時に 10 分の散歩 → 就寝は 23 時',
    sample: (
      <SampleSheet title="今日の処方箋" aria="AI 処方箋のサンプル">
        <SampleLine text="午前 — 集中作業にあてる" />
        <SampleLine text="15:00 — 10 分の散歩" />
        <SampleLine text="23:00 — 就寝" />
        <SampleLine text="理由: 睡眠が 2 日続けて短め" color={SAMPLE_MUTED} />
      </SampleSheet>
    ),
  },
  vitals: {
    icon: Activity,
    what: '睡眠・心拍・歩数などの数値を時系列のグラフで見られます',
    tryThis: '気になる指標のカードを選ぶ',
    example: '今週の平均睡眠 6.4h（先週より +18 分）',
    sample: (
      <SampleSheet title="睡眠（今週）" aria="数値で見るのサンプル">
        <SampleRow label="平均" value="6.4h" />
        <SampleRow label="先週より" value="+18 分" color={SAMPLE_GOOD} />
        {/* 折れ線の代わりに、日ごとの棒を 7 本。文字ではないので色だけで足りる */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, marginTop: 2 }}>
          {[13, 17, 11, 20, 15, 22, 18].map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: h, borderRadius: 1.5,
                background: PRISM.empathy, opacity: 0.85,
              }}
            />
          ))}
        </div>
      </SampleSheet>
    ),
  },
  coach: {
    icon: MessageCircle,
    what: 'からだの悩みを、あなたの数値を踏まえて AI に相談できます',
    tryThis: '下の入力欄に気になる事を書く',
    example: '「最近寝つきが悪い」→ 考えられる原因と対処を 3 つ',
    sample: (
      <SampleSheet title="AI に相談" aria="AI に相談のサンプル">
        <SampleLine text="Q. 最近寝つきが悪い" color={SAMPLE_MUTED} />
        <SampleLine text="1. 就寝前の画面時間が長い" />
        <SampleLine text="2. 夕方のカフェイン" />
        <SampleLine text="3. 就寝時刻がばらついている" />
      </SampleSheet>
    ),
  },
  symptoms: {
    icon: Stethoscope,
    what: '気になる症状から、受診の目安をやさしく整理します（診断ではありません）',
    tryThis: '当てはまる症状を選ぶ',
    example: '頭痛＋めまい → 考えられる原因と「受診したほうがよい目安」',
    sample: (
      <SampleSheet title="受診の目安" aria="症状チェックのサンプル">
        <SampleLine text="選んだ症状: 頭痛・めまい" color={SAMPLE_MUTED} />
        <SampleLine text="様子を見てよい: 半日で軽くなる" color={SAMPLE_GOOD} />
        <SampleLine text="早めの受診: 手足のしびれを伴う" color={SAMPLE_WARN} />
        <SampleLine text="※ 診断ではありません" color={SAMPLE_MUTED} />
      </SampleSheet>
    ),
  },
  history: {
    icon: FileText,
    what: '通院・服薬・既往歴・アレルギーをまとめて記録しておけます',
    tryThis: '「記録を追加」で 1 件入れてみる',
    example: '2026-06 健康診断 ／ 常用薬 2 件 ／ アレルギー 1 件',
    sample: (
      <SampleSheet title="通院・服薬" aria="通院・服薬のサンプル">
        <SampleRow label="2026-06" value="健康診断" />
        <SampleRow label="常用薬" value="2 件" />
        <SampleRow label="アレルギー" value="1 件" color={SAMPLE_WARN} />
        <SampleLine text="受診時にそのまま見せられます" color={SAMPLE_MUTED} />
      </SampleSheet>
    ),
  },
  sources: {
    icon: Cable,
    what: 'Apple Watch など、からだデータの取り込み元を管理します',
    tryThis: '連携したい機器を選ぶ',
    example: 'Apple Watch 同期済 ／ 手入力 2 件',
    sample: (
      <SampleSheet title="データ連携" aria="データ連携のサンプル">
        <SampleRow label="Apple Watch" value="同期済" color={SAMPLE_GOOD} />
        <SampleRow label="手入力" value="2 件" />
        <SampleRow label="体重計" value="未接続" color={SAMPLE_MUTED} />
        <SampleLine text="つないだ翌朝から自動で届きます" color={SAMPLE_MUTED} />
      </SampleSheet>
    ),
  },
};

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

export default function HealthHub({ persona, settings, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [symptomSeed, setSymptomSeed] = useState<SymptomSeed | null>(null);
  const [coachSeedQuestion, setCoachSeedQuestion] = useState<string | null>(null);
  const health = useHealth();
  const med = useMedicalHistory();

  const anomalies = useMemo(() => detectAnomalies(health.days), [health.days]);
  const alertCount = anomalies.filter((a) => a.severity !== 'info').length;

  const launchSymptomCheck = (seed: SymptomSeed | null) => {
    setSymptomSeed(seed);
    setTab('symptoms');
  };

  const askCoach = (question: string) => {
    setCoachSeedQuestion(question);
    setTab('coach');
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto p-4"
      style={{ background: 'rgba(10,10,15,0.78)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 14 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto my-4 w-full max-w-[1200px]"
      >
        {/* 閉じるボタン: 見つけやすく・44px以上（実ユーザー報告「開くと戻れない」の根治 2026-07-17）。
            右上に固定し、ラベル付きで明確に。モバイルでも押しやすい位置。 */}
        {/* 閉じるボタン: 見つけやすく・44px以上（実ユーザー報告「開くと戻れない」の根治 2026-07-17）。 */}
        <button
          onClick={onClose}
          aria-label="ヘルスを閉じる"
          className="absolute top-2 right-2 z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-4 text-sm font-semibold text-fg backdrop-blur-md hover:bg-black/85"
          style={{ minHeight: 44 }}
        >
          <X className="h-4 w-4" /> 閉じる
        </button>
        {/* 左上の戻る (←) — 全サービス共通ルール (2026-07) */}
        <button
          onClick={onClose}
          aria-label="戻る"
          title="戻る"
          className="absolute top-2 left-2 z-30 flex items-center justify-center rounded-full border border-white/15 bg-black/70 text-fg backdrop-blur-md hover:bg-black/85"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
        </button>

        <MockShell
          module="HEALTH"
          color={PRISM.empathy}
          nav={NAV.map((n) => ({
            key: n.key,
            label: n.label,
            Icon: n.Icon,
            badge: n.key === 'coach' && alertCount > 0 ? alertCount : undefined,
            badgeColor: anomalies.some((a) => a.severity === 'alert') ? '#FF6F6F' : '#FF9F45',
          }))}
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          status={
            alertCount > 0
              ? `PHR · ${alertCount} 件の注意点`
              : `PHR · ${health.days.length} 日データ`
          }
          syncLabel="USER"
          syncValue={settings.userName || persona.name}
          syncSpinner
        >
          {/* CORE Pulse (からだ専用アプリ) への誘致バナー — 2026-07-21 単体サービス切り出し */}
          <div className="mb-3">
            <PulseBanner />
          </div>
          <div className="min-h-[560px]">
            {/* 各タブの「3 秒でわかる説明」。閉じるとそのタブでは二度と出ない */}
            {(() => {
              const intro = INTROS[tab];
              return (
                <StudioIntro
                  id={`health-${tab}`}
                  accent={PRISM.empathy}
                  icon={intro.icon}
                  what={intro.what}
                  tryThis={intro.tryThis}
                  example={intro.example}
                  samplePreview={intro.sample}
                />
              );
            })()}
            {tab === 'overview' && (
              <HealthOverview
                health={health}
                med={med.profile}
                anomalies={anomalies}
                onAskCoach={askCoach}
                userName={settings.userName || persona.name}
                persona={persona}
              />
            )}
            {tab === 'rx' && (
              <HealthPrescriptionView
                health={health}
                userName={settings.userName || persona.name}
              />
            )}
            {tab === 'vitals' && <HealthVitals health={health} />}
            {tab === 'coach' && (
              <HealthCoachView
                settings={settings}
                health={health}
                profile={med.profile}
                onLaunchSymptomCheck={launchSymptomCheck}
                anomalies={anomalies}
                seedQuestion={coachSeedQuestion}
                onSeedQuestionConsumed={() => setCoachSeedQuestion(null)}
              />
            )}
            {tab === 'symptoms' && (
              <HealthSymptomCheck
                settings={settings}
                health={health}
                profile={med.profile}
                initialSeed={symptomSeed}
                onSeedConsumed={() => setSymptomSeed(null)}
              />
            )}
            {tab === 'history' && (
              <HealthHistoryView
                med={med}
                health={health}
                userName={settings.userName || persona.name}
              />
            )}
            {tab === 'sources' && <HealthSourcesView health={health} />}
          </div>
        </MockShell>
      </motion.div>
    </motion.div>
  );
}
