import { describe, it, expect } from 'vitest';
import {
  CORE_EVENTS,
  CORE_SITES,
  LEGACY_TO_CORE,
  coreFunnelCommands,
  isCoreEvent,
  isCoreSite,
} from '../_taxonomy';
import { ROAI_EVENTS } from '../roai';
import { STUDIO_EVENTS } from '../studio';

const CORE = new Set<string>(CORE_EVENTS);

describe('共通イベント辞書', () => {
  it('旧名の変換先は、すべて共通語彙にある（打ち間違いで黙って捨てられない）', () => {
    const bad = Object.entries(LEGACY_TO_CORE).filter(([, v]) => !CORE.has(v));
    expect(bad).toEqual([]);
  });

  it('変換表の旧名は、実際にどちらかのサーバー allowlist に存在する', () => {
    const known = new Set<string>([...ROAI_EVENTS, ...STUDIO_EVENTS]);
    const orphan = Object.keys(LEGACY_TO_CORE).filter(k => !known.has(k));
    expect(orphan).toEqual([]);
  });

  it('site / event の判定は allowlist どおり', () => {
    expect(isCoreSite('corp')).toBe(true);
    expect(isCoreSite('neri_lp')).toBe(true);
    expect(isCoreSite('unknown')).toBe(false);
    expect(isCoreEvent('pricing_view')).toBe(true);
    expect(isCoreEvent('studio_tab_view')).toBe(false);
  });

  it('サイトは重複なく定義されている', () => {
    expect(new Set(CORE_SITES).size).toBe(CORE_SITES.length);
    expect(new Set(CORE_EVENTS).size).toBe(CORE_EVENTS.length);
  });
});

describe('core:funnel へ積むコマンド', () => {
  const fields = (cmds: (string | number)[][]) =>
    cmds.filter(c => c[0] === 'HINCRBY').map(c => String(c[2]));

  it('共通語彙は サイト別 と 全社合計 の2本を立てる', () => {
    const cmds = coreFunnelCommands('neri_lp', 'pricing_view');
    expect(fields(cmds)).toEqual(['neri_lp:pricing_view', 'all:pricing_view']);
    expect(cmds.some(c => c[0] === 'EXPIRE')).toBe(true);
  });

  it('label があるときだけ内訳を足す', () => {
    expect(fields(coreFunnelCommands('studio', 'studio_estimate_step', '3')))
      .toEqual(['studio:estimate_step', 'all:estimate_step', 'studio:estimate_step:3']);
  });

  it('旧名は共通語彙へ変換してから積む', () => {
    expect(fields(coreFunnelCommands('corp', 'corp_page_view'))).toEqual(['corp:page_view', 'all:page_view']);
  });

  it('変換先が無い旧名は積まない（母数を水増ししない）', () => {
    // roai_step は「何問目か」の内部イベント。共通ファネルには対応する段が無い
    expect(coreFunnelCommands('corp', 'roai_step', 'q1')).toEqual([]);
  });

  it('知らない site は積まない', () => {
    expect(coreFunnelCommands('evil', 'page_view')).toEqual([]);
  });

  it('全部同じ日付キーを触る（1回のビーコンで2日に分かれない）', () => {
    const keys = new Set(coreFunnelCommands('corp', 'corp_cta_click', 'hero').map(c => String(c[1])));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toMatch(/^core:funnel:\d{4}-\d{2}-\d{2}$/);
  });
});
