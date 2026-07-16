import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, BarChart3, MessageCircle, Stethoscope, FileText, Cable, Pill } from 'lucide-react';
import { MockShell, PRISM } from '../prism/MockShell';
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

type Tab = 'overview' | 'rx' | 'vitals' | 'coach' | 'symptoms' | 'history' | 'sources';

const NAV = [
  { key: 'overview',  label: 'Overview',     Icon: BarChart3 },
  { key: 'rx',        label: 'AI 処方箋',     Icon: Pill },
  { key: 'vitals',    label: 'Vitals',       Icon: Activity },
  { key: 'coach',     label: 'AI Coach',     Icon: MessageCircle },
  { key: 'symptoms',  label: 'Symptom Check',Icon: Stethoscope },
  { key: 'history',   label: 'Medical Hx',   Icon: FileText },
  { key: 'sources',   label: 'Sources',      Icon: Cable },
] as const;

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
          <div className="min-h-[560px]">
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
