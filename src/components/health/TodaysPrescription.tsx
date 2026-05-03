import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Sun, Coffee, Moon, Target, Clock, CheckCircle2 } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import type { DailyHealth } from '../../types/health';
import type { HealthAnomaly } from '../../data/healthAnomaly';
import type { Persona } from '../../types/identity';

interface Props {
  today: DailyHealth;
  anomalies: HealthAnomaly[];
  persona: Persona;
}

interface PrescriptionItem {
  id: string;
  time: string;       // 「09:00」 or 「終日」
  emoji: string;
  title: string;
  detail: string;
  axis: 'sleep' | 'mind' | 'activity' | 'nutrition' | 'recovery';
  Icon: typeof Sun;
}

function buildPrescription(today: DailyHealth, anomalies: HealthAnomaly[]): PrescriptionItem[] {
  const items: PrescriptionItem[] = [];

  // 朝のルーチン
  if (today.recoveryScore >= 70) {
    items.push({
      id: 'morning-action',
      time: '09:00',
      emoji: '🚀',
      title: '攻めの判断は午前に',
      detail: `リカバリー${today.recoveryScore}点。難しい意思決定や新規面談を午前中に置く`,
      axis: 'recovery',
      Icon: Sun,
    });
  } else {
    items.push({
      id: 'morning-easy',
      time: '09:00',
      emoji: '☕',
      title: 'ウォームアップ重視',
      detail: `リカバリー${today.recoveryScore}点と低め。重要判断は11時以降が安全`,
      axis: 'recovery',
      Icon: Sun,
    });
  }

  // カフェイン
  if (today.caffeineMg > 250) {
    items.push({
      id: 'caf-cut',
      time: '14:00',
      emoji: '🚫☕',
      title: 'カフェインを切る',
      detail: `今日 ${today.caffeineMg}mg は多め。14時以降は控えて睡眠を守る`,
      axis: 'nutrition',
      Icon: Coffee,
    });
  } else {
    items.push({
      id: 'caf-ok',
      time: '14:00',
      emoji: '☕',
      title: '最後のコーヒー',
      detail: '14時以降のカフェインは睡眠の質を下げます',
      axis: 'nutrition',
      Icon: Coffee,
    });
  }

  // 運動
  if (today.steps < 5000) {
    items.push({
      id: 'walk-now',
      time: '17:00',
      emoji: '🚶',
      title: '20分の散歩',
      detail: `今日まだ ${today.steps.toLocaleString()}歩。夕方の20分歩行で気分・血糖・睡眠が整う`,
      axis: 'activity',
      Icon: Target,
    });
  } else if (today.activeMinutes >= 45) {
    items.push({
      id: 'cooldown',
      time: '17:30',
      emoji: '🧘',
      title: 'クールダウン',
      detail: '十分動いた日。10分のストレッチで筋疲労と HRV を回復',
      axis: 'recovery',
      Icon: Target,
    });
  } else {
    items.push({
      id: 'move-light',
      time: '17:30',
      emoji: '🏃',
      title: '軽い運動15分',
      detail: '夕方の有酸素は深睡眠を 22% 増やす効果',
      axis: 'activity',
      Icon: Target,
    });
  }

  // ストレス対応
  if (today.stressLevel >= 65) {
    items.push({
      id: 'stress-break',
      time: '19:00',
      emoji: '🌬',
      title: '4-7-8 呼吸法 6分',
      detail: `ストレス指数${today.stressLevel}と高め。副交感神経を起動`,
      axis: 'mind',
      Icon: Sparkles,
    });
  } else if (today.mindfulMinutes < 5) {
    items.push({
      id: 'mind-now',
      time: '19:00',
      emoji: '🧘',
      title: 'マインドフル 5分',
      detail: '今日まだ実施していません。1日1回で集中力が戻る',
      axis: 'mind',
      Icon: Sparkles,
    });
  }

  // 夜
  if (today.sleepHours < 7) {
    items.push({
      id: 'sleep-early',
      time: '22:00',
      emoji: '🛌',
      title: '早めの就寝',
      detail: `昨夜${today.sleepHours.toFixed(1)}h。今夜は22時就寝で取り戻す`,
      axis: 'sleep',
      Icon: Moon,
    });
  } else {
    items.push({
      id: 'sleep-keep',
      time: '22:30',
      emoji: '🌙',
      title: '入眠ルーチン開始',
      detail: 'ブルーライト遮断・室温20℃・深い呼吸で深睡眠を最大化',
      axis: 'sleep',
      Icon: Moon,
    });
  }

  // アルコール警告
  if (today.alcoholDrinks >= 2) {
    items.push({
      id: 'alc-water',
      time: '終日',
      emoji: '💧',
      title: '水分を多めに',
      detail: `アルコール${today.alcoholDrinks}杯記録。水を1.5L 追加で翌日HRV低下を緩和`,
      axis: 'nutrition',
      Icon: Clock,
    });
  }

  // Anomaly に応じた追加
  for (const a of anomalies.slice(0, 2)) {
    if (a.severity === 'alert' || a.severity === 'caution') {
      items.push({
        id: `anom-${a.id}`,
        time: '注意',
        emoji: a.severity === 'alert' ? '⚠️' : '🟡',
        title: a.title,
        detail: a.detail,
        axis: 'recovery',
        Icon: Sparkles,
      });
    }
  }

  return items;
}

export function TodaysPrescription({ today, anomalies, persona }: Props) {
  const items = useMemo(
    () => buildPrescription(today, anomalies),
    [today, anomalies]
  );

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              background: `${persona.accentColor}1A`,
              border: `1px solid ${persona.accentColor}55`,
            }}
          >
            <Sparkles
              className="h-3.5 w-3.5"
              style={{ color: persona.accentColor }}
            />
          </span>
          <div>
            <div className="text-[12px] tracking-[0.4em] text-fg-muted">
              TODAY'S PRESCRIPTION · 今日の処方箋
            </div>
            <div className="text-[13px] text-fg-subtle">
              PHR + 異常検知から構成された 1 日の行動プラン
            </div>
          </div>
        </div>
        <Pill color={persona.accentColor}>{items.length} アクション</Pill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5">
        {items.map((it, i) => (
          <PrescItem key={it.id} item={it} index={i} />
        ))}
      </div>
    </div>
  );
}

function PrescItem({
  item,
  index,
}: {
  item: PrescriptionItem;
  index: number;
}) {
  const axisColor = {
    sleep: PRISM.logic,
    recovery: PRISM.empathy,
    activity: PRISM.action,
    mind: PRISM.creative,
    nutrition: PRISM.ethics,
  }[item.axis];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="grid grid-cols-[64px_24px_1fr_24px] items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
    >
      <div
        className="font-mono text-[13px] tracking-wider"
        style={{ color: axisColor }}
      >
        {item.time}
      </div>
      <span className="text-[16px] leading-none">{item.emoji}</span>
      <div>
        <div className="text-[14px] text-fg">{item.title}</div>
        <div className="text-[14px] text-fg-muted">{item.detail}</div>
      </div>
      <CheckCircle2 className="h-3.5 w-3.5 text-fg-subtle" />
    </motion.div>
  );
}
