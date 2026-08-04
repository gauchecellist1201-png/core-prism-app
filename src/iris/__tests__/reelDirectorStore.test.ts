// リール監督モードの「消えない」保存と、カットへの参考素材(Bロール)割り当てを固定するテスト。
// 守りたいこと: ①壊れた保存で画面が落ちない ②復元しても割り当てが消えない
//               ③台本の素材案を勝手に増やさない ④書き出しに割り当てが必ず載る
import { describe, it, expect, beforeEach } from 'vitest';
import {
  scriptToProject, projectToShots, projectToCutSheet, applyTemplate,
  unassignedBroll, toggleCutBroll, REEL_TEMPLATES,
  type ReelProject,
} from '../reelDirector';
import {
  loadDirectorState, saveDirectorState, clearDirectorState, savedAtLabel,
} from '../reelDirectorStore';
import type { ProductionScript } from '../scriptStudio';

const KEY = 'iris_reel_director_v1';
const NOW = '2026-08-04T03:42:00.000Z';

const script = (): ProductionScript => ({
  title: '朝の3分ストレッチ',
  format: 'リール',
  durationSec: 20,
  hooks: ['肩こりの人へ'],
  shots: [
    { no: 1, time: '0-2秒', shot: '顔寄り', action: '話す', line: 'こんにちは', onScreenText: '結論から', editNote: 'ズームイン' },
    { no: 2, time: '2-6秒', shot: '全身引き', action: '動く', line: '', onScreenText: 'まず肩を回す', editNote: '' },
  ],
  broll: ['店の外観', '手元アップ', '  '],
  bgmMood: '明るい',
  thumbnailText: '3分',
  caption: '保存して見返してね',
  hashtags: ['#ストレッチ'],
  prep: [],
  shootingTips: [],
  generatedAt: '2026-08-04T03:00:00.000Z',
});

// node 環境なので最小の localStorage を用意する (保存層の分岐だけを見たいので実装は素朴で足りる)
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
beforeEach(() => {
  (globalThis as any).localStorage = new MemStorage();
});

describe('scriptToProject / broll プール', () => {
  it('台本の素材案だけをプールに入れ、空白は落とす（勝手に増やさない）', () => {
    const p = scriptToProject(script());
    expect(p.brollPool).toEqual(['店の外観', '手元アップ']);
    expect(p.cuts.every(c => c.broll.length === 0)).toBe(true);
  });

  it('未割り当ての素材案だけが候補に残る', () => {
    const p = scriptToProject(script());
    p.cuts[0].broll = ['店の外観'];
    expect(unassignedBroll(p)).toEqual(['手元アップ']);
  });
});

describe('toggleCutBroll', () => {
  it('同じ素材を二重に入れない・もう一度押すと外れる', () => {
    const c = scriptToProject(script()).cuts[0];
    const once = toggleCutBroll({ ...c, broll: [] }, '店の外観');
    expect(once).toEqual(['店の外観']);
    expect(toggleCutBroll({ ...c, broll: once }, '店の外観')).toEqual([]);
    expect(toggleCutBroll({ ...c, broll: once }, '  ')).toEqual(['店の外観']);
  });
});

describe('書き出しに割り当てが載る', () => {
  it('カット表にカットごとの参考素材と、未割り当ての残りが出る', () => {
    const p = scriptToProject(script());
    p.cuts[0].broll = ['店の外観'];
    const sheet = projectToCutSheet(p);
    expect(sheet).toContain('- 参考素材(Bロール): 店の外観');
    expect(sheet).toContain('まだどのカットにも割り当てていない参考素材');
    expect(sheet).toContain('- 手元アップ');
  });

  it('台本の shots へ書き戻すと編集メモに参考素材が入る', () => {
    const p = scriptToProject(script());
    p.cuts[0].broll = ['店の外観', '手元アップ'];
    const shots = projectToShots(p);
    expect(shots[0].editNote).toContain('参考素材: 店の外観、手元アップ');
    expect(shots[1].editNote).not.toContain('参考素材');
  });
});

describe('applyTemplate', () => {
  it('構成テンプレを当て直しても割り当て済みの素材は消えない', () => {
    const p = scriptToProject(script());
    p.cuts[0].broll = ['店の外観'];
    const out = applyTemplate(p.cuts, REEL_TEMPLATES[0]);
    expect(out[0].broll).toEqual(['店の外観']);
    expect(out.every(c => Array.isArray(c.broll))).toBe(true);
  });
});

describe('保存と復元', () => {
  const stateOf = (p: ReelProject) => ({
    scriptId: script().generatedAt, script: script(), project: p,
    telopStyleId: 'subtitle', topic: '肩こり',
  });

  it('保存したカット編集と割り当てがそのまま戻る', () => {
    const p = scriptToProject(script());
    p.cuts[0].broll = ['店の外観'];
    p.cuts[0].telop = '直した文字';
    expect(saveDirectorState(stateOf(p), NOW)).toBe(true);

    const back = loadDirectorState();
    expect(back?.scriptId).toBe(script().generatedAt);
    expect(back?.script.title).toBe('朝の3分ストレッチ');
    expect(back?.topic).toBe('肩こり');
    expect(back?.project.cuts[0].telop).toBe('直した文字');
    expect(back?.project.cuts[0].broll).toEqual(['店の外観']);
  });

  it('壊れた保存・古い版・カット0件は null（画面を落とさず台本から作り直す）', () => {
    localStorage.setItem(KEY, '{壊れたJSON');
    expect(loadDirectorState()).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ v: 999, scriptId: 'x', script: script(), project: scriptToProject(script()) }));
    expect(loadDirectorState()).toBeNull();

    const empty = { ...scriptToProject(script()), cuts: [] };
    saveDirectorState({ ...stateOf(empty) }, NOW);
    expect(loadDirectorState()).toBeNull();
  });

  it('broll が無い古い保存を読んでも落ちず、空配列で埋まる', () => {
    const p = scriptToProject(script());
    const legacy = {
      v: 1, scriptId: script().generatedAt, script: script(), telopStyleId: 'subtitle',
      topic: '肩こり', savedAt: NOW,
      project: { ...p, brollPool: undefined, cuts: p.cuts.map(({ broll: _b, ...rest }) => rest) },
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));
    const back = loadDirectorState();
    expect(back?.project.cuts[0].broll).toEqual([]);
    expect(back?.project.brollPool).toEqual(['店の外観', '手元アップ', '  ']);
  });

  it('消したら残らない', () => {
    saveDirectorState(stateOf(scriptToProject(script())), NOW);
    clearDirectorState();
    expect(loadDirectorState()).toBeNull();
  });
});

describe('savedAtLabel', () => {
  it('読めない時刻は推測せず空文字', () => {
    expect(savedAtLabel('こわれた')).toBe('');
    expect(savedAtLabel(NOW)).toMatch(/^\d+\/\d+ \d+:\d{2}$/);
  });
});
