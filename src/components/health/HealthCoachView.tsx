import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Stethoscope, AlertTriangle, Activity } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { useHealthCoach } from '../../hooks/useSymptomAI';
import { detectSymptom, hasRedFlag, type SymptomSeed } from '../../data/symptomDetect';
import type { useHealth } from '../../hooks/useHealth';
import type { AppSettings, ChatMessage } from '../../types/identity';
import type { MedicalProfile } from '../../types/health';
import type { HealthAnomaly } from '../../data/healthAnomaly';

interface Props {
  settings: AppSettings;
  health: ReturnType<typeof useHealth>;
  profile: MedicalProfile;
  onLaunchSymptomCheck?: (seed: SymptomSeed | null) => void;
  anomalies?: HealthAnomaly[];
  seedQuestion?: string | null;
  onSeedQuestionConsumed?: () => void;
}

const SUGGESTED = [
  '今日の睡眠を踏まえて午後の動き方を提案して',
  '直近1週間で改善すべき習慣を3つ',
  'カフェイン摂取量、減らすべき？',
  'HRVを上げる夜のルーティンを設計して',
  '今の状態で運動するなら、何分・どんな種目？',
];

export function HealthCoachView({
  settings, health, profile, onLaunchSymptomCheck,
  anomalies = [], seedQuestion, onSeedQuestionConsumed,
}: Props) {
  const { chat, isLoading, error } = useHealthCoach(settings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingSeed, setPendingSeed] = useState<SymptomSeed | null>(null);
  const [redFlag, setRedFlag] = useState<string | null>(null);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const consumedSeedRef = useRef<string | null>(null);

  // 外部から流し込まれた seedQuestion を自動送信
  useEffect(() => {
    if (!seedQuestion || isLoading) return;
    if (consumedSeedRef.current === seedQuestion) return;
    consumedSeedRef.current = seedQuestion;
    void send(seedQuestion);
    onSeedQuestionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, pendingSeed, redFlag]);

  const visibleAnomalies = anomalies.filter((a) => !dismissedAnomalies.has(a.id));

  const send = async (text?: string) => {
    const m = (text ?? input).trim();
    if (!m || isLoading) return;

    // 症状の手がかりを検出
    const seed = detectSymptom(m);
    const flag = hasRedFlag(m);

    const userMsg: ChatMessage = {
      role: 'user',
      content: m,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    if (seed) setPendingSeed(seed);
    if (flag) setRedFlag(m);

    const reply = await chat(m, messages, health.days, profile);
    if (reply) setMessages((p) => [...p, reply]);
  };

  const dismissSeed = () => setPendingSeed(null);
  const acceptSeed = () => {
    if (pendingSeed) onLaunchSymptomCheck?.(pendingSeed);
    setPendingSeed(null);
  };

  return (
    <div className="grid grid-cols-[1fr_240px] gap-3">
      <div className="glass flex flex-col rounded-2xl p-4 h-[520px]">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">AI HEALTH COACH</div>
          <Pill color={PRISM.empathy}><Sparkles className="mr-1 h-2.5 w-2.5" />PHR + 既往歴 連動</Pill>
        </div>

        <div ref={scrollRef} className="mt-3 flex-1 overflow-y-auto pr-1">
          {/* 自動検知された Anomaly */}
          {visibleAnomalies.length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[12px] tracking-[0.3em] text-fg-subtle">
                <Activity className="h-3 w-3" />
                自動検知された注意点 · {visibleAnomalies.length}
              </div>
              {visibleAnomalies.slice(0, 3).map((a) => {
                const sev =
                  a.severity === 'alert' ? '#FF6F6F'
                  : a.severity === 'caution' ? PRISM.action
                  : PRISM.logic;
                return (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-white/8 bg-surface-2 px-3 py-2"
                    style={{ boxShadow: `inset 0 0 0 1px ${sev}30` }}
                  >
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-fg">{a.title}</div>
                      <p className="mt-0.5 text-[14px] text-fg-muted">{a.detail}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {a.suggestedQuestion && (
                        <button
                          onClick={() => send(a.suggestedQuestion!)}
                          className="rounded-md px-2 py-1 text-[12px] font-medium"
                          style={{ background: sev, color: '#0A0A0A' }}
                        >
                          AIに聞く
                        </button>
                      )}
                      <button
                        onClick={() => setDismissedAnomalies((s) => new Set([...s, a.id]))}
                        className="text-[11px] text-fg-subtle hover:text-fg-muted"
                      >
                        無視
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {messages.length === 0 && !isLoading && visibleAnomalies.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 text-3xl">🩺</div>
              <p className="text-[14px] text-fg-muted">PHR・既往歴・服薬・家族歴を踏まえて、<br/>具体的な習慣改善を提案します。</p>
              <p className="mt-1 text-[12px] text-fg-subtle">下から質問するか、サンプルから選んでください。</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    m.role === 'user' ? 'bg-surface-3 text-fg' : 'bg-surface-2 text-fg'
                  }`}
                >
                  {m.content}
                  <div className="mt-1 text-[11px] text-fg-subtle">{m.timestamp}</div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex">
                <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-fg-muted">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/30 [animation-delay:0.3s]" />
                  </span>
                </div>
              </div>
            )}

            {/* Red Flag urgent banner */}
            <AnimatePresence>
              {redFlag && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-300" />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-rose-200">
                        受診を強く推奨する症状の可能性があります
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-rose-100/85">
                        激しい胸痛・呼吸困難・突然の麻痺・意識障害などは即座に救急相談（#7119）または救急要請（119）をご検討ください。
                      </p>
                      <button
                        onClick={() => setRedFlag(null)}
                        className="mt-2 rounded-md bg-rose-500/20 px-2 py-1 text-[12px] text-rose-100"
                      >
                        了承して続ける
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Symptom Check 自動誘導カード */}
            <AnimatePresence>
              {pendingSeed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="ml-2 max-w-[88%] rounded-2xl border border-pink-300/20 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: `${PRISM.empathy}20`, border: `1px solid ${PRISM.empathy}55` }}
                    >
                      <Stethoscope className="h-3.5 w-3.5" style={{ color: PRISM.empathy }} />
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-fg">
                        「{regionLabel(pendingSeed.region)}」関連の症状を検出しました
                      </div>
                      <p className="mt-1 text-[13px] text-fg-muted">
                        AI鑑別を実行すると、PHR・既往歴・服薬から考えられる疾患候補と緊急度をお出しします。
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={acceptSeed}
                          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium"
                          style={{ background: PRISM.empathy, color: '#0A0A0A' }}
                        >
                          <Stethoscope className="h-3 w-3" /> AI鑑別へ
                        </button>
                        <button
                          onClick={dismissSeed}
                          className="rounded-md bg-surface-3 px-2.5 py-1.5 text-[13px] text-fg-muted hover:bg-surface-3"
                        >
                          会話を続ける
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {error && (
          <div className="mt-2 rounded-md bg-rose-500/10 px-2 py-1 text-[12px] text-rose-300">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5"
        >
          <input
            type="text"
            placeholder="気になることを質問..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
            style={{ background: PRISM.empathy, color: '#0A0A0A' }}
          >
            <Send className="h-3 w-3" /> 送信
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <div className="glass rounded-2xl p-3">
          <div className="text-[12px] tracking-[0.3em] text-fg-muted">サンプル質問</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={isLoading}
                className="rounded-lg bg-surface-2 px-2.5 py-2 text-left text-[13px] text-fg-muted transition hover:bg-surface-3"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-3">
          <div className="text-[12px] tracking-[0.3em] text-fg-muted">AIに渡されるコンテキスト</div>
          <ul className="mt-2 flex flex-col gap-1 text-[14px] text-fg-muted">
            <li>· 直近30日のPHR ({health.days.length}日)</li>
            <li>· 既往歴 {profile.conditions.length} / 服薬 {profile.medications.length}</li>
            <li>· アレルギー {profile.allergies.length} / 家族歴 {profile.familyHistory.length}</li>
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-subtle">
            返答は参考情報であり、医学的診断ではありません。症状が強い・続く場合は医療機関を受診してください。
          </p>
        </div>
      </div>
    </div>
  );
}

function regionLabel(r: string) {
  return r;
}
