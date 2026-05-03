import { useCallback, useEffect, useState } from 'react';
import type {
  MedicalProfile,
  ChronicCondition,
  Medication,
  Allergy,
  FamilyHistoryItem,
  VaccinationRecord,
} from '../types/health';

const KEY = 'core_phr_medical_v1';

const EMPTY: MedicalProfile = {
  conditions: [],
  medications: [],
  allergies: [],
  familyHistory: [],
  vaccinations: [],
};

function load(): MedicalProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}
function save(p: MedicalProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

export function useMedicalHistory() {
  const [profile, setProfile] = useState<MedicalProfile>(load);

  useEffect(() => {
    save(profile);
  }, [profile]);

  const update = useCallback((patch: Partial<MedicalProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  const addCondition = useCallback(
    (c: Omit<ChronicCondition, 'id'>) =>
      setProfile((p) => ({
        ...p,
        conditions: [...p.conditions, { ...c, id: crypto.randomUUID() }],
      })),
    []
  );
  const removeCondition = useCallback(
    (id: string) =>
      setProfile((p) => ({ ...p, conditions: p.conditions.filter((c) => c.id !== id) })),
    []
  );

  const addMedication = useCallback(
    (m: Omit<Medication, 'id'>) =>
      setProfile((p) => ({
        ...p,
        medications: [...p.medications, { ...m, id: crypto.randomUUID() }],
      })),
    []
  );
  const removeMedication = useCallback(
    (id: string) =>
      setProfile((p) => ({ ...p, medications: p.medications.filter((m) => m.id !== id) })),
    []
  );

  const addAllergy = useCallback(
    (a: Omit<Allergy, 'id'>) =>
      setProfile((p) => ({
        ...p,
        allergies: [...p.allergies, { ...a, id: crypto.randomUUID() }],
      })),
    []
  );
  const removeAllergy = useCallback(
    (id: string) =>
      setProfile((p) => ({ ...p, allergies: p.allergies.filter((a) => a.id !== id) })),
    []
  );

  const addFamily = useCallback(
    (f: Omit<FamilyHistoryItem, 'id'>) =>
      setProfile((p) => ({
        ...p,
        familyHistory: [...p.familyHistory, { ...f, id: crypto.randomUUID() }],
      })),
    []
  );
  const removeFamily = useCallback(
    (id: string) =>
      setProfile((p) => ({
        ...p,
        familyHistory: p.familyHistory.filter((f) => f.id !== id),
      })),
    []
  );

  const addVaccination = useCallback(
    (v: Omit<VaccinationRecord, 'id'>) =>
      setProfile((p) => ({
        ...p,
        vaccinations: [...p.vaccinations, { ...v, id: crypto.randomUUID() }],
      })),
    []
  );
  const removeVaccination = useCallback(
    (id: string) =>
      setProfile((p) => ({
        ...p,
        vaccinations: p.vaccinations.filter((v) => v.id !== id),
      })),
    []
  );

  return {
    profile,
    update,
    addCondition,
    removeCondition,
    addMedication,
    removeMedication,
    addAllergy,
    removeAllergy,
    addFamily,
    removeFamily,
    addVaccination,
    removeVaccination,
  };
}
