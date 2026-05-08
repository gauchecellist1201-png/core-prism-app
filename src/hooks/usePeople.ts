import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PersonRecord, PersonInteraction } from '../types/people';

const KEY_PEOPLE       = 'core_people_v1';
const KEY_INTERACTIONS = 'core_people_interactions_v1';

function load<T>(k: string, fb: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
}

export function usePeople() {
  const [people, setPeople] = useState<PersonRecord[]>(() => load<PersonRecord[]>(KEY_PEOPLE, []));
  const [interactions, setInteractions] = useState<PersonInteraction[]>(() => load<PersonInteraction[]>(KEY_INTERACTIONS, []));

  useEffect(() => save(KEY_PEOPLE, people), [people]);
  useEffect(() => save(KEY_INTERACTIONS, interactions), [interactions]);

  const upsertPerson = useCallback((p: PersonRecord) => {
    setPeople(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = p; return next;
      }
      return [p, ...prev];
    });
  }, []);

  const newPerson = useCallback((personaId: string, partial?: Partial<PersonRecord>): PersonRecord => {
    const p: PersonRecord = {
      id: uuidv4(),
      personaId,
      name: partial?.name || '',
      role: partial?.role,
      company: partial?.company,
      contactInfo: partial?.contactInfo,
      createdAt: new Date().toISOString(),
      notes: partial?.notes,
      tags: partial?.tags,
    };
    setPeople(prev => [p, ...prev]);
    return p;
  }, []);

  const removePerson = useCallback((id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setInteractions(prev => prev.filter(i => i.personId !== id));
  }, []);

  const addInteraction = useCallback((inter: Omit<PersonInteraction, 'id'>): PersonInteraction => {
    const full: PersonInteraction = { ...inter, id: uuidv4() };
    setInteractions(prev => [full, ...prev]);
    // update lastInteraction on person
    setPeople(prev => prev.map(p =>
      p.id === inter.personId
        ? { ...p, lastInteraction: inter.date > (p.lastInteraction || '') ? inter.date : p.lastInteraction }
        : p
    ));
    return full;
  }, []);

  const updateInteraction = useCallback((id: string, patch: Partial<PersonInteraction>) => {
    setInteractions(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const removeInteraction = useCallback((id: string) => {
    setInteractions(prev => prev.filter(i => i.id !== id));
  }, []);

  const getForPersona = useCallback((personaId: string) =>
    people.filter(p => p.personaId === personaId).sort((a, b) => {
      const la = a.lastInteraction || a.createdAt;
      const lb = b.lastInteraction || b.createdAt;
      return lb.localeCompare(la);
    }),
    [people]);

  const getInteractionsForPerson = useCallback((personId: string) =>
    interactions
      .filter(i => i.personId === personId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [interactions]);

  return {
    people, interactions,
    upsertPerson, newPerson, removePerson,
    addInteraction, updateInteraction, removeInteraction,
    getForPersona, getInteractionsForPerson,
  };
}
