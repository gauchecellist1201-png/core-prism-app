// ============================================================
// CORE PRISM OS — Personal Health Record (PHR) types
// ============================================================

export type HealthSourceId = 'apple-health' | 'oura' | 'whoop' | 'garmin' | 'manual' | 'fitbit';

export interface HealthSource {
  id: HealthSourceId;
  name: string;
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync: string | null; // ISO date
  recordsImported: number;
}

export interface DailyHealth {
  date: string; // YYYY-MM-DD
  // Sleep
  sleepHours: number;
  deepSleepMin: number;
  remSleepMin: number;
  sleepScore: number; // 0–100
  // Recovery
  hrv: number;          // ms
  restingHR: number;    // bpm
  recoveryScore: number;// 0–100
  // Activity
  steps: number;
  activeMinutes: number;
  exerciseKcal: number;
  // Mind / Stress
  stressLevel: number;  // 0–100 (higher = more stress)
  mindfulMinutes: number;
  // Nutrition
  hydrationL: number;
  caffeineMg: number;
  alcoholDrinks: number;
  // Optional / occasional
  weightKg?: number;
  bodyFatPct?: number;
  bp?: { sys: number; dia: number };
  glucoseMgDl?: number;
}

// PRISM 5-axis health spectrum (mapped to body systems)
export interface HealthSpectrum {
  sleep: number;     // ←→ Logic   (cognitive recovery)
  recovery: number;  // ←→ Empathy (parasympathetic)
  activity: number;  // ←→ Action  (movement)
  mind: number;      // ←→ Creative(mindfulness, focus)
  nutrition: number; // ←→ Ethics  (intake quality)
}

export interface HealthInsight {
  id: string;
  date: string;
  axis: keyof HealthSpectrum;
  severity: 'info' | 'caution' | 'alert' | 'celebrate';
  title: string;
  detail: string;
  personaId?: string; // tied to a persona context if relevant
}

export interface HealthGoal {
  id: string;
  personaId?: string;
  metric: keyof DailyHealth;
  target: number;
  comparator: 'gte' | 'lte';
  label: string;
}

// ── Medical History ──────────────────────────────────────────
export interface ChronicCondition {
  id: string;
  name: string;
  diagnosedYear?: number;
  status: 'active' | 'remission' | 'resolved';
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;       // e.g. "5mg"
  frequency: string;  // e.g. "1日1回 朝食後"
  prescribedBy?: string;
  startedDate?: string;
  notes?: string;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction: string;       // 蕁麻疹 / 呼吸困難 / アナフィラキシー など
  severity: 'mild' | 'moderate' | 'severe';
}

export interface FamilyHistoryItem {
  id: string;
  relation: '父' | '母' | '兄弟姉妹' | '祖父母' | 'その他';
  condition: string;
  ageOfOnset?: number;
}

export interface VaccinationRecord {
  id: string;
  vaccine: string;
  date: string;
  dose?: string;
}

export interface MedicalProfile {
  bloodType?: 'A' | 'B' | 'O' | 'AB';
  rhFactor?: '+' | '-';
  birthYear?: number;
  sex?: '男性' | '女性' | 'その他';
  heightCm?: number;
  conditions: ChronicCondition[];
  medications: Medication[];
  allergies: Allergy[];
  familyHistory: FamilyHistoryItem[];
  vaccinations: VaccinationRecord[];
  notes?: string;
}

// ── Symptom Check ────────────────────────────────────────────
export type BodyRegion =
  | '頭部' | '目' | '耳' | '鼻' | '口・喉' | '首・肩'
  | '胸部' | '腹部' | '背中・腰' | '四肢' | '皮膚' | '全身' | '精神';

export type SymptomSeverity = 'mild' | 'moderate' | 'severe';
export type SymptomDuration = 'minutes' | 'hours' | '1-3days' | 'week' | 'month' | 'longer';

export interface SymptomEntry {
  id: string;
  region: BodyRegion;
  description: string;
  severity: SymptomSeverity;
  duration: SymptomDuration;
  startedAt: string; // ISO
}

export type Urgency = 'self-care' | 'monitor' | 'gp-soon' | 'gp-today' | 'urgent-care' | 'er';

export interface DifferentialSuggestion {
  id: string;
  conditionName: string;     // 「逆流性食道炎」
  conditionNameEn?: string;  // 「GERD」
  likelihood: number;        // 0–100
  matchedSignals: string[];  // ["胸焼け", "夜間悪化", "高ストレス3日連続"]
  urgency: Urgency;
  selfCare?: string[];       // 「就寝3時間前の食事を避ける」
  whenToSeeDoctor?: string;  // 「2週間以上継続するなら消化器内科へ」
  category: '内科' | '消化器' | '循環器' | '呼吸器' | '皮膚' | '整形外科' | '精神' | '耳鼻咽喉' | '婦人科' | 'その他';
}

export interface SymptomAnalysis {
  id: string;
  createdAt: string;
  symptoms: SymptomEntry[];
  contextSummary: string;
  topUrgency: Urgency;
  differentials: DifferentialSuggestion[];
  habits: string[];               // 提案された生活習慣
  redFlags: string[];             // 「この症状があれば即受診」
  disclaimer: string;
}

