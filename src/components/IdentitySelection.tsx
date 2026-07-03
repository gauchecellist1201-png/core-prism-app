import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import SampleDataCTA from './SampleDataCTA';
import StreakBadge from './StreakBadge';
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

export default function IdentitySelection({ personas, userName, onSelect, onCreatePersona }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';

  // 各ペルソナの「未読ブリーフ」バッジ（実データのみ。飾りの数字は出さない）
  const personaBadges = useMemo(() => {
    const slot = getCurrentSlot();
    const map = new Map<string, number>();
    personas.forEach(p => {
      let unreadBrief = 0;
      if (slot) {
        const b = getTodayBrief(slot, p.id);
        if (b && !b.read && !b.dismissed) unreadBrief = 1;
      }
      map.set(p.id, unreadBrief);
    });
    return map;
  }, [personas]);

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
        <h1 className="text-prism text-3xl sm:text-4xl font-extralight tracking-tight mb-2">
          {userName ? `${greeting}、${userName}さん。` : personas.length === 0 ? 'ようこそ。' : '今日は、誰として在りますか。'}
        </h1>
        <p className="text-neutral-600 text-sm font-light tracking-wider">
          {personas.length === 0 ? '最初の人格を作って、AI 役員を味方につける' : '人格を選んで入る'}
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
            <p>2. AI 役員がその人格の数字と日々を見続ける</p>
            <p>3. 承認するだけで、仕事が進む</p>
          </div>
          <motion.button
            onClick={onCreatePersona}
            className="px-9 py-4 rounded-full text-sm font-medium relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f', minHeight: 52, boxShadow: '0 12px 36px -8px rgba(201,169,110,0.5)' }}
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
            const unreadBrief = personaBadges.get(persona.id) ?? 0;

            return (
              <motion.button
                key={persona.id}
                onClick={() => handleSelectWithTransition(persona)}
                className="relative text-left p-5 rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  boxShadow: '0 4px 20px -8px rgba(0,0,0,0.5)',
                  minHeight: 148,
                }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.7 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* 未読ブリーフ — 実データがある時だけ */}
                {unreadBrief > 0 && (
                  <span className="absolute top-3 right-3 z-20 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${persona.accentColor}22`, color: persona.accentColor }}>
                    ブリーフ {unreadBrief}
                  </span>
                )}

                <div className="relative z-10">
                  <div className="text-2xl mb-3 w-11 h-11 flex items-center justify-center rounded-xl"
                    style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                    {persona.icon}
                  </div>
                  <h3 className="text-fg text-base font-medium tracking-wide mb-0.5">{persona.name}</h3>
                  {persona.subtitle && (
                    <p className="text-neutral-500 text-[10px] tracking-widest uppercase">{persona.subtitle}</p>
                  )}

                  {/* 今月の純益 — このカードの主役数字 */}
                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-neutral-600">今月</span>
                    {hasNumbers ? (
                      <span className="font-mono tabular-nums text-lg font-semibold"
                        style={{ color: net >= 0 ? persona.accentColor : '#fca5a5' }}>
                        {fmtSigned(net)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-600">数字を入れると AI が分析</span>
                    )}
                  </div>
                  {hasNumbers && (
                    <div className="mt-1 flex items-baseline justify-end gap-2 font-mono tabular-nums text-[11px] text-neutral-500">
                      <span style={{ color: '#86efac' }}>+{fmtMan(income)}</span>
                      <span>/</span>
                      <span style={{ color: '#fca5a5' }}>-{fmtMan(expense)}</span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}

          {/* Add persona card */}
          <motion.button
            onClick={onCreatePersona}
            className="relative text-left p-5 rounded-2xl cursor-pointer overflow-hidden flex flex-col items-start justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(201,169,110,0.08), rgba(167,139,250,0.05))',
              boxShadow: '0 4px 20px -8px rgba(0,0,0,0.4)',
              minHeight: 148,
            }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + personas.length * 0.08, duration: 0.7 }}
            whileTap={{ scale: 0.97 }}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl mb-3 font-light"
              style={{
                background: 'linear-gradient(135deg, #c9a96e, #a07840)',
                color: '#0a0a0f',
                boxShadow: '0 8px 24px -8px rgba(201,169,110,0.5)',
              }}
            >
              ＋
            </div>
            <p className="text-fg text-sm font-medium mb-0.5">新しい人格を作る</p>
            <p className="text-neutral-500 text-xs">役割・事業ごとに分けて、AI に任せる</p>
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
          <SampleDataCTA
            label="サンプル（カフェ経営）から始める"
            hint="本物データで全機能を試して、自分の業種に置き換えられます"
          />
        </motion.div>
      )}
    </motion.div>
  );
}
