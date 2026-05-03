import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Pill as PillIcon, SmilePlus, Smile, Frown, Meh, Plus, Trash2 } from 'lucide-react';
import { PRISM } from "../prism/MockShell";
import { useQuickLog } from '../../hooks/useQuickLog';
import type { MedicalProfile } from '../../types/health';

interface Props {
  profile: MedicalProfile;
}

const WATER_PRESETS = [200, 300, 500];
const MOOD_OPTIONS = [
  { v: 9, label: '最高', Icon: SmilePlus, color: PRISM.ethics },
  { v: 7, label: '良好', Icon: Smile, color: PRISM.action },
  { v: 5, label: '普通', Icon: Meh, color: PRISM.creative },
  { v: 3, label: '不調', Icon: Frown, color: PRISM.empathy },
];

export function QuickLog({ profile }: Props) {
  const log = useQuickLog();
  const [moodNote, setMoodNote] = useState('');

  const water = log.todayWaterMl();
  const moodAvg = log.todayMoodAvg();
  const meds = log.todayMedsCount();
  const todayList = log.todayEntries();

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4" style={{ color: PRISM.empathy }} />
          <span className="text-[12px] tracking-[0.4em] text-fg-muted">
            QUICK LOG · ワンタップ記録
          </span>
        </div>
      </div>

      {/* Today summary */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Summary
          label="水分"
          value={`${(water / 1000).toFixed(1)}L`}
          color={PRISM.logic}
          icon={<Droplets className="h-3 w-3" style={{ color: PRISM.logic }} />}
        />
        <Summary
          label="服薬"
          value={`${meds}/${profile.medications.length}`}
          color={PRISM.action}
          icon={<PillIcon className="h-3 w-3" style={{ color: PRISM.action }} />}
        />
        <Summary
          label="気分"
          value={moodAvg ? moodAvg.toFixed(1) : '—'}
          color={PRISM.creative}
          icon={<SmilePlus className="h-3 w-3" style={{ color: PRISM.creative }} />}
        />
      </div>

      {/* Water buttons */}
      <div className="mt-4">
        <div className="text-[12px] tracking-[0.3em] text-fg-subtle">水分摂取</div>
        <div className="mt-1.5 flex gap-1.5">
          {WATER_PRESETS.map((ml) => (
            <motion.button
              key={ml}
              whileTap={{ scale: 0.95 }}
              onClick={() => log.add('water', ml)}
              className="flex-1 rounded-lg bg-surface-3 px-3 py-2 text-[14px] text-fg hover:bg-surface-3"
              style={{
                border: `1px solid ${PRISM.logic}40`,
              }}
            >
              <Droplets
                className="mr-1 inline h-3 w-3"
                style={{ color: PRISM.logic }}
              />
              +{ml}ml
            </motion.button>
          ))}
        </div>
      </div>

      {/* Meds buttons */}
      {profile.medications.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] tracking-[0.3em] text-fg-subtle">服薬チェック</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {profile.medications.slice(0, 6).map((m) => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => log.add('meds', undefined, `${m.name} ${m.dose}`)}
                className="flex items-center gap-1 rounded-lg bg-surface-3 px-2.5 py-1.5 text-[13px] text-fg hover:bg-surface-3"
                style={{ border: `1px solid ${PRISM.action}40` }}
              >
                <PillIcon className="h-3 w-3" style={{ color: PRISM.action }} />
                {m.name}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Mood buttons */}
      <div className="mt-3">
        <div className="text-[12px] tracking-[0.3em] text-fg-subtle">気分</div>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {MOOD_OPTIONS.map((m) => (
            <motion.button
              key={m.v}
              whileTap={{ scale: 0.95 }}
              onClick={() => log.add('mood', m.v, moodNote.trim() || undefined)}
              className="flex flex-col items-center gap-1 rounded-lg bg-surface-3 px-2 py-2 hover:bg-surface-3"
              style={{ border: `1px solid ${m.color}40` }}
            >
              <m.Icon className="h-4 w-4" style={{ color: m.color }} />
              <span className="text-[12px] text-fg-muted">{m.label}</span>
            </motion.button>
          ))}
        </div>
        <input
          type="text"
          placeholder="メモ（任意）"
          value={moodNote}
          onChange={(e) => setMoodNote(e.target.value)}
          className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>

      {/* Today's log list */}
      {todayList.length > 0 && (
        <div className="mt-4">
          <div className="text-[12px] tracking-[0.3em] text-fg-subtle">
            今日のログ ({todayList.length})
          </div>
          <div className="mt-1.5 flex max-h-[180px] flex-col gap-1 overflow-y-auto pr-1">
            {todayList
              .slice()
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 text-[13px] text-fg">
                    <span className="font-mono text-[12px] text-fg-subtle">
                      {fmtTime(e.at)}
                    </span>
                    {entryEmoji(e.type)}
                    <span>
                      {e.type === 'water' && `水 ${e.value}ml`}
                      {e.type === 'meds' && `服薬: ${e.label}`}
                      {e.type === 'mood' && `気分 ${e.value}/10${e.label ? ` — ${e.label}` : ''}`}
                      {e.type === 'symptom' && (e.label ?? '症状')}
                    </span>
                  </div>
                  <button
                    onClick={() => log.remove(e.id)}
                    className="text-fg-subtle hover:text-rose-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl bg-surface-2 p-3"
      style={{ boxShadow: `inset 0 0 0 1px ${color}30` }}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] tracking-[0.3em] text-fg-subtle">{label}</span>
      </div>
      <div className="mt-1 font-mono text-[18px] font-light" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function entryEmoji(type: string) {
  return type === 'water' ? '💧' : type === 'meds' ? '💊' : type === 'mood' ? '🙂' : '🩺';
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
