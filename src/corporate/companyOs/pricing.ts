/** @deprecated v1 exploratory estimator. Not used by the v2 public offers. See catalog.ts for current scopes. */
/** Scope-based estimate in JPY, excluding tax. Coefficients are design assumptions. */
export interface PriceScope { employees: number; departments: number; agents: number; apis: number; sources: number; security: 'standard' | 'sso' | 'dedicated'; complexity: 'standard' | 'exceptions' | 'core' }
const security = { standard: 1, sso: 1.25, dedicated: 1.6 };
const complexity = { standard: 1, exceptions: 1.3, core: 1.6 };
export function estimateCompanyOs(s: PriceScope) {
  const counts = [s.employees, s.departments, s.agents, s.apis, s.sources];
  if (counts.some(v => !Number.isSafeInteger(v) || v < 0 || v > 100000) || s.employees < 1 || s.departments < 1 || !Object.hasOwn(security,s.security) || !Object.hasOwn(complexity,s.complexity)) return null;
  const base = 600000 + 400000*s.departments + 80000*s.agents + 120000*s.apis + 80000*s.sources + Math.max(0,s.employees-50)*2000;
  const low = Math.ceil(base * security[s.security] * complexity[s.complexity] / 10000)*10000;
  return { low, high: Math.ceil(low*1.5/10000)*10000, monthlyLow: Math.max(300000,s.departments*100000+s.agents*20000), basis: '設計係数による概算・税抜。API/SaaS従量、データ整備、広告費は別途。', enterprise: low >= 15000000 };
}
