import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MeetingType } from '../types/scheduling';
import { defaultRules } from '../lib/scheduling';

const KEY = 'core_meeting_types_v1';

function load(): MeetingType[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function save(arr: MeetingType[]) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function useMeetingTypes() {
  const [types, setTypes] = useState<MeetingType[]>(load);
  useEffect(() => { save(types); }, [types]);

  const create = useCallback((personaId: string, hostEmail: string, partial?: Partial<MeetingType>): MeetingType => {
    const t: MeetingType = {
      id: uuidv4(),
      personaId,
      hostEmail,
      name: partial?.name || '30分ミーティング',
      description: partial?.description || '',
      duration: (partial?.duration as MeetingType['duration']) || 30,
      location: partial?.location || 'google-meet',
      customLocation: partial?.customLocation,
      active: true,
      rules: partial?.rules || defaultRules(),
      createdAt: new Date().toISOString(),
      color: partial?.color,
    };
    setTypes(prev => [t, ...prev]);
    return t;
  }, []);

  const update = useCallback((id: string, patch: Partial<MeetingType>) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const remove = useCallback((id: string) => {
    setTypes(prev => prev.filter(t => t.id !== id));
  }, []);

  const getForPersona = useCallback((personaId: string) =>
    types.filter(t => t.personaId === personaId),
    [types]);

  return { types, create, update, remove, getForPersona };
}
