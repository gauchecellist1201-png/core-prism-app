import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadMediaKitDoc, saveMediaKitDoc, clearMediaKitDoc,
  isMediaKitDocStale, mediaKitFingerprint, madeAtLabel, hasNewerSavedDoc,
} from '../mediaKitStore';
import type { MediaKitDoc } from '../mediaKitDoc';
import type { MediaKit } from '../../types/influencerDeal';

// ============================================================
// mediaKitStore — 「作った資料が、戻ってきたときにそこに在る」ことの確認
//
// なぜこのテストが要るか:
//   メディアキットは企業に送る成果物そのもの。以前は画面の中だけに置かれ、
//   別のタブへ移った瞬間に消えていた（＝また AI の待ち時間が要る）。
//   ここでは「置ける・戻せる・壊れた保存データで嘘の在庫を見せない」を固定する。
// ============================================================

/** 最小の偽 localStorage（失敗させる版も作れる） */
function fakeStorage(opts: { failWrite?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.failWrite) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    _map: map,
  } as unknown as Storage & { _map: Map<string, string> };
}

const PERSONA = 'iris';

const DOC: MediaKitDoc = {
  tagline: '暮らしを整える人',
  intro: 'はじめまして。日々の暮らしを撮っています。',
  strengths: [{ title: '生活導線', detail: '毎日使うものを実際に使って伝えます' }],
  audience: '25-34歳の女性が中心です',
  whyCollab: '長く使ってもらえる商品の良さを、生活の中で伝えられます。',
  collabFormats: [{ title: 'リール', detail: '使う場面を30秒で' }],
  closing: 'お気軽にご相談ください。',
};

const KIT: MediaKit = {
  personaId: PERSONA,
  handleName: '@hanako',
  followers: { instagram: 12000 },
  avgEngagementRate: { instagram: 3.2 },
};

let store: ReturnType<typeof fakeStorage>;
const orig = (globalThis as { localStorage?: Storage }).localStorage;

beforeEach(() => {
  store = fakeStorage();
  (globalThis as { localStorage?: Storage }).localStorage = store;
});
afterEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = orig;
});

describe('mediaKitStore', () => {
  it('置いた資料を、そのまま戻せる', () => {
    const saved = saveMediaKitDoc(PERSONA, DOC, KIT, '2026-08-13T02:00:00.000Z');
    expect(saved).not.toBeNull();
    const back = loadMediaKitDoc(PERSONA);
    expect(back?.doc.intro).toBe(DOC.intro);
    expect(back?.doc.strengths[0].title).toBe('生活導線');
    expect(back?.createdAt).toBe('2026-08-13T02:00:00.000Z');
  });

  it('何も置いていなければ null（在庫があるふりをしない）', () => {
    expect(loadMediaKitDoc(PERSONA)).toBeNull();
  });

  it('壊れた JSON は null にする（画面を落とさない）', () => {
    store._map.set('core_iris_mediakit_doc_v1_' + PERSONA, '{壊れている');
    expect(loadMediaKitDoc(PERSONA)).toBeNull();
  });

  it('中身が空の資料は「作ってある」と言わない（白紙のPDFを送らせない）', () => {
    const empty: MediaKitDoc = { tagline: 'ひとこと', intro: '', strengths: [], audience: '', whyCollab: '', collabFormats: [], closing: '' };
    saveMediaKitDoc(PERSONA, empty, KIT);
    expect(loadMediaKitDoc(PERSONA)).toBeNull();
  });

  it('保存データの形が違っても、落ちずに使える形だけ通す', () => {
    store._map.set('core_iris_mediakit_doc_v1_' + PERSONA, JSON.stringify({
      doc: { intro: 'あります', strengths: 'ここは配列ではない', collabFormats: [{ title: 'リール' }, 'ごみ'] },
      createdAt: 12345,
    }));
    const back = loadMediaKitDoc(PERSONA);
    expect(back?.doc.intro).toBe('あります');
    expect(back?.doc.strengths).toEqual([]);
    expect(back?.doc.collabFormats).toEqual([{ title: 'リール', detail: '' }]);
    expect(back?.createdAt).toBe('');
  });

  it('端末に置けなかったら null を返す（置けたふりをしない）', () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage({ failWrite: true });
    expect(saveMediaKitDoc(PERSONA, DOC, KIT)).toBeNull();
  });

  it('localStorage が無い環境でも例外を投げない', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => loadMediaKitDoc(PERSONA)).not.toThrow();
    expect(saveMediaKitDoc(PERSONA, DOC, KIT)).toBeNull();
    expect(() => clearMediaKitDoc(PERSONA)).not.toThrow();
  });

  it('消したら戻らない', () => {
    saveMediaKitDoc(PERSONA, DOC, KIT);
    clearMediaKitDoc(PERSONA);
    expect(loadMediaKitDoc(PERSONA)).toBeNull();
  });
});

