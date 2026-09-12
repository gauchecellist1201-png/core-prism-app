import { describe, expect, it } from 'vitest';
import { COMPANY_OS_PACKAGES, OFFER_PRICES, studioEntry } from '../catalog';
import { FILM_PLANS } from '../../../studio/film';
describe('offer pricing contracts', () => {
 it('keeps the current checkout price and separates the future announcement', () => {
   const actual = FILM_PLANS.find(p => p.id === 'standard')!.priceYen;
   expect(studioEntry(new Date('2026-10-31T23:59:59+09:00')).gross).toBe(actual);
   expect(studioEntry(new Date('2026-11-01T00:00:00+09:00')).gross).toBe(actual);
   expect(studioEntry(new Date('2026-10-01')).note).toContain('改定予定');
 });
 it('does not charge Scan twice and exposes only three main offers', () => {
   expect(COMPANY_OS_PACKAGES.map(p=>p.id)).toEqual(['studio','growth','company']);
   expect(OFFER_PRICES.build-OFFER_PRICES.scan).toBe(1000000);
   expect(OFFER_PRICES.growth*3).toBe(900000);
 });
});
