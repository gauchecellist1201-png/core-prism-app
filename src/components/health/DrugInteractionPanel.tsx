import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pill as PillIcon, Sparkles, ShieldCheck } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import {
  computeInteractions,
  severityMeta,
  type DrugInteraction,
} from '../../data/drugInteractions';
import type { useHealth } from '../../hooks/useHealth';
import type { MedicalProfile } from '../../types/health';

interface Props {
  health: ReturnType<typeof useHealth>;
  profile: MedicalProfile;
}

export function DrugInteractionPanel({ health, profile }: Props) {
  const [grapefruit, setGrapefruit] = useState(false);
  const [greenVeg, setGreenVeg] = useState(false);

  const week = health.days.slice(-7);
  const avgAlcohol = week.reduce((s, d) => s + d.alcoholDrinks, 0);
  const avgCaffeine = Math.round(week.reduce((s, d) => s + d.caffeineMg, 0) / Math.max(1, week.length));

  const interactions: DrugInteraction[] = useMemo(
    () =>
      computeInteractions({
        medications: profile.medications,
        allergies: profile.allergies,
        avgAlcoholPerWeek: avgAlcohol,
        avgCaffeinePerDay: avgCaffeine,
        flags: { grapefruit, greenVeg },
      }),
    [profile.medications, profile.allergies, avgAlcohol, avgCaffeine, grapefruit, greenVeg]
  );

  const drugCount = profile.medications.length;
  const seriousCount = interactions.filter((i) => i.severity === 'serious').length;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{
              background: `${PRISM.action}1A`,
              border: `1px solid ${PRISM.action}40`,
            }}
          >
            <PillIcon className="h-3 w-3" style={{ color: PRISM.action }} />
          </span>
          <span className="text-[12px] tracking-[0.3em]" style={{ color: PRISM.action }}>
            DRUG INTERACTION CHECK · 相互作用
          </span>
        </div>
        <div className="flex items-center gap-2">
          {seriousCount > 0 ? (
            <Pill color="#FF3D5A">🚨 重大 {seriousCount} 件</Pill>
          ) : interactions.length > 0 ? (
            <Pill color={PRISM.action}>注意 {interactions.length} 件</Pill>
          ) : (
            <Pill color={PRISM.ethics}>
              <ShieldCheck className="mr-1 h-2.5 w-2.5" />
              異常なし
            </Pill>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-surface-2 p-3 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">登録中の薬</span>
          <span className="font-mono text-fg">{drugCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">アレルギー</span>
          <span className="font-mono text-fg">{profile.allergies.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">週間アルコール</span>
          <span className="font-mono text-fg">{avgAlcohol} 杯</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">カフェイン平均</span>
          <span className="font-mono text-fg">{avgCaffeine} mg/日</span>
        </div>
      </div>

      {/* Lifestyle flags */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] tracking-[0.3em] text-fg-subtle">ライフスタイル</span>
        <Toggle label="🍊 グレープフルーツをよく飲む" on={grapefruit} onChange={setGrapefruit} />
        <Toggle label="🥬 緑黄色野菜・納豆を毎日" on={greenVeg} onChange={setGreenVeg} />
      </div>

      {/* Results */}
      {drugCount === 0 ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-4 text-center text-[13px] text-fg-subtle">
          薬を登録すると、相互作用と生活習慣リスクを自動チェックします
        </div>
      ) : interactions.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-[13px] text-emerald-200/85">
          <ShieldCheck className="h-4 w-4" />
          現在の登録内容で重要な相互作用は検出されませんでした。新しい薬や OTC を追加するときに再チェックされます。
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {interactions.map((it, i) => (
            <InteractionCard key={it.id} item={it} index={i} />
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-[12px] leading-relaxed text-fg-subtle">
        本機能は気付きを促す補助情報です。実際の併用可否は処方医・薬剤師にご相談ください。
      </p>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`rounded-full px-2.5 py-1 text-[14px] transition ${
        on ? 'bg-surface-3 text-fg' : 'bg-surface-2 text-fg-muted hover:bg-white/8'
      }`}
    >
      {label}
    </button>
  );
}

function InteractionCard({ item, index }: { item: DrugInteraction; index: number }) {
  const meta = severityMeta(item.severity);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-white/8 bg-surface-2 p-3"
      style={{ boxShadow: `inset 0 0 0 1px ${meta.color}30` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-2">
          <span className="text-[14px]">{meta.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-medium text-fg">
                {item.pair[0]}
              </span>
              <span className="text-fg-subtle">×</span>
              <span className="text-[14px] font-medium text-fg">
                {item.pair[1]}
              </span>
              <Pill color={meta.color}>{meta.label}</Pill>
              <Pill color={PRISM.creative}>{item.category}</Pill>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
              <span className="text-fg-subtle">仕組み:</span> {item.mechanism}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
              <span className="text-fg-subtle">影響:</span> {item.effect}
            </p>
            <div className="mt-2 rounded-md bg-surface-3 px-2.5 py-1.5 text-[13px] text-fg">
              <Sparkles className="mr-1 inline h-3 w-3" style={{ color: meta.color }} />
              {item.recommendation}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
