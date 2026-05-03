import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Stethoscope, AlertTriangle, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { useSymptomAI } from '../../hooks/useSymptomAI';
import type { SymptomSeed } from '../../data/symptomDetect';
import type { useHealth } from '../../hooks/useHealth';
import type { AppSettings } from '../../types/identity';
import type {
  BodyRegion,
  MedicalProfile,
  SymptomEntry,
  SymptomSeverity,
  SymptomDuration,
  SymptomAnalysis,
  Urgency,
} from '../../types/health';

interface Props {
  settings: AppSettings;
  health: ReturnType<typeof useHealth>;
  profile: MedicalProfile;
  initialSeed?: SymptomSeed | null;
  onSeedConsumed?: () => void;
}

const REGIONS: BodyRegion[] = [
  '頭部', '目', '耳', '鼻', '口・喉', '首・肩',
  '胸部', '腹部', '背中・腰', '四肢', '皮膚', '全身', '精神',
];

const SEV: { v: SymptomSeverity; label: string }[] = [
  { v: 'mild', label: '軽い' },
  { v: 'moderate', label: '中等度' },
  { v: 'severe', label: '強い' },
];

const DUR: { v: SymptomDuration; label: string }[] = [
  { v: 'minutes', label: '数分' },
  { v: 'hours', label: '数時間' },
  { v: '1-3days', label: '1〜3日' },
  { v: 'week', label: '1週間' },
  { v: 'month', label: '1ヶ月以上' },
  { v: 'longer', label: 'それ以上' },
];

const URGENCY_META: Record<Urgency, { label: string; color: string; emoji: string }> = {
  'self-care':   { label: 'セルフケア',  color: PRISM.ethics,   emoji: '🌿' },
  'monitor':     { label: '経過観察',    color: PRISM.creative, emoji: '👀' },
  'gp-soon':     { label: '近日中に受診',color: PRISM.action,   emoji: '🩺' },
  'gp-today':    { label: '本日受診',    color: '#FF8A45',      emoji: '⚡️' },
  'urgent-care': { label: '緊急受診',    color: '#FF6F6F',      emoji: '🚨' },
  'er':          { label: '救急要請',    color: '#FF3D5A',      emoji: '🆘' },
};

