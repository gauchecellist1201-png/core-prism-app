import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Persona, Task } from '../types/identity';
import { useCloudSync } from './useCloudSync';
import { generateAvatarDataUrl } from '../lib/avatarGen';

const STORAGE_KEY = 'core_personas';
const ACTIVE_PERSONA_KEY = 'core_active_persona_id_v1';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 20) + '-' + uuidv4().slice(0, 6);
}

const ACCENT_PALETTE = [
  { color: '#4a9eff', light: 'rgba(74, 158, 255, 0.15)' },
  { color: '#c9a96e', light: 'rgba(201, 169, 110, 0.15)' },
  { color: '#a78bfa', light: 'rgba(167, 139, 250, 0.15)' },
  { color: '#34d399', light: 'rgba(52, 211, 153, 0.15)' },
  { color: '#f87171', light: 'rgba(248, 113, 113, 0.15)' },
  { color: '#fb923c', light: 'rgba(251, 146, 60, 0.15)' },
  { color: '#e879f9', light: 'rgba(232, 121, 249, 0.15)' },
  { color: '#2dd4bf', light: 'rgba(45, 212, 191, 0.15)' },
];

export function getNextAccentColor(personas: Persona[]) {
  return ACCENT_PALETTE[personas.length % ACCENT_PALETTE.length];
}

const ICON_OPTIONS = ['⚕', '⬡', '♩', '◎', '◈', '⬢', '✦', '◉', '⬛', '◆', '★', '⬤', '▲', '⊕'];

export { ICON_OPTIONS };

function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePersonas(personas: Persona[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
}

// ─── 同一タブ内 broadcaster (複数 usePersonas() 間で state を同期) ─────
const personaSubscribers = new Set<(p: Persona[]) => void>();
function broadcastPersonas(next: Persona[]) {
  personaSubscribers.forEach(fn => {
    try { fn(next); } catch { /* */ }
  });
}

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>(loadPersonas);
  const [activePersona, setActivePersona] = useState<Persona | null>(() => {
    // 初回マウント時、localStorage の active_persona_id があれば自動選択
    try {
      const savedId = localStorage.getItem(ACTIVE_PERSONA_KEY);
      if (!savedId) return null;
      const list = loadPersonas();
      return list.find(p => p.id === savedId) || null;
    } catch { return null; }
  });

  // localStorageに永続化 (オフラインキャッシュ) + 同一タブ broadcast
  useEffect(() => {
    savePersonas(personas);
    broadcastPersonas(personas);
  }, [personas]);

  // 他の usePersonas() インスタンス (TaskHub 等) からの更新を購読
  useEffect(() => {
    const sub = (next: Persona[]) => {
      // 参照が違うときだけ更新 (自分が起こした更新は無視される — JSON 比較は重いので長さ + 最後 id でざっくり判定)
      setPersonas(prev => {
        if (prev === next) return prev;
        if (prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    };
    personaSubscribers.add(sub);
    return () => { personaSubscribers.delete(sub); };
  }, []);

  // Supabase 同期 (未認証 / env 未設定なら no-op)
  useCloudSync({ key: STORAGE_KEY, value: personas, setValue: setPersonas, isEmpty: v => v.length === 0 });

  const createPersona = useCallback((
    name: string,
    subtitle: string,
    icon: string,
    description: string,
    accentColor: string,
    accentColorLight: string,
  ): Persona => {
    // TT (2026-06-03): 名前から決定的 SVG アバターを自動生成
    const avatarUrl: string | undefined = (() => {
      try { return generateAvatarDataUrl(name, 128); } catch { return undefined; }
    })();
    const persona: Persona = {
      id: uuidv4(),
      name,
      subtitle,
      icon,
      avatarUrl,
      description,
      accentColor,
      accentColorLight,
      createdAt: new Date().toISOString(),
      meetingSlug: generateSlug(name),
      tasks: [],
      cashflow: { income: 0, expense: 0, label: `${name}の収支` },
      timeAllocation: 0,
    };
    setPersonas(prev => {
      const next = [...prev, persona];
      // 時間配分を均等に再計算
      const equal = Math.floor(100 / next.length);
      return next.map((p, i) => ({
        ...p,
        timeAllocation: i === next.length - 1 ? 100 - equal * (next.length - 1) : equal,
      }));
    });
    return persona;
  }, []);

  const updatePersona = useCallback((id: string, updates: Partial<Persona>) => {
    setPersonas(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setActivePersona(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  }, []);

  const deletePersona = useCallback((id: string) => {
    setPersonas(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) return next;
      const equal = Math.floor(100 / next.length);
      return next.map((p, i) => ({
        ...p,
        timeAllocation: i === next.length - 1 ? 100 - equal * (next.length - 1) : equal,
      }));
    });
    if (activePersona?.id === id) setActivePersona(null);
  }, [activePersona]);

  const addTask = useCallback((personaId: string, task: Omit<Task, 'id' | 'personaId'>) => {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
      personaId,
      createdAt: task.createdAt ?? new Date().toISOString(),
    };
    setPersonas(prev => prev.map(p =>
      p.id === personaId ? { ...p, tasks: [...p.tasks, newTask] } : p
    ));
    return newTask;
  }, []);

  const toggleTask = useCallback((personaId: string, taskId: string) => {
    setPersonas(prev => prev.map(p =>
      p.id === personaId
        ? {
            ...p,
            tasks: p.tasks.map(t =>
              t.id === taskId
                ? {
                    ...t,
                    done: !t.done,
                    completedAt: !t.done ? new Date().toISOString() : undefined,
                  }
                : t
            ),
          }
        : p
    ));
  }, []);

  const updateTask = useCallback((personaId: string, taskId: string, updates: Partial<Task>) => {
    setPersonas(prev => prev.map(p =>
      p.id === personaId
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }
        : p
    ));
  }, []);

  const deleteTask = useCallback((personaId: string, taskId: string) => {
    setPersonas(prev => prev.map(p =>
      p.id === personaId
        ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
        : p
    ));
  }, []);

  const updateCashflow = useCallback((personaId: string, income: number, expense: number, label: string) => {
    setPersonas(prev => prev.map(p =>
      p.id === personaId ? { ...p, cashflow: { income, expense, label } } : p
    ));
  }, []);

  const selectPersona = useCallback((id: string) => {
    const persona = personas.find(p => p.id === id) ?? null;
    setActivePersona(persona);
    try {
      if (persona) localStorage.setItem(ACTIVE_PERSONA_KEY, persona.id);
      else localStorage.removeItem(ACTIVE_PERSONA_KEY);
    } catch { /* */ }
  }, [personas]);

  // activePersonaを最新状態に同期
  useEffect(() => {
    if (activePersona) {
      const latest = personas.find(p => p.id === activePersona.id);
      if (latest) setActivePersona(latest);
    }
  }, [personas]);

  return {
    personas,
    activePersona,
    createPersona,
    updatePersona,
    deletePersona,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    updateCashflow,
    selectPersona,
  };
}
