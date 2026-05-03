import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Persona, Task } from '../types/identity';

const STORAGE_KEY = 'core_personas';

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

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>(loadPersonas);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);

  // localStorageに永続化
  useEffect(() => {
    savePersonas(personas);
  }, [personas]);

  const createPersona = useCallback((
    name: string,
    subtitle: string,
    icon: string,
    description: string,
    accentColor: string,
    accentColorLight: string,
  ): Persona => {
    const persona: Persona = {
      id: uuidv4(),
      name,
      subtitle,
      icon,
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
    const newTask: Task = { ...task, id: uuidv4(), personaId };
    setPersonas(prev => prev.map(p =>
      p.id === personaId ? { ...p, tasks: [...p.tasks, newTask] } : p
    ));
  }, []);

  const toggleTask = useCallback((personaId: string, taskId: string) => {
    setPersonas(prev => prev.map(p =>
      p.id === personaId
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
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
    updateCashflow,
    selectPersona,
  };
}