export function HealthSymptomCheck({
  settings,
  health,
  profile,
  initialSeed,
  onSeedConsumed,
}: Props) {
  const { analyze, isLoading, error } = useSymptomAI(settings);
  const [region, setRegion] = useState<BodyRegion>('全身');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<SymptomSeverity>('moderate');
  const [duration, setDuration] = useState<SymptomDuration>('1-3days');
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [seedNotice, setSeedNotice] = useState<SymptomSeed | null>(null);
  const consumedRef = useRef<string | null>(null);

  // Seed (AI Coach から自動誘導されたとき) で初期値をプレフィル
  useEffect(() => {
    if (!initialSeed) return;
    const fingerprint = `${initialSeed.region}|${initialSeed.description}`;
    if (consumedRef.current === fingerprint) return;
    consumedRef.current = fingerprint;
    setRegion(initialSeed.region);
    setDesc(initialSeed.description);
    setSeverity(initialSeed.severity);
    setDuration(initialSeed.duration);
    setSeedNotice(initialSeed);
    onSeedConsumed?.();
  }, [initialSeed, onSeedConsumed]);

  const add = () => {
    if (!desc.trim()) return;
    setEntries((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        region,
        description: desc.trim(),
        severity,
        duration,
        startedAt: new Date().toISOString(),
      },
    ]);
    setDesc('');
  };

  const remove = (id: string) =>
    setEntries((p) => p.filter((e) => e.id !== id));

  const run = async () => {
    if (entries.length === 0) return;
    const res = await analyze(entries, health.days, profile);
    setAnalysis(res);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-amber-300" />
        <p className="text-[13px] leading-relaxed text-amber-200/85">
          本機能は<strong>予防医療の参考情報</strong>です。確定診断ではありません。
          強い症状・急変・不安が大きい場合は速やかに医療機関にご相談ください。
        </p>
      </div>

      {/* AI Coach から自動誘導されたとき */}
      {seedNotice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-pink-300/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 px-3 py-2"
        >
          <Wand2 className="h-3.5 w-3.5 text-pink-300" />
          <p className="text-[13px] text-pink-100/85">
            AI Coach から「<span className="font-medium">{seedNotice.region}</span>」関連の症状を引き継ぎました。下のフォームを確認して必要なら編集してください。
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-3">
        {/* Symptom input */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">SYMPTOM ENTRY</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] tracking-[0.3em] text-fg-subtle">部位</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as BodyRegion)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none"
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] tracking-[0.3em] text-fg-subtle">持続期間</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as SymptomDuration)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none"
              >
                {DUR.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[12px] tracking-[0.3em] text-fg-subtle">症状の説明</label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="例: 食後 30 分後に胸焼け、夜間に悪化"
              className="mt-1 w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>

          <div className="mt-3">
            <label className="text-[12px] tracking-[0.3em] text-fg-subtle">強度</label>
            <div className="mt-1 flex gap-1">
              {SEV.map((s) => (
                <button
                  key={s.v}
                  onClick={() => setSeverity(s.v)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[13px] transition ${
                    severity === s.v ? 'bg-surface-3 text-fg' : 'bg-surface-2 text-fg-muted hover:bg-white/8'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={add}
            disabled={!desc.trim()}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[14px] font-medium disabled:opacity-40"
            style={{ background: PRISM.empathy, color: '#0A0A0A' }}
          >
            <Plus className="h-3.5 w-3.5" /> 症状を追加
          </button>
        </div>

        {/* Entries + Run */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-4 flex-1">
            <div className="flex items-center justify-between">
              <div className="text-[12px] tracking-[0.4em] text-fg-muted">入力された症状</div>
              <span className="text-[12px] text-fg-subtle">{entries.length}件</span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
              {entries.length === 0 && (
                <p className="text-[13px] text-fg-subtle text-center py-4">まだ追加されていません</p>
              )}
              {entries.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
                  <div>
                    <div className="text-[13px] text-fg">[{e.region}] {e.description}</div>
                    <div className="text-[11px] text-fg-subtle">
                      {SEV.find(s => s.v === e.severity)?.label} / {DUR.find(d => d.v === e.duration)?.label}
                    </div>
                  </div>
                  <button onClick={() => remove(e.id)} className="text-fg-subtle hover:text-rose-300">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={run}
            disabled={entries.length === 0 || isLoading}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-medium disabled:opacity-40"
            style={{
              background: 'linear-gradient(120deg,#4F8CFF,#FF6FB5,#B07CFF,#FF9F45,#F5C24A)',
              color: '#0A0A0A',
            }}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" /> 解析中…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Stethoscope className="h-4 w-4" /> AI鑑別を実行
              </span>
            )}
          </button>

          {error && (
            <div className="rounded-md bg-rose-500/10 px-2 py-1 text-[12px] text-rose-300">{error}</div>
          )}
        </div>
      </div>

      {/* Result */}
      {analysis && <AnalysisResult result={analysis} />}
    </div>
  );
}

function AnalysisResult({ result }: { result: SymptomAnalysis }) {
  const top = URGENCY_META[result.topUrgency];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-3"
    >
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">AI 鑑別結果</div>
          <Pill color={top.color}>
            {top.emoji} 推奨: {top.label}
          </Pill>
        </div>
        <p className="mt-3 text-[14px] text-fg-muted">{result.contextSummary}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {result.differentials.map((d, i) => {
          const ur = URGENCY_META[d.urgency];
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-fg">{d.conditionName}</span>
                    {d.conditionNameEn && (
                      <span className="text-[12px] text-fg-subtle">{d.conditionNameEn}</span>
                    )}
                    <Pill color={ur.color}>{ur.emoji} {ur.label}</Pill>
                    <Pill color={PRISM.creative}>{d.category}</Pill>
                  </div>
                  <div className="mt-1 text-[12px] text-fg-subtle">推定可能性</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-[200px] overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${d.likelihood}%`, background: ur.color }}
                      />
                    </div>
                    <span className="font-mono text-[13px] text-fg-muted">{d.likelihood}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[12px] tracking-[0.3em] text-fg-subtle">判断根拠</div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-fg-muted">
                    {d.matchedSignals.map((s, idx) => (
                      <li key={idx}>· {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[12px] tracking-[0.3em] text-fg-subtle">セルフケア</div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-fg-muted">
                    {(d.selfCare ?? []).map((s, idx) => (
                      <li key={idx}>· {s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {d.whenToSeeDoctor && (
                <div className="mt-3 rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg-muted">
                  <span className="text-fg-muted">受診タイミング:</span> {d.whenToSeeDoctor}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {result.habits.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">推奨される生活習慣</div>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[14px] text-fg md:grid-cols-2">
            {result.habits.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 rounded-full" style={{ background: PRISM.ethics }} />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.redFlags.length > 0 && (
        <div className="glass rounded-2xl border border-rose-500/20 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-300" />
            <div className="text-[12px] tracking-[0.4em] text-rose-300">RED FLAGS · 即受診サイン</div>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[14px] text-rose-200/85 md:grid-cols-2">
            {result.redFlags.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 rounded-full bg-rose-300" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-[12px] leading-relaxed text-fg-subtle">
        {result.disclaimer}
      </p>
    </motion.div>
  );
}
