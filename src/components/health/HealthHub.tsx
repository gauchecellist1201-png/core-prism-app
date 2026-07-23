import { useMemo, useState } from 'react';
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

// 各タブの一番上に出す「3 秒でわかる説明」。初見の人が触らずに
// 「この画面は何ができて / まず何を押すか / どんな結果になるか」を分かるようにする。
const INTROS: Record<Tab, { icon: typeof BarChart3; what: string; tryThis: string; example: string }> = {
  overview: {
    icon: BarChart3,
    what: '今日のからだの状態を 1 画面でまとめて確認できます',
    tryThis: '睡眠・心拍・回復スコアと「注意点」に目を通す',
    example: '睡眠 6.2h ／ 安静時心拍 58 ／ 回復スコア 72',
  },
  rx: {
    icon: Pill,
    what: '今日のからだに合った過ごし方を AI が「処方」します',
    tryThis: '「処方箋を作る」を押す',
    example: '午前は集中作業 → 15 時に 10 分の散歩 → 就寝は 23 時',
  },
  vitals: {
    icon: Activity,
    what: '睡眠・心拍・歩数などの数値を時系列のグラフで見られます',
    tryThis: '気になる指標のカードを選ぶ',
    example: '今週の平均睡眠 6.4h（先週より +18 分）',
  },
  coach: {
    icon: MessageCircle,
    what: 'からだの悩みを、あなたの数値を踏まえて AI に相談できます',
    tryThis: '下の入力欄に気になる事を書く',
    example: '「最近寝つきが悪い」→ 考えられる原因と対処を 3 つ',
  },
  symptoms: {
    icon: Stethoscope,
    what: '気になる症状から、受診の目安をやさしく整理します（診断ではありません）',
    tryThis: '当てはまる症状を選ぶ',
    example: '頭痛＋めまい → 考えられる原因と「受診したほうがよい目安」',
  },
  history: {
    icon: FileText,
    what: '通院・服薬・既往歴・アレルギーをまとめて記録しておけます',
    tryThis: '「記録を追加」で 1 件入れてみる',
    example: '2026-06 健康診断 ／ 常用薬 2 件 ／ アレルギー 1 件',
  },
  sources: {
    icon: Cable,
    what: 'Apple Watch など、からだデータの取り込み元を管理します',
    tryThis: '連携したい機器を選ぶ',
    example: 'Apple Watch 同期済 ／ 手入力 2 件',
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
