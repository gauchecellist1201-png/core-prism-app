import { describe, it, expect } from 'vitest';
import { validateLead } from '../roai/lead';

// /api/roai/lead の入力検証。クライアントのスコアは信用せず、回答だけを受けて再計算する前提。
const GOOD = {
  kind: 'consult',
  contact: { email: 'CEO@Example.co.jp', company: '株式会社テスト', name: '山田', phone: '090', message: 'x' },
  answers: { industry: 'it', employees: 'e3', revenue: 'r3', data_entry: 'h3', documents: 'w2', email: 'm2' },
  source: 'home-roai-band',
};

describe('validateLead', () => {
  it('accepts a good body and lowercases the email', () => {
    const v = validateLead(GOOD);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.kind).toBe('consult');
    expect(v.contact.email).toBe('ceo@example.co.jp');
    expect(Object.keys(v.answers).length).toBe(6);
    expect(v.honeypot).toBe(false);
    expect(v.source).toBe('home-roai-band');
  });
  it('rejects bad kind / bad email / too few answers / non-object', () => {
    expect(validateLead({ ...GOOD, kind: 'buy' })).toEqual({ ok: false, reason: 'invalid_kind' });
    expect(validateLead({ ...GOOD, contact: { email: 'nope' } })).toEqual({ ok: false, reason: 'invalid_email' });
    expect(validateLead({ ...GOOD, answers: { industry: 'it' } })).toEqual({ ok: false, reason: 'too_few_answers' });
    expect(validateLead(null)).toEqual({ ok: false, reason: 'invalid_body' });
    expect(validateLead('x')).toEqual({ ok: false, reason: 'invalid_body' });
  });
  it('drops unknown answers and marks honeypot', () => {
    const v = validateLead({ ...GOOD, answers: { ...GOOD.answers, evil: '<script>', employees: 'zzz' }, website: 'http://spam' });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.answers.evil).toBeUndefined();
    expect(v.answers.employees).toBeUndefined();
    expect(v.honeypot).toBe(true);
  });
  it('truncates long fields and sanitizes source', () => {
    const v = validateLead({ ...GOOD, contact: { ...GOOD.contact, message: 'a'.repeat(5000), company: 'b'.repeat(500) }, source: 'weird source!!/x' });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.contact.message.length).toBe(2000);
    expect(v.contact.company.length).toBe(120);
    expect(v.source).toBe('weird_source___x');
  });
});
