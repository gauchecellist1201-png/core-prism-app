import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import SampleDataCTA from './SampleDataCTA';
import StreakBadge from './StreakBadge';
import { useAgentTaskQueue, CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { getCurrentSlot, getTodayBrief } from '../lib/coachScheduler';
import { notifyInApp } from '../lib/inAppNotify';

interface Props {
  personas: Persona[];
  userName: string;
  onSelect: (id: string) => void;
  onCreatePersona: () => void;
}

// 万 単位フォーマッタ — 数字は実値、未計算は「—」
function fmtMan(yen: number | undefined | null): string {
  if (yen === undefined || yen === null || Number.isNaN(yen)) return '—';
  if (yen === 0) return '0';
  const man = yen / 10000;
  if (Math.abs(man) >= 100) return `${Math.round(man)}`;
  if (Math.abs(man) >= 10) return man.toFixed(1).replace(/\.0$/, '');
  return man.toFixed(1);
}

function fmtSigned(yen: number | undefined | null): string {
  if (yen === undefined || yen === null || Number.isNaN(yen)) return '—';
  const sign = yen > 0 ? '+' : yen < 0 ? '−' : '';
  const abs = Math.abs(yen);
  return `${sign}¥${fmtMan(abs)}万`;
}

// 各ペルソナにアサインする 3 つの CXO アバター (id ハッシュで安定割当)
const CXO_KEYS: CxoRole[] = ['CEO', 'CFO', 'CMO', 'CSO', 'CTO', 'COO', 'CPO', 'CDO', 'CDS'];
function pickCxosFor(personaId: string): CxoRole[] {
  let h = 0;
  for (let i = 0; i < personaId.length; i++) h = (h * 31 + personaId.charCodeAt(i)) >>> 0;
  const len = CXO_KEYS.length;
  const a = CXO_KEYS[h % len];
  const b = CXO_KEYS[(h >>> 3) % len];
  const c = CXO_KEYS[(h >>> 6) % len];
  // 重複除去 (順序維持)
  const seen = new Set<CxoRole>();
  const out: CxoRole[] = [];
  for (const k of [a, b, c, 'CEO', 'CFO', 'CMO'] as CxoRole[]) {
    if (!seen.has(k)) { seen.add(k); out.push(k); }
    if (out.length === 3) break;
  }
  return out;
}

export default function IdentitySelection({ personas, userName, onSelect, onCreatePersona }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
  const { counts, proposedTasks, activeTask } = useAgentTaskQueue();

  // 各ペルソナの「未読ブリーフ N 件 / 未承認 M 件」を計算
  const personaBadges = useMemo(() => {
    const slot = getCurrentSlot();
    const map = new Map<string, { unreadBrief: number; pendingProposals: number }>();
    personas.forEach(p => {
      let unreadBrief = 0;
      if (slot) {
        const b = getTodayBrief(slot, p.id);
        if (b && !b.read && !b.dismissed) unreadBrief = 1;
      }
      // 提案 (proposed) はグローバルなので、各カードに最大 1 件のヒントとして表示
      const pendingProposals = proposedTasks.length > 0 ? proposedTasks.length : 0;
      map.set(p.id, { unreadBrief, pendingProposals });
    });
    return map;
  }, [personas, proposedTasks]);

  const handleSelectWithTransition = (persona: Persona) => {
    // 切替演出: accent 色のフラッシュ + トースト
    try {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9999;background:radial-gradient(circle at 50% 50%, ${persona.accentColor}33 0%, transparent 70%);opacity:0;transition:opacity 200ms ease;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      setTimeout(() => { el.style.opacity = '0'; }, 240);
      setTimeout(() => { el.remove(); }, 600);
    } catch { /* ignore */ }
    notifyInApp({ kind: 'info', title: `${persona.name} に切替えました`, body: persona.subtitle || '最適化された環境へ', duration: 2200 });
    onSelect(persona.id);
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div className="absolute w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.06) 0%, transparent 70%)', top: '10%', left: '20%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(63,63,160,0.08) 0%, transparent 70%)', bottom: '15%', right: '15%' }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.3, 0.5] }}
          transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* Header */}
      <motion.div className="text-center mb-10 relative z-10 px-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <p className="text-xs tracking-[0.3em] text-neutral-600 uppercase mb-3">CORE Identity OS</p>
        {personas.length === 0 ? (
          <h1 className="text-prism text-3xl sm:text-4xl font-extralight tracking-tight mb-2">
            {userName ? `${greeting}、${userName}さん。` : 'ようこそ。'}
          </h1>
        ) : userName ? (
          <h1 className="text-prism text-3xl font-extralight tracking-tight mb-2">
            {greeting}、{userName}さん。
          </h1>
        ) : (
          <h1 className="text-prism text-3xl font-extralight tracking-tight mb-2">
            今日は、誰として在りますか。
          </h1>
        )}
        <p className="text-neutral-600 text-sm font-light tracking-wider">
          {personas.length === 0 ? '最初の人格を作って、AI 役員 9 人を味方につける' : '人格を選択して、最適化された環境へ入る'}
        </p>
        {personas.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <StreakBadge accent="#A78BFA" brand="prism" />
          </div>
        )}
      </motion.div>

      {/* Empty state — 「ようこそ」 */}
      {personas.length === 0 ? (
        <motion.div className="text-center relative z-10 max-w-md px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="mb-7 space-y-2 text-neutral-500 text-sm font-light leading-relaxed">
            <p>1. 役割や事業ごとに「人格」を作る</p>
            <p>2. AI 役員 9 人がその人格の数字と日々を見続ける</p>
            <p>3. 承認するだけで、仕事が進む</p>
          </div>
          <motion.button
            onClick={onCreatePersona}
            className="px-9 py-4 rounded-full text-sm font-medium relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f', minHeight: 52, boxShadow: '0 12px 36px -8px rgba(201,169,110,0.5)' }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.span
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
            />
            <span className="relative">＋ 人格を作る（1 分）</span>
          </motion.button>
          <div className="mt-7 flex flex-col items-center">
            <p className="text-neutral-600 text-xs mb-2">先に中身を見たい方は</p>
            <SampleDataCTA
              label="サンプルから始める（カフェ経営者）"
              hint="実物データで全機能をすぐ触れます（あとで消せます）"
            />
          </div>
        </motion.div>
      ) : (
        <div className={`grid gap-4 w-full relative z-10 px-6 ${
          personas.length <= 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
          personas.length <= 4 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl'
        }`}>
          {personas.map((persona, i) => {
            const income = persona.cashflow?.income ?? 0;
            const expense = persona.cashflow?.expense ?? 0;
            const net = income - expense;
            const hasNumbers = income > 0 || expense > 0;
            const cxos = pickCxosFor(persona.id);
            const badges = personaBadges.get(persona.id);
            const unreadBrief = badges?.unreadBrief ?? 0;
            const isActiveCxoOwned = !!activeTask; // 走っている時は全カードで光らせる

            return (
              <motion.button
                key={persona.id}
                onClick={() => handleSelectWithTransition(persona)}
                className="relative group text-left p-5 rounded-2xl overflow-hidden cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.7 }}
                whileHover={{ y: -4, scale: 1.01, boxShadow: `0 20px 50px -12px ${persona.accentColor}33, 0 8px 24px -8px rgba(0,0,0,0.45)` }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Left accent bar (hover で出現) */}
                <motion.div
                  className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                  style={{ background: persona.accentColor }}
                  initial={{ opacity: 0, scaleY: 0.5 }}
                  whileHover={{ opacity: 1, scaleY: 1 }}
                />
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: persona.accentColor }} />

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(ellipse at top left, ${persona.accentColorLight} 0%, transparent 60%)` }} />
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ boxShadow: `inset 0 0 0 1px ${persona.accentColor}40` }} />

                {/* Unread badge — 右上 */}
                {(unreadBrief > 0 || (counts.proposed > 0 && i === 0)) && (
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-20">
                    {unreadBrief > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${persona.accentColor}22`, color: persona.accentColor, border: `1px solid ${persona.accentColor}55` }}>
                        ブリーフ {unreadBrief}
                      </span>
                    )}
                    {counts.proposed > 0 && i === 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.4)' }}>
                        未承認 {counts.proposed}
                      </span>
                    )}
                  </div>
                )}

                <div className="relative z-10">
                  <div className="text-2xl mb-3 w-10 h-10 flex items-center justify-center rounded-xl"
                    style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                    {persona.icon}
                  </div>
                  <h3 className="text-fg text-base font-light tracking-wide mb-0.5">{persona.name}</h3>
                  {persona.subtitle && (
                    <p className="text-neutral-500 text-[10px] tracking-widest uppercase">{persona.subtitle}</p>
                  )}

                  {/* 今月の数字プレビュー */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-baseline justify-between gap-2 group/num"
                      title={hasNumbers ? `収入 ¥${income.toLocaleString()} / 支出 ¥${expense.toLocaleString()} / 純 ${net >= 0 ? '+' : ''}¥${net.toLocaleString()}` : '今月の数字はまだ未計上'}
                    >
                      <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                        <span className="text-[10px] text-neutral-600">今月</span>
                        <span className="text-sm" style={{ color: hasNumbers ? '#86efac' : '#525252' }}>
                          {hasNumbers ? `+${fmtMan(income)}` : '—'}
                        </span>
                        <span className="text-[10px] text-neutral-700">/</span>
                        <span className="text-sm" style={{ color: hasNumbers ? '#fca5a5' : '#525252' }}>
                          {hasNumbers ? `-${fmtMan(expense)}` : '—'}
                        </span>
                      </div>
                      <span className="text-sm font-mono tabular-nums font-medium"
                        style={{ color: hasNumbers ? (net >= 0 ? persona.accentColor : '#fca5a5') : '#525252' }}>
                        {hasNumbers ? `純 ${fmtSigned(net)}` : ''}
                      </span>
                    </div>
                    {!hasNumbers && (
                      <p className="text-[10px] text-neutral-700 mt-1">数字を入れると AI が分析します</p>
                    )}
                  </div>

                  {/* CXO ミニアバター 3 つ */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center -space-x-1.5">
                      {cxos.map((role, j) => {
                        const meta = CXO_META[role];
                        const isWorking = isActiveCxoOwned && activeTask?.steps.some(s => s.cxo === role && s.status === 'working');
                        return (
                          <motion.div
                            key={role}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 relative"
                            style={{ background: `${meta.color}22`, borderColor: '#0a0a0f', zIndex: 3 - j }}
                            title={`${meta.name} — ${meta.tagline}`}
                            animate={isWorking ? { scale: [1, 1.18, 1] } : {}}
                            transition={isWorking ? { duration: 1.4, repeat: Infinity } : {}}
                          >
                            <span>{meta.emoji}</span>
                            {isWorking && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                                style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                            )}
                          </motion.div>
                        );
                      })}
                      <span className="ml-2.5 text-[10px] text-neutral-600">
                        {isActiveCxoOwned ? '実行中' : '待機中'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 rounded-full opacity-50"
                        style={{ background: persona.accentColor, width: `${Math.max(8, persona.timeAllocation * 0.5)}px`, maxWidth: '40px' }} />
                      <span className="text-neutral-600 text-[10px] font-mono">{persona.timeAllocation}%</span>
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                  style={{ color: persona.accentColor }}>
                  →
                </div>
              </motion.button>
            );
          })}

          {/* Add persona card — gradient + アニメ */}
          <motion.button
            onClick={onCreatePersona}
            className="relative text-left p-5 rounded-2xl cursor-pointer group overflow-hidden flex flex-col items-start justify-center min-h-[180px]"
            style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.08), rgba(167,139,250,0.05))', border: '2px dashed rgba(201,169,110,0.25)' }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + personas.length * 0.08, duration: 0.7 }}
            whileHover={{ scale: 1.02, borderColor: 'rgba(201,169,110,0.6)', y: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(201,169,110,0.18) 0%, transparent 70%)' }}
            />
            <motion.div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 font-light relative"
              style={{
                background: 'linear-gradient(135deg, #c9a96e, #a07840)',
                color: '#0a0a0f',
                boxShadow: '0 8px 24px -8px rgba(201,169,110,0.5)',
              }}
              animate={{ rotate: [0, 2, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              ＋
            </motion.div>
            <p className="text-fg text-sm font-medium mb-0.5">新しい人格を作る</p>
            <p className="text-neutral-500 text-xs">役割・事業ごとに分けて、AI に任せる</p>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl opacity-0 group-hover:opacity-60 transition-all"
              style={{ color: '#c9a96e' }}>→</span>
          </motion.button>
        </div>
      )}

      {/* フッター CTA — サンプルから始める (既存ペルソナあり版) */}
      {personas.length > 0 && personas.length < 4 && (
        <motion.div
          className="mt-8 relative z-10 flex flex-col items-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <p className="text-neutral-700 text-[10px] tracking-widest mb-2 uppercase">Or</p>
          <SampleDataCTA
            label="サンプル（カフェ経営）から始める"
            hint="本物データで全機能を試して、自分の業種に置き換えられます"
          />
        </motion.div>
      )}

      <motion.p className="text-neutral-700 text-xs mt-10 tracking-widest relative z-10 px-6 text-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
        {personas.length > 0 ? '全人格の統合俯瞰は「大観」から' : 'CORE Identity OS — あなたの全ての人格を統合する'}
      </motion.p>
    </motion.div>
  );
}
