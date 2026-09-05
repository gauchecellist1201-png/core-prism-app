import { describe, it, expect } from 'vitest';
import {
  brandLabel,
  funnelFromCheckoutSession,
  funnelFromInvoice,
} from '../../_lib/coreFunnel';
import { coreFunnelCommands, isCoreSite } from '../../track/_taxonomy';

describe('Stripe → 全社ファネル', () => {
  it('billing は計測してよい発信元（ここが false だと黙って捨てられる）', () => {
    expect(isCoreSite('billing')).toBe(true);
    expect(coreFunnelCommands('billing', 'purchase', 'neri').length).toBeGreaterThan(0);
  });

  it('初回の請求は purchase、次の月からは renewal', () => {
    expect(funnelFromInvoice({ billing_reason: 'subscription_create', amount_paid: 39800 }))
      .toEqual({ event: 'purchase', label: '' });
    expect(funnelFromInvoice({ billing_reason: 'subscription_cycle', amount_paid: 39800 }))
      .toEqual({ event: 'renewal', label: '' });
    expect(funnelFromInvoice({ billing_reason: 'subscription_update', amount_paid: 12000 })?.event)
      .toBe('upgrade');
  });

  it('¥0 の請求は「買われた」ではない（無料お試しの開始を購入に数えない）', () => {
    expect(funnelFromInvoice({ billing_reason: 'subscription_create', amount_paid: 0 })).toBeNull();
    expect(funnelFromInvoice({ billing_reason: 'subscription_cycle' })).toBeNull();
  });

  it('知らない billing_reason は積まない（無理に寄せると母数が嘘になる）', () => {
    expect(funnelFromInvoice({ billing_reason: 'upcoming', amount_paid: 1000 })).toBeNull();
    expect(funnelFromInvoice(null)).toBeNull();
  });

  it('商品名は metadata → subscription_details → 明細の price の順に拾う', () => {
    expect(funnelFromInvoice({ billing_reason: 'subscription_cycle', amount_paid: 1, metadata: { brand: 'nexus' } })?.label)
      .toBe('neri');
    expect(funnelFromInvoice({
      billing_reason: 'subscription_cycle', amount_paid: 1,
      subscription_details: { metadata: { brand: 'prism' } },
    })?.label).toBe('prism');
    expect(funnelFromInvoice({
      billing_reason: 'subscription_cycle', amount_paid: 1,
      lines: { data: [{ price: { metadata: { brand: 'film' } } }] },
    })?.label).toBe('studio_film');
  });

  it('単発決済の完了だけ purchase。サブスクの checkout は積まない（invoice と二重になる）', () => {
    expect(funnelFromCheckoutSession({ mode: 'payment', payment_status: 'paid', amount_total: 55000, metadata: { brand: 'film' } }))
      .toEqual({ event: 'purchase', label: 'studio_film' });
    expect(funnelFromCheckoutSession({ mode: 'subscription', payment_status: 'paid', amount_total: 39800 })).toBeNull();
    expect(funnelFromCheckoutSession({ mode: 'payment', payment_status: 'unpaid', amount_total: 55000 })).toBeNull();
    expect(funnelFromCheckoutSession({ mode: 'payment', payment_status: 'paid', amount_total: 0 })).toBeNull();
  });

  it('brand ラベルは Redis のフィールドに使える形へ落ちる', () => {
    expect(brandLabel('  NEXUS ')).toBe('neri');
    expect(brandLabel('新商品 α')).toBe('');   // 使えない文字だけなら内訳を立てない
    expect(brandLabel(undefined)).toBe('');
  });
});
