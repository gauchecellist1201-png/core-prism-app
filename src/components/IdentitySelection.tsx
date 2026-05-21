import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import SampleDataCTA from './SampleDataCTA';
import StreakBadge from './StreakBadge';

interface Props {
  personas: Persona[];
  userName: string;
  onSelect: (id: string) => void;
  onCreatePersona: () => void;
}

export default function IdentitySelection({ personas, userName, onSelect, onCreatePersona }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';

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
      <motion.div className="text-center mb-12 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <p className="text-xs tracking-[0.3em] text-neutral-600 uppercase mb-3">CORE Identity OS</p>
        {userName ? (
          <h1 className="text-prism text-3xl font-extralight tracking-tight mb-2">
            {greeting}、{userName}さん。
          </h1>
        ) : (
          <h1 className="text-prism text-3xl font-extralight tracking-tight mb-2">
            今日は、誰として在りますか。
          </h1>
        )}
        <p className="text-neutral-600 text-sm font-light tracking-wider">
          人格を選択して、最適化された環境へ入る
        </p>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <StreakBadge accent="#A78BFA" brand="prism" />
        </div>
      </motion.div>

      {/* Persona grid */}
      {personas.length === 0 ? (
        <motion.div className="text-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-neutral-600 text-sm mb-6">最初の人格を作成しましょう</p>
          <motion.button
            onClick={onCreatePersona}
            className="px-8 py-3 rounded-full text-sm font-light"
            style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f', minHeight: 44 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ＋ 人格を作成する
          </motion.button>
          <div className="mt-5 flex flex-col items-center">
            <p className="text-neutral-600 text-xs mb-1">まだ何もないので、先に試したい方は</p>
            <SampleDataCTA hint="カフェ経営者のサンプルが入り、全機能をすぐ触れます (あとで消せます)" />
          </div>
        </motion.div>
      ) : (
        <div className={`grid gap-4 w-full relative z-10 px-8 ${
          personas.length <= 2 ? 'grid-cols-2 max-w-lg' :
          personas.length <= 4 ? 'grid-cols-2 max-w-2xl' :
          'grid-cols-3 max-w-3xl'
        }`}>
          {personas.map((persona, i) => (
            <motion.button
              key={persona.id}
              onClick={() => onSelect(persona.id)}
              className="relative group text-left p-5 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.7 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(ellipse at top left, ${persona.accentColorLight} 0%, transparent 60%)` }} />
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: `inset 0 0 0 1px ${persona.accentColor}30` }} />

              <div className="relative z-10">
                <div className="text-2xl mb-3 w-10 h-10 flex items-center justify-center rounded-xl"
                  style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                  {persona.icon}
                </div>
                <h3 className="text-fg text-base font-light tracking-wide mb-0.5">{persona.name}</h3>
                {persona.subtitle && (
                  <p className="text-neutral-500 text-xs tracking-widest uppercase">{persona.subtitle}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-0.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity"
                    style={{ background: persona.accentColor, width: `${persona.timeAllocation}%`, maxWidth: '60px' }} />
                  <span className="text-neutral-600 text-xs">{persona.timeAllocation}%</span>
                </div>
              </div>

              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                style={{ color: persona.accentColor }}>
                →
              </div>
            </motion.button>
          ))}

          {/* Add persona card */}
          <motion.button
            onClick={onCreatePersona}
            className="text-left p-5 rounded-2xl cursor-pointer group transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.01)', border: '2px dashed rgba(255,255,255,0.06)' }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + personas.length * 0.08, duration: 0.7 }}
            whileHover={{ scale: 1.01, borderColor: 'rgba(201,169,110,0.3)' }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 transition-colors"
              style={{ background: 'rgba(201,169,110,0.05)', color: 'rgba(201,169,110,0.3)' }}>
              ＋
            </div>
            <p className="text-neutral-700 text-sm font-light group-hover:text-neutral-500 transition-colors">人格を追加</p>
            <p className="text-neutral-800 text-xs mt-0.5">新しい役割・事業を作成</p>
          </motion.button>
        </div>
      )}

      <motion.p className="text-neutral-700 text-xs mt-10 tracking-widest relative z-10"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
        {personas.length > 0 ? '全人格の統合俯瞰は「大観」から' : 'CORE Identity OS — あなたの全ての人格を統合する'}
      </motion.p>
    </motion.div>
  );
}
