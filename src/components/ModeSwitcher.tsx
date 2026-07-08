import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import PersonaGlyph from './PersonaGlyph';

interface Props {
  activeId: string;
  onSwitch: (id: string) => void;
  isTransitioning: boolean;
  personas?: Persona[];
}

// personas propを受け取る形に変更（外部から渡す）
export default function ModeSwitcher({ activeId, onSwitch, isTransitioning, personas = [] }: Props) {
  return (
    <div className="flex flex-col gap-1 py-1">
      {personas.map(persona => {
        const isActive = persona.id === activeId;
        return (
          <motion.button
            key={persona.id}
            onClick={() => !isTransitioning && onSwitch(persona.id)}
            className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-left group transition-all duration-200"
            style={{
              background: isActive ? persona.accentColorLight : 'transparent',
              cursor: isTransitioning ? 'not-allowed' : 'pointer',
            }}
            whileHover={!isActive && !isTransitioning ? { x: 3 } : {}}
            whileTap={!isTransitioning ? { scale: 0.97 } : {}}
          >
            {isActive && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                style={{ background: persona.accentColor }}
                layoutId="activeBar"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}

            <span
              className="text-sm w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-all duration-200"
              style={{
                background: isActive ? persona.accentColorLight : 'rgba(255,255,255,0.03)',
                color: isActive ? persona.accentColor : '#3a3a5a',
              }}
            >
              <PersonaGlyph icon={persona.icon} color={isActive ? persona.accentColor : '#3a3a5a'} size={16} />
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-light tracking-wide truncate transition-colors duration-200"
                style={{ color: isActive ? '#e8e4dc' : '#3a3a5a' }}>
                {persona.name}
              </p>
            </div>

            <span className="text-xs flex-shrink-0 transition-colors duration-200"
              style={{ color: isActive ? persona.accentColor : '#1a1a2a' }}>
              {persona.timeAllocation}%
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