describe('古くなったかの判定', () => {
  it('フォロワー数が変わったら「作り直しませんか」と言える', () => {
    saveMediaKitDoc(PERSONA, DOC, KIT);
    const saved = loadMediaKitDoc(PERSONA);
    expect(isMediaKitDocStale(saved, KIT)).toBe(false);
    expect(isMediaKitDocStale(saved, { ...KIT, followers: { instagram: 15000 } })).toBe(true);
  });

  // 金額は文章を書くときの材料にも渡っている。値上げしたのに文中だけ古い金額、
  // という資料を企業に送らせないため、金額が変わったら作り直しを勧める。
  it('金額を直したら作り直しを勧める（文中に古い金額が残るため）', () => {
    saveMediaKitDoc(PERSONA, DOC, KIT);
    const saved = loadMediaKitDoc(PERSONA);
    expect(isMediaKitDocStale(saved, { ...KIT, rateCard: 'フィード ¥20,000' })).toBe(true);
  });

  it('指紋が無い古い保存データでは「古い」と決めつけない', () => {
    expect(isMediaKitDocStale({ doc: DOC, createdAt: '', fingerprint: '' }, KIT)).toBe(false);
  });

  it('数字が 0 や未入力でも指紋は安定する（並び順で揺れない）', () => {
    const a = mediaKitFingerprint({ personaId: PERSONA, followers: { instagram: 100, tiktok: 200 } });
    const b = mediaKitFingerprint({ personaId: PERSONA, followers: { tiktok: 200, instagram: 100, youtube: 0 } });
    expect(a).toBe(b);
  });
});

// 生成は数十秒かかる。途中で別のタブへ行き、戻って作り直すと、
// 先に始めた古い方が後から返ってくる。古い方に上書きさせない。
describe('作っている途中に別の生成が終わっていたとき', () => {
  it('自分より後に作られたものが在れば、上書きしない判断ができる', () => {
    saveMediaKitDoc(PERSONA, DOC, KIT, '2026-08-13T02:10:00.000Z');
    expect(hasNewerSavedDoc(PERSONA, '2026-08-13T02:00:00.000Z')).toBe(true);  // 02:00 に始めた古い生成
    expect(hasNewerSavedDoc(PERSONA, '2026-08-13T02:20:00.000Z')).toBe(false); // 02:20 に始めた新しい生成
  });
  it('何も置いていなければ false（上書きを止めない）', () => {
    expect(hasNewerSavedDoc(PERSONA, '2026-08-13T02:00:00.000Z')).toBe(false);
  });
  it('日時が壊れていたら false（根拠が無いのに止めない）', () => {
    saveMediaKitDoc(PERSONA, DOC, KIT, 'こわれた日時');
    expect(hasNewerSavedDoc(PERSONA, '2026-08-13T02:00:00.000Z')).toBe(false);
  });
});

describe('作った日の表示', () => {
  it('同じ年なら月日だけ', () => {
    expect(madeAtLabel('2026-08-13T02:00:00.000Z', new Date('2026-08-14T00:00:00.000Z')))
      .toMatch(/8月13日に作りました/);
  });
  it('年が違えば年も出す', () => {
    expect(madeAtLabel('2025-12-01T02:00:00.000Z', new Date('2026-01-05T00:00:00.000Z')))
      .toMatch(/^2025年12月1日に作りました$/);
  });
  it('日付が壊れていたら何も言わない', () => {
    expect(madeAtLabel('あした')).toBe('');
    expect(madeAtLabel('')).toBe('');
  });
});
