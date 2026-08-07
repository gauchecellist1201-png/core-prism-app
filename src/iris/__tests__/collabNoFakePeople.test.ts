// コラボ画面から「作り話」が戻ってこないことを固定するテスト。
//  1. 架空の 3 人 (@hana_cosme 他) の募集が二度と一覧に出ないこと
//  2. ジャンルの近さが乱数でなく、同じ入力なら必ず同じ答えになること
import { describe, it, expect } from 'vitest';
import {
  stripLegacySeedPosts,
  clearFabricatedPartners,
  computeCategoryFit,
  instagramTagUrl,
  FIT_META,
  type CollabPost,
  type CollabPlan,
} from '../IrisCollabBoard';

function plan(partnerHandle: string): CollabPlan {
  return {
    id: 'p', partnerHandle, partnerCategory: 'cosme', topic: 't', stage: 'candidate',
    createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z',
  };
}

function post(id: string, category: CollabPost['category']): CollabPost {
  return {
    id, authorHandle: '@me', category,
    title: 't', body: 'b', tags: [],
    reactions: {}, chats: [],
    createdAt: '2026-08-08T00:00:00.000Z',
  };
}

describe('旧版が書き込んだ架空の募集', () => {
  it('seed-1〜3 は読み込み時に取り除かれる', () => {
    const stored = [post('seed-1', 'cosme'), post('seed-2', 'travel'), post('seed-3', 'fashion')];
    expect(stripLegacySeedPosts(stored)).toEqual([]);
  });

  it('自分で書いた下書きは残る', () => {
    const mine = post('1754600000000', 'cosme');
    expect(stripLegacySeedPosts([post('seed-1', 'cosme'), mine])).toEqual([mine]);
  });
});

describe('旧版が計画に書き込んだ架空の相手', () => {
  it('@cosme_creator_1 のような作り物は相手を空に戻す', () => {
    expect(clearFabricatedPartners([plan('@cosme_creator_1')])[0].partnerHandle).toBe('');
    expect(clearFabricatedPartners([plan('@lifestyle_creator_4')])[0].partnerHandle).toBe('');
  });

  it('自分で入れた実在のアカウントは消さない', () => {
    for (const h of ['@hana', '@cosme_creator', '@my_creator_1', '@travel_creator_x']) {
      expect(clearFabricatedPartners([plan(h)])[0].partnerHandle).toBe(h);
    }
  });
});

describe('ジャンルの近さ', () => {
  it('同じ入力なら必ず同じ答え (乱数でない)', () => {
    const a = computeCategoryFit('cosme', 'cosme');
    for (let i = 0; i < 50; i++) {
      expect(computeCategoryFit('cosme', 'cosme')).toEqual(a);
    }
  });

  it('同じ / 近い / 別 を言葉で返し、根拠が必ず付く', () => {
    expect(computeCategoryFit('cosme', 'cosme').level).toBe('same');
    expect(computeCategoryFit('fashion', 'cosme').level).toBe('near');
    expect(computeCategoryFit('fitness', 'cosme').level).toBe('far');
    for (const c of ['cosme', 'fashion', 'fitness'] as const) {
      expect(computeCategoryFit(c, 'cosme').reason.length).toBeGreaterThan(0);
    }
  });

  it('自分のジャンル未設定なら「わからない」を返し、勝手に順位を付けない', () => {
    const fit = computeCategoryFit('cosme', '');
    expect(fit.level).toBe('unknown');
    expect(FIT_META.unknown.order).toBe(0);
  });

  it('近い順に並べると 同じ > 近い > 別 になる', () => {
    const order = (['same', 'near', 'far', 'unknown'] as const).map(l => FIT_META[l].order);
    expect(order).toEqual([3, 2, 1, 0]);
  });
});

describe('相手を探す導線', () => {
  it('実在する Instagram のタグ検索 URL を作る (# は落とす)', () => {
    expect(instagramTagUrl('#コスメ購入品'))
      .toBe('https://www.instagram.com/explore/tags/' + encodeURIComponent('コスメ購入品') + '/');
  });
});
