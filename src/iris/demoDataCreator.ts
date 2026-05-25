// ============================================================
// IRIS デモデータ — 架空クリエイター @hina_lifestyle (28 歳)
//
// オーナー指示 (2026-05-25 波 #4):
//   「Iris にも 12 ヶ月分のクリエイターストーリーで全機能を確認できるように」
//
// 嘘禁止のため:
//   - 数字は "(架空) デモ用" を comment に明記
//   - 実在ブランド名禁止 (「ABC コスメ」「Pure Skincare」のような架空名のみ)
//   - フォロワー 18,200 などはあくまでデモの目安
//
// 触らない方針:
//   - Prism 側の demoDataCafe.ts は既存通り
//   - 既存の hook の API (useInfluencerDesk / usePostQueue 等) は不変、
//     ここからは localStorage に書き込むだけで連動する
// ============================================================

import type { InfluencerDeal, DealStage } from '../types/influencerDeal';
import type { IgProfile } from './instagramConnect';
import type { FanContact, FanInteraction, FanTag } from './IrisFanEngagement';
import type { PostHistoryItem } from './strategist';
import type { ScheduledPost } from './usePostQueue';
import type { RevenueEntry, RevenueSource } from './IrisRevenueView';

export const DEMO_CREATOR_PID = 'demo:persona-hina';

// localStorage keys
const KEY_IG_PROFILE = 'core_iris_ig_profile_v1';
const KEY_DEMO_CONNECTED = 'core_iris_demo_connected';
const KEY_DEALS = 'core_inf_deals_v1';
const KEY_FANS = 'iris_fans_v1';
const KEY_POSTHISTORY = 'core_iris_posthistory_v1';
const KEY_POST_QUEUE = 'iris_post_queue_v1';
const KEY_REVENUE = 'iris_revenue_entries_v1';
const KEY_AGENT_QUEUE = 'core_agent_task_queue_v1';
const KEY_PERSONAS = 'core_personas';
const KEY_ACTIVE_PERSONA = 'core_active_persona_id_v1';
const KEY_MEDIA_KIT = 'core_inf_kit_' + DEMO_CREATOR_PID;

// ─── 日付ヘルパー ─────────────────────────────────
function monthsAgo(today: Date, m: number): Date {
  const d = new Date(today);
  d.setMonth(d.getMonth() - m);
  return d;
}
function daysAgo(today: Date, d: number): Date {
  const r = new Date(today);
  r.setDate(r.getDate() - d);
  return r;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isoDateTime(d: Date): string {
  return d.toISOString();
}
function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 配列を localStorage 上に書き込み、demo: プレフィクスのみ置き換える upsert */
function upsertArr<T extends { id: string }>(key: string, newItems: T[]): void {
  try {
    const raw = localStorage.getItem(key);
    const existing: T[] = raw ? JSON.parse(raw) : [];
    const cleaned = existing.filter(i => !String(i.id || '').startsWith('demo:'));
    localStorage.setItem(key, JSON.stringify([...newItems, ...cleaned]));
  } catch { /* quota */ }
}

// ─── A. Instagram プロフィール ──────────────────
export function buildIgProfile(nowIso: string): IgProfile {
  // (架空) デモ用 — 数字はあくまで目安
  return {
    handle: 'hina_lifestyle',
    followers: 18_200,
    avgLikes: 870,            // ER 4.8% × 18,200 ≒ 873
    avgComments: 52,
    topPostCategories: ['カフェ', 'コスメ', '旅行', 'ライフスタイル'],
    bestPostTime: '土 21:00',
    saveRate: 5.2,
    storyViewRate: 42,
    audienceAge: [
      { range: '18-24', pct: 28 },
      { range: '25-34', pct: 46 },
      { range: '35-44', pct: 18 },
      { range: '45+',   pct: 8 },
    ],
    audienceGender: { female: 78, male: 22, other: 0 },
    audienceTopCountries: [
      { country: '日本', pct: 92 },
      { country: '韓国', pct: 4 },
      { country: '台湾', pct: 2 },
    ],
    source: 'self',
    connectedAt: nowIso,
    updatedAt: nowIso,
  };
}

// ─── B. 案件 (Deals) — 月別 + ステージ混在 12 件 ────
export function buildCreatorDeals(today: Date, nowIso: string): InfluencerDeal[] {
  const mkDeal = (
    idx: number,
    over: Partial<InfluencerDeal> & {
      brandName: string;
      stage: DealStage;
      fee: number;
      monthsAgoStart: number;
      productName?: string;
      contactName?: string;
      deliverables: string;
      notes: string;
    },
  ): InfluencerDeal => {
    const start = monthsAgo(today, over.monthsAgoStart);
    const { monthsAgoStart: _msa, ...rest } = over;
    return {
      id: `demo:iris-deal-${idx}`,
      personaId: DEMO_CREATOR_PID,
      platform: 'instagram',
      contentType: 'post',
      createdAt: isoDateTime(start),
      updatedAt: nowIso,
      ...rest,
    } as InfluencerDeal;
  };

  return [
    // ── closed (実績) ────────────────────────
    mkDeal(1, {
      brandName: 'ABCコスメ',
      productName: '春の新作リップ「Bloom Rose」',
      stage: 'closed',
      fee: 80_000,
      monthsAgoStart: 3,
      contentType: 'post',
      contactName: '田村 さくら',
      deliverables: 'フィード投稿 1 本 + ストーリー 2 枚',
      notes: '春のリップ新作 PR。色味の見せ方を工夫したリールが好評。再オファー打診あり。',
      postedDate: isoDate(monthsAgo(today, 2)),
      updatedAt: isoDateTime(monthsAgo(today, 2)),
    }),
    mkDeal(2, {
      brandName: 'Cafe Aoyama',
      productName: 'オープン記念リール',
      stage: 'closed',
      fee: 50_000,
      monthsAgoStart: 2,
      contentType: 'reel',
      contactName: '青山 健',
      deliverables: 'リール 1 本 (15 秒)',
      notes: 'カフェオープン日に投稿。ER 6.2% と平均より高め。',
      postedDate: isoDate(monthsAgo(today, 1)),
      updatedAt: isoDateTime(monthsAgo(today, 1)),
    }),
    mkDeal(3, {
      brandName: 'Travel Style Japan',
      productName: '京都・桜咲く 2 泊 3 日企画',
      stage: 'closed',
      fee: 120_000,
      monthsAgoStart: 2,
      contentType: 'reel',
      contactName: '岡田 真理',
      deliverables: 'リール 2 本 + フィード 3 本 + ストーリー 5 枚',
      notes: '京都ロケ旅 PR。保存数が過去最高。二次利用料 +20k で交渉成立。',
      usageFee: 20_000,
      postedDate: isoDate(monthsAgo(today, 1)),
      updatedAt: isoDateTime(monthsAgo(today, 1)),
    }),
    mkDeal(4, {
      brandName: 'Hand-made Jewelry Studio',
      productName: '着用 PR (春コレクション)',
      stage: 'closed',
      fee: 35_000,
      monthsAgoStart: 5,
      contentType: 'post',
      contactName: '鈴木 ひかり',
      deliverables: 'フィード投稿 2 本',
      notes: '小規模ハンドメイドブランド。長期で関係を続けたい相手。',
      postedDate: isoDate(monthsAgo(today, 4)),
      updatedAt: isoDateTime(monthsAgo(today, 4)),
    }),
    mkDeal(5, {
      brandName: 'Wellness Retreat 山中湖',
      productName: '招待付きレビュー (1 泊体験)',
      stage: 'closed',
      fee: 60_000,
      monthsAgoStart: 4,
      contentType: 'reel',
      contactName: '山中 由美',
      deliverables: 'リール 1 本 + フィード 1 本 + ストーリー 3 枚',
      notes: 'リトリート施設の招待付き。宿泊 + 食事込みで実質 +¥40k 相当。',
      postedDate: isoDate(monthsAgo(today, 3)),
      updatedAt: isoDateTime(monthsAgo(today, 3)),
    }),
    mkDeal(6, {
      brandName: 'Beauty Box Subscription',
      productName: '5 月号レビュー',
      stage: 'closed',
      fee: 45_000,
      monthsAgoStart: 1,
      contentType: 'reel',
      contactName: '北野 葵',
      deliverables: 'リール 1 本 + ストーリー 2 枚',
      notes: '月額サブスク BOX のアンボックス系コンテンツ。Save 率高め。',
      postedDate: isoDate(daysAgo(today, 18)),
      updatedAt: isoDateTime(daysAgo(today, 18)),
    }),
    // ── active (進行中・契約済み) ────────────────
    mkDeal(7, {
      brandName: 'Wellness Tea Co.',
      productName: '月額アンバサダー契約 (6 ヶ月)',
      stage: 'posted',
      fee: 40_000,
      monthsAgoStart: 3,
      contentType: 'post',
      contactName: '小山 雅子',
      deliverables: '月 1 フィード + ストーリー 2 枚 / 6 ヶ月',
      notes: '月額 ¥40,000 × 6 ヶ月 = ¥240,000 の長期契約。残り 3 ヶ月。',
      postedDate: isoDate(daysAgo(today, 6)),
      updatedAt: isoDateTime(daysAgo(today, 6)),
    }),
    mkDeal(8, {
      brandName: 'Pure Skincare',
      productName: '限定キャンペーン PR',
      stage: 'drafting',
      fee: 150_000,
      monthsAgoStart: 0,
      contentType: 'reel',
      contactName: '佐藤 美香',
      deliverables: 'リール 1 本 + フィード 2 本 + ストーリー 5 枚',
      notes: '今月最大の案件 ¥150k。下書き提出 5/30 締切 — あと数日。',
      draftDeadline: isoDateTime(daysAgo(today, -5)),
      postDeadline: isoDateTime(daysAgo(today, -10)),
      updatedAt: isoDateTime(daysAgo(today, 1)),
    }),
    // ── negotiating ────────────────────────
    mkDeal(9, {
      brandName: 'Local Bakery Brand',
      productName: '雑誌コラボ企画',
      stage: 'negotiating',
      fee: 90_000,
      monthsAgoStart: 0,
      contentType: 'post',
      contactName: '小麦 健太',
      deliverables: 'フィード 2 本 + 雑誌掲載 (写真提供)',
      notes: '雑誌掲載込みで露出大。報酬は提示済 ¥90k で先方検討中。',
      updatedAt: isoDateTime(daysAgo(today, 2)),
    }),
    mkDeal(10, {
      brandName: 'Eco Fashion JP',
      productName: 'サステナビリティ企画 (大型)',
      stage: 'negotiating',
      fee: 200_000,
      monthsAgoStart: 0,
      contentType: 'reel',
      contactName: '森田 玲奈',
      deliverables: 'リール 3 本 + フィード 5 本 + ストーリー 10 枚 (3 ヶ月キャンペーン)',
      notes: '最大案件候補 ¥200k。サステナビリティ系で世界観もマッチ。条件詰め中。',
      updatedAt: isoDateTime(daysAgo(today, 4)),
    }),
    // ── pending (打診あり、相手確認中) ─────────────
    mkDeal(11, {
      brandName: 'Spa Resort Hakone',
      productName: '1 泊滞在 PR',
      stage: 'inquiry',
      fee: 180_000,
      monthsAgoStart: 0,
      contentType: 'reel',
      contactName: '箱根 由佳',
      deliverables: 'リール 1 本 + フィード 2 本 + ストーリー 5 枚 (1 泊招待付き)',
      notes: 'ホテル側の社内承認待ち。返事は週末予定。',
      updatedAt: isoDateTime(daysAgo(today, 3)),
    }),
    // ── declined (失注) ──────────────────────
    mkDeal(12, {
      brandName: 'Vintage Camera Shop',
      productName: '写真投稿コラボ',
      stage: 'declined',
      fee: 30_000,
      monthsAgoStart: 1,
      contentType: 'post',
      contactName: '小川 健司',
      deliverables: 'フィード 1 本',
      notes: '価格折り合わず。提示 ¥30k → こちら希望 ¥50k で離脱。良好な関係は維持。',
      updatedAt: isoDateTime(monthsAgo(today, 1)),
    }),
  ];
}

// ─── C. ファン (Fans) — 15 名 ──────────────────
export function buildCreatorFans(today: Date, nowIso: string): FanContact[] {
  const mkInteraction = (
    id: string,
    type: FanInteraction['type'],
    content: string,
    daysOld: number,
    myReply?: string,
  ): FanInteraction => ({
    id,
    type,
    content,
    date: isoDate(daysAgo(today, daysOld)),
    myReply,
  });

  const mkFan = (
    suffix: string,
    over: Partial<FanContact> & {
      name: string;
      handle: string;
      tag: FanTag;
      topics: string[];
      notes: string;
      interactions: FanInteraction[];
      relationSinceMonths: number;
    },
  ): FanContact => ({
    id: `demo:iris-fan-${suffix}`,
    name: over.name,
    handle: over.handle,
    platform: 'Instagram',
    relationSince: ym(monthsAgo(today, over.relationSinceMonths)),
    tag: over.tag,
    topics: over.topics,
    notes: over.notes,
    interactions: over.interactions,
    createdAt: isoDateTime(monthsAgo(today, over.relationSinceMonths)),
    updatedAt: nowIso,
  });

  return [
    // ── スーパーファン (1 年以上、頻繁な DM) 4 名 ──
    mkFan('super-1', {
      name: 'みなみ',
      handle: '@minami_pink',
      tag: 'スーパーファン',
      topics: ['コスメ', 'リップ', 'スキンケア'],
      notes: '初期からのファン。リップ紹介投稿は必ず反応。誕生日 7/15。',
      relationSinceMonths: 14,
      interactions: [
        mkInteraction('demo:int-s1-1', 'dm', 'ひなさんの春リップ紹介、参考になりました！実際に買いました🌸', 3, 'うれしい〜！色めっちゃ似合うと思う！'),
        mkInteraction('demo:int-s1-2', 'comment', '可愛すぎる😭✨', 8),
        mkInteraction('demo:int-s1-3', 'dm', '最近のメイク記事すごい良かった！もっとやって', 15, 'ありがとう！来週もう一本書きます'),
        mkInteraction('demo:int-s1-4', 'dm', 'ひなさんのおすすめスキンケア、肌綺麗になりました！', 32),
      ],
    }),
    mkFan('super-2', {
      name: 'あや',
      handle: '@aya_morning',
      tag: 'スーパーファン',
      topics: ['カフェ', '朝活', '読書'],
      notes: '朝活仲間。毎週カフェ投稿に反応。一度オフ会で会った。',
      relationSinceMonths: 18,
      interactions: [
        mkInteraction('demo:int-s2-1', 'dm', '昨日のカフェ、私も行ってきました！教えてくれてありがと', 5, 'おぉ！どうでした？'),
        mkInteraction('demo:int-s2-2', 'comment', 'モーニング最高ですね☀', 12),
        mkInteraction('demo:int-s2-3', 'dm', '次のカフェ会、いつ予定ですか？', 20, '6月入ってからまた告知しますね！'),
        mkInteraction('demo:int-s2-4', 'reply', 'コーヒーの淹れ方、参考になりました', 28),
        mkInteraction('demo:int-s2-5', 'dm', 'いつもありがとうございます。', 50),
      ],
    }),
    mkFan('super-3', {
      name: 'ゆうこ',
      handle: '@yuko_travel',
      tag: 'スーパーファン',
      topics: ['旅行', '京都', '温泉'],
      notes: '京都旅企画から繋がった。同年代。旅好き同士で話が合う。',
      relationSinceMonths: 12,
      interactions: [
        mkInteraction('demo:int-s3-1', 'dm', '京都のお店、私も行きました！想像以上に良かったです🌸', 7, 'ですよね！あの抹茶パフェ最高でした'),
        mkInteraction('demo:int-s3-2', 'comment', '景色綺麗すぎる🏔', 14),
        mkInteraction('demo:int-s3-3', 'dm', '次はどこ行く予定ですか？', 22, '夏は箱根温泉考えてます'),
        mkInteraction('demo:int-s3-4', 'dm', 'おすすめの温泉宿、教えてください！', 40),
      ],
    }),
    mkFan('super-4', {
      name: 'りな',
      handle: '@rina_books',
      tag: 'スーパーファン',
      topics: ['読書', 'ライフスタイル', 'カフェ'],
      notes: '本の話題で盛り上がる。コメント率高い。',
      relationSinceMonths: 13,
      interactions: [
        mkInteraction('demo:int-s4-1', 'dm', 'おすすめの本、読み終わりました！面白かった', 4, 'よかった〜！次は何読む？'),
        mkInteraction('demo:int-s4-2', 'comment', 'この本、私も気になってました', 11),
        mkInteraction('demo:int-s4-3', 'reply', '読書スポット紹介、めっちゃ好き', 18),
      ],
    }),
    // ── 長期ファン (3 ヶ月以上) 5 名 ──
    mkFan('long-1', {
      name: 'まい',
      handle: '@mai_skincare',
      tag: '長期ファン',
      topics: ['スキンケア', '美容'],
      notes: 'スキンケア系の投稿に必ず反応。25 歳・OL。',
      relationSinceMonths: 6,
      interactions: [
        mkInteraction('demo:int-l1-1', 'dm', '最近のスキンケア紹介、すごく参考になります', 6, 'ありがとう！何か試してみた？'),
        mkInteraction('demo:int-l1-2', 'comment', '欲しくなる〜', 14),
      ],
    }),
    mkFan('long-2', {
      name: 'のぞみ',
      handle: '@nozomi_makeup',
      tag: '長期ファン',
      topics: ['コスメ', 'メイク'],
      notes: 'メイク動画の保存率が高い。質問 DM もたまにくる。',
      relationSinceMonths: 5,
      interactions: [
        mkInteraction('demo:int-l2-1', 'dm', 'チークの位置、こうですか？', 9, 'バッチリです！上手〜'),
        mkInteraction('demo:int-l2-2', 'comment', 'メイク手順、待ってました', 17),
      ],
    }),
    mkFan('long-3', {
      name: 'えり',
      handle: '@eri_morning',
      tag: '長期ファン',
      topics: ['朝食', 'ライフスタイル'],
      notes: '朝食投稿のファン。料理上手っぽい。',
      relationSinceMonths: 4,
      interactions: [
        mkInteraction('demo:int-l3-1', 'comment', 'これ作ってみます！', 8),
        mkInteraction('demo:int-l3-2', 'dm', 'グラノーラのレシピ、教えてください！', 20, 'はい！明日の投稿でアップしますね'),
      ],
    }),
    mkFan('long-4', {
      name: 'ななこ',
      handle: '@nanako_cafe',
      tag: '長期ファン',
      topics: ['カフェ', 'スイーツ'],
      notes: 'カフェ巡り仲間。東京住み。',
      relationSinceMonths: 7,
      interactions: [
        mkInteraction('demo:int-l4-1', 'dm', 'このカフェ、近いんで行ってみます', 11),
        mkInteraction('demo:int-l4-2', 'comment', 'スイーツ可愛い🍰', 19),
        mkInteraction('demo:int-l4-3', 'reply', '一緒にカフェ会したいです！', 35),
      ],
    }),
    mkFan('long-5', {
      name: 'みき',
      handle: '@miki_lifestyle',
      tag: '長期ファン',
      topics: ['ライフスタイル', 'インテリア'],
      notes: 'インテリア系の投稿に反応。同年代。',
      relationSinceMonths: 5,
      interactions: [
        mkInteraction('demo:int-l5-1', 'comment', 'このソファ、どこのですか？', 12, '@interior_brand のものです！'),
      ],
    }),
    // ── 新規 (直近 1 ヶ月) 4 名 ──
    mkFan('new-1', {
      name: 'さき',
      handle: '@saki_new_cosme',
      tag: '新規',
      topics: ['コスメ'],
      notes: '春のリップ投稿でフォロー開始。',
      relationSinceMonths: 1,
      interactions: [
        mkInteraction('demo:int-n1-1', 'dm', 'はじめまして！リップの色めっちゃ可愛いです', 4, 'はじめまして〜！ありがとうございます'),
      ],
    }),
    mkFan('new-2', {
      name: 'はる',
      handle: '@haru_travel_dream',
      tag: '新規',
      topics: ['旅行', '京都'],
      notes: '京都リール投稿でフォロー。',
      relationSinceMonths: 1,
      interactions: [
        mkInteraction('demo:int-n2-1', 'comment', '行ってみたい〜！', 7),
      ],
    }),
    mkFan('new-3', {
      name: 'ゆい',
      handle: '@yui_morning_coffee',
      tag: '新規',
      topics: ['カフェ', '朝活'],
      notes: '朝のコーヒー投稿でフォロー。',
      relationSinceMonths: 0,
      interactions: [
        mkInteraction('demo:int-n3-1', 'comment', '同じカフェ、私も好きです', 2),
      ],
    }),
    mkFan('new-4', {
      name: 'もえ',
      handle: '@moe_24_skincare',
      tag: '新規',
      topics: ['スキンケア', '美容'],
      notes: 'スキンケア投稿でフォロー。',
      relationSinceMonths: 0,
      interactions: [
        mkInteraction('demo:int-n4-1', 'dm', 'おすすめスキンケア紹介、待ってます！', 1),
      ],
    }),
    // ── 個人的友人 (元同級生など) 2 名 ──
    mkFan('friend-1', {
      name: 'さやか (中学の友達)',
      handle: '@sayaka_real',
      tag: '個人的友人',
      topics: ['プライベート', '近況'],
      notes: '中学の同級生。たまに DM で近況やり取り。',
      relationSinceMonths: 24,
      interactions: [
        mkInteraction('demo:int-f1-1', 'dm', '最近インスタすごいね〜！活躍してて嬉しい', 10, 'ありがと〜！会いたいね'),
        mkInteraction('demo:int-f1-2', 'dm', '今度ご飯行こうよ', 25),
      ],
    }),
    mkFan('friend-2', {
      name: 'けいこ (大学の親友)',
      handle: '@keiko_uni',
      tag: '個人的友人',
      topics: ['プライベート', '相談'],
      notes: '大学の親友。投稿のフィードバックをくれる。',
      relationSinceMonths: 36,
      interactions: [
        mkInteraction('demo:int-f2-1', 'dm', '昨日の投稿、めっちゃ綺麗だった！', 6, 'ありがとう！色々試してます'),
        mkInteraction('demo:int-f2-2', 'dm', 'お疲れさま〜次の旅行どこ？', 18),
      ],
    }),
  ];
}

// ─── D. 投稿履歴 (PostHistoryItem) 30 件 ──────────────
export function buildPostHistory(today: Date): PostHistoryItem[] {
  type PostKind = 'reel' | 'post' | 'story';
  type Tpl = {
    title: string;
    topic: string;
    kind: PostKind;
    tags: string[];
    caption?: string;
    notes?: string;
    brand?: string;
  };

  // テンプレ (バリエーション)
  const reels: Tpl[] = [
    { title: '朝のコーヒー時間 vlog', topic: 'カフェ', kind: 'reel', tags: ['#コーヒー', '#朝活', '#ライフスタイル'], caption: '朝のコーヒー時間。今日のカップは…' },
    { title: '15 秒で完成するリップメイク', topic: 'コスメ', kind: 'reel', tags: ['#リップ', '#メイク', '#コスメ好き'], caption: '色味で印象が変わる！' },
    { title: '京都 桜の名所 5 選', topic: '旅行', kind: 'reel', tags: ['#京都', '#桜', '#旅行'], caption: '今年の桜は格別…' },
    { title: '春の新作リップ全色レビュー', topic: 'コスメ', kind: 'reel', tags: ['#リップ', '#新作', '#PR'], caption: 'ABCコスメの春の新作、全色紹介します🌸', brand: 'ABCコスメ' },
    { title: 'Cafe Aoyama オープン日リポート', topic: 'カフェ', kind: 'reel', tags: ['#カフェ', '#オープン', '#PR'], caption: '青山にオープンしたあの…', brand: 'Cafe Aoyama' },
    { title: 'カフェ巡り 5 軒一気に紹介', topic: 'カフェ', kind: 'reel', tags: ['#カフェ巡り', '#東京カフェ'], caption: '今週行ったカフェまとめ' },
    { title: 'メイク手順 朝〜夜まで', topic: 'コスメ', kind: 'reel', tags: ['#メイク', '#手順'], caption: '朝と夜でちょっと変える' },
    { title: '京都 抹茶パフェ食べ歩き', topic: '旅行', kind: 'reel', tags: ['#京都', '#抹茶', '#食べ歩き'], caption: '抹茶尽くしの一日' },
    { title: 'Wellness Retreat 山中湖 滞在記', topic: 'ライフスタイル', kind: 'reel', tags: ['#リトリート', '#PR'], caption: '心が満たされる時間…', brand: 'Wellness Retreat 山中湖' },
    { title: 'Beauty Box 5 月号アンボックス', topic: 'コスメ', kind: 'reel', tags: ['#コスメ', '#サブスク', '#PR'], caption: '今月の Beauty Box 開けます', brand: 'Beauty Box Subscription' },
  ];

  const posts: Tpl[] = [
    { title: '今朝の朝食 — グラノーラとフルーツ', topic: 'ライフスタイル', kind: 'post', tags: ['#朝食', '#朝活'] },
    { title: '春のコスメフラットレイ', topic: 'コスメ', kind: 'post', tags: ['#コスメ', '#フラットレイ'] },
    { title: '東京 桜の通り道', topic: 'ライフスタイル', kind: 'post', tags: ['#桜', '#東京'] },
    { title: '青山のカフェで読書時間', topic: 'カフェ', kind: 'post', tags: ['#カフェ', '#読書'] },
    { title: 'お気に入りスキンケア 5 点', topic: 'コスメ', kind: 'post', tags: ['#スキンケア', '#コスメ'] },
    { title: '京都の朝 — 鴨川沿いを散歩', topic: '旅行', kind: 'post', tags: ['#京都', '#散歩'] },
    { title: 'Hand-made Jewelry 着用 PR', topic: 'ライフスタイル', kind: 'post', tags: ['#ジュエリー', '#PR'], brand: 'Hand-made Jewelry Studio' },
    { title: 'Hand-made Jewelry 着用 PR — その 2', topic: 'ライフスタイル', kind: 'post', tags: ['#ジュエリー', '#PR'], brand: 'Hand-made Jewelry Studio' },
    { title: '春のリップ — お気に入りの 3 本', topic: 'コスメ', kind: 'post', tags: ['#リップ', '#コスメ'] },
    { title: 'カフェスタイル朝ごはん', topic: 'カフェ', kind: 'post', tags: ['#朝食', '#カフェ'] },
    { title: 'インテリア — リビングの一角', topic: 'ライフスタイル', kind: 'post', tags: ['#インテリア', '#暮らし'] },
    { title: 'Wellness Tea Co. 月次アンバサダー', topic: 'ライフスタイル', kind: 'post', tags: ['#ウェルネス', '#PR'], brand: 'Wellness Tea Co.' },
    { title: 'Wellness Tea Co. 5 月の選定', topic: 'ライフスタイル', kind: 'post', tags: ['#ウェルネス', '#PR'], brand: 'Wellness Tea Co.' },
    { title: '本日のメイクポーチの中身', topic: 'コスメ', kind: 'post', tags: ['#メイク', '#ポーチ'] },
    { title: '京都 静かな朝の喫茶店', topic: '旅行', kind: 'post', tags: ['#京都', '#喫茶店'] },
  ];

  const stories: Tpl[] = [
    { title: '今朝のカフェラテ', topic: 'カフェ', kind: 'story', tags: ['#日常'] },
    { title: '通勤途中の桜', topic: 'ライフスタイル', kind: 'story', tags: ['#桜'] },
    { title: 'おすすめスキンケア箱開け', topic: 'コスメ', kind: 'story', tags: ['#コスメ'] },
    { title: 'カフェ移動の途中で見つけた本屋', topic: 'ライフスタイル', kind: 'story', tags: ['#散歩'] },
    { title: '京都旅 day 2 ハイライト', topic: '旅行', kind: 'story', tags: ['#京都'] },
  ];

  const all: Tpl[] = [...reels, ...posts, ...stories];

  // 過去 90 日にばらけて配置 (新しい順に並べるので postedAt をランダム化)
  return all.map((tpl, i) => {
    const daysOld = Math.round((i / all.length) * 90); // 0..90 で均等分布
    const postedAt = isoDateTime(daysAgo(today, daysOld));

    // 数字を多少バリエーション化 (架空デモ用)
    const baseReach = tpl.kind === 'reel' ? 8500 : tpl.kind === 'post' ? 4200 : 2800;
    const reach = Math.round(baseReach * (0.7 + ((i * 17) % 60) / 100)); // 0.7-1.3 倍
    const impressions = Math.round(reach * 1.25);
    const likes = Math.round(reach * 0.052);
    const comments = Math.round(likes * 0.06);
    const saves = Math.round(likes * 0.18);
    const shares = Math.round(likes * 0.04);
    const er = +(((likes + comments + saves + shares) / Math.max(reach, 1)) * 100).toFixed(1);
    const views = tpl.kind === 'reel' ? Math.round(reach * 1.8) : undefined;

    return {
      id: `demo:iris-post-${i + 1}`,
      postedAt,
      platform: 'instagram' as const,
      contentType: tpl.kind === 'story' ? 'story' as const : tpl.kind === 'reel' ? 'reel' as const : 'post' as const,
      title: tpl.title,
      caption: tpl.caption,
      tags: tpl.tags,
      topic: tpl.topic,
      brand: tpl.brand,
      metrics: {
        reach,
        impressions,
        engagementRate: er,
        likes,
        comments,
        saves,
        shares,
        ...(views ? { views } : {}),
      },
      notes: tpl.notes,
    };
  });
}

// ─── E. 予約投稿 (PostQueue) 数件 ──────────────────
// 直近の「これから出す投稿」を 3 件
export function buildPostQueue(today: Date): ScheduledPost[] {
  return [
    {
      id: 'demo:iris-queue-1',
      createdAt: isoDateTime(daysAgo(today, 1)),
      scheduledAt: isoDateTime(daysAgo(today, -2)),
      status: 'scheduled',
      platform: 'instagram_reel',
      source: 'reel',
      brandName: 'Pure Skincare',
      caption: 'Pure Skincare の限定キャンペーン、ついに発表 — 朝晩のスキンケアがこんなに変わるなんて。\n\n#PR',
      hashtags: ['#PR', '#スキンケア', '#美肌'],
      cta: 'プロフィール欄から詳細チェック',
      note: 'Pure Skincare 案件の本投稿。下書き提出は明日締切。',
    },
    {
      id: 'demo:iris-queue-2',
      createdAt: isoDateTime(daysAgo(today, 1)),
      scheduledAt: isoDateTime(daysAgo(today, -4)),
      status: 'scheduled',
      platform: 'instagram_feed',
      source: 'image',
      caption: '今週のお気に入りカフェ 3 軒。週末のお出かけにどうぞ。',
      hashtags: ['#カフェ巡り', '#東京カフェ', '#週末'],
      note: '通常コンテンツ。週末公開予定。',
    },
    {
      id: 'demo:iris-queue-3',
      createdAt: isoDateTime(daysAgo(today, 2)),
      scheduledAt: isoDateTime(daysAgo(today, -6)),
      status: 'draft',
      platform: 'instagram_reel',
      source: 'reel',
      caption: '春のリップ、私の選び方 — 顔色と気分で 3 本使い分け',
      hashtags: ['#リップ', '#メイク', '#春コスメ'],
      note: '撮影前。リップ 3 本並べたカットを土曜に撮る予定。',
    },
  ];
}

// ─── F. 手動収益エントリ (RevenueEntry) ──────────────
// (案件 closed からは自動で集計されるが、それ以外の収入源も seed)
export function buildRevenueEntries(today: Date): RevenueEntry[] {
  const mk = (
    suffix: string,
    monthsBack: number,
    source: RevenueSource,
    description: string,
    amount: number,
  ): RevenueEntry => ({
    id: `demo:iris-rev-${suffix}`,
    date: isoDate(monthsAgo(today, monthsBack)),
    source,
    description,
    amountJPY: amount,
  });

  return [
    // アフィリエイト収入 (毎月)
    mk('aff-0', 0, 'アフィリエイト', '楽天ROOM 5 月分', 12_400),
    mk('aff-1', 1, 'アフィリエイト', '楽天ROOM 4 月分', 9_800),
    mk('aff-2', 2, 'アフィリエイト', '楽天ROOM 3 月分', 14_200),
    mk('aff-3', 3, 'アフィリエイト', '楽天ROOM 2 月分', 8_600),
    mk('aff-4', 4, 'アフィリエイト', '楽天ROOM 1 月分', 7_100),
    mk('aff-5', 5, 'アフィリエイト', '楽天ROOM 12 月分', 11_300),
    mk('aff-6', 6, 'アフィリエイト', '楽天ROOM 11 月分', 6_900),
    // 自主商品 (LINE スタンプ・LIT.Link 等)
    mk('own-1', 1, '自主商品', 'LINE スタンプ売上', 4_200),
    mk('own-3', 3, '自主商品', 'LINE スタンプ売上 + デジタル素材', 8_400),
    mk('own-6', 6, '自主商品', 'デジタル素材 (フォトプリセット)', 23_800),
    // グッズ (1 度きり)
    mk('goods-2', 2, 'グッズ/コラボ', 'オリジナルポーチ販売 (限定 50 個)', 87_500),
  ];
}

// ─── G. AgentTaskQueue 提案 (Iris 文脈で 2 件) ──────
export function buildCreatorAgentTasks(nowIso: string) {
  return [
    {
      id: 'demo:iris-agent-1',
      title: '来週の投稿 7 本を CMO に書いてもらう',
      summary: 'カフェ 2 本・コスメ 2 本・旅 1 本・ライフスタイル 2 本の構成で、@hina_lifestyle のトーンに合わせて 7 本のキャプション + ハッシュタグを CMO が量産。CDO がトーンと世界観を磨く。',
      why: '毎週の投稿準備時間 (約 3 時間/週) を 30 分に圧縮。',
      expected: '7 本のキャプション + ハッシュタグ + 撮影ブリーフ',
      dueDays: 5,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'CMO' as const, label: 'コピー量産 (7本)', status: 'pending' as const },
        { cxo: 'CDO' as const, label: 'トーン・世界観チェック', status: 'pending' as const },
      ],
    },
    {
      id: 'demo:iris-agent-2',
      title: 'Pure Skincare 案件の DM 下書きを CSO に頼む',
      summary: 'Pure Skincare の限定キャンペーン案件 (¥150k) について、下書き提出前に「内容確認 + 修正回数の合意 + 報酬支払スケジュール」を確認する DM を CSO が起案、CMO が文面を整える。',
      why: '高額案件のリスクを下げ、入金確実性を 100% に。',
      expected: 'CSO 起案 → CMO 仕上げの DM 文面 1 本',
      dueDays: 2,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'CSO' as const, label: '確認項目の洗い出し + DM 骨子', status: 'pending' as const },
        { cxo: 'CMO' as const, label: '文面を @hina_lifestyle トーンで仕上げ', status: 'pending' as const },
      ],
    },
  ];
}

// ─── ペルソナ (Iris 用に作成) ────────────────────
export function buildCreatorPersona(nowIso: string, monthlyRevenue: number) {
  return {
    id: DEMO_CREATOR_PID,
    name: 'ライフスタイル系クリエイター・ひな',
    subtitle: '@hina_lifestyle / フォロワー 18.2K',
    icon: '🌸',
    accentColor: '#E1306C',
    accentColorLight: 'rgba(225,48,108,0.15)',
    description:
      '東京・28 歳のライフスタイル系インフルエンサー。カフェ・コスメ・旅・暮らしを発信。月の案件売上 ¥40-100 万。月額アンバサダー契約も並走中。',
    createdAt: nowIso,
    meetingSlug: 'hina-iris-demo',
    tasks: [],
    cashflow: {
      income: monthlyRevenue,
      expense: -Math.round(monthlyRevenue * 0.18),
      label: '@hina_lifestyle・月次収支 (架空)',
    },
    timeAllocation: 65, // 制作 + 投稿に多くの時間
  };
}

// ─── MediaKit ────────────────────────────────
export function buildMediaKit() {
  return {
    personaId: DEMO_CREATOR_PID,
    handleName: 'ひな (@hina_lifestyle)',
    followers: { instagram: 18_200 },
    avgEngagementRate: { instagram: 4.8 },
    monthlyReach: 142_000,
    audienceProfile: '25-34 歳女性中心 (78%)、東京・大阪・名古屋。カフェ・コスメ・旅・ライフスタイル系に強い関心。',
    caseHistory: 'ABCコスメ春のリップ PR (¥80k) / Travel Style Japan 京都企画 (¥120k) / Wellness Tea Co. 月額アンバサダー (¥40k×6ヶ月) ほか',
    rateCard: 'フィード投稿 ¥50k〜 / リール ¥80k〜 / ストーリー 1 枚 ¥10k〜 / 月額アンバサダー ¥40k/月〜',
    brandValues: 'サステナビリティ・誠実な PR・押し売り NG。自分が本当に好きなものだけ紹介。',
    entity: 'individual' as const,
    legalName: '個人事業主・ひな',
  };
}

// ─── メインエントリ: Iris 用デモを seed する ────────
export function seedDemoDataCreator(): number {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = now;

  // 各データセット組み立て
  const igProfile = buildIgProfile(nowIso);
  const deals = buildCreatorDeals(today, nowIso);
  const fans = buildCreatorFans(today, nowIso);
  const postHistory = buildPostHistory(today);
  const postQueue = buildPostQueue(today);
  const revenue = buildRevenueEntries(today);
  const agentTasks = buildCreatorAgentTasks(nowIso);
  const mediaKit = buildMediaKit();

  // 今月の closed 案件売上 + 手動収益で persona の cashflow を出す
  const currentYm = ym(today);
  const monthlyDealRevenue = deals
    .filter(d => d.stage === 'closed' && d.fee > 0)
    .filter(d => (d.postedDate || d.updatedAt || '').startsWith(currentYm))
    .reduce((s, d) => s + d.fee + (d.usageFee || 0), 0);
  const monthlyManualRevenue = revenue
    .filter(r => r.date.startsWith(currentYm))
    .reduce((s, r) => s + r.amountJPY, 0);
  const monthlyRevenue = monthlyDealRevenue + monthlyManualRevenue;

  const persona = buildCreatorPersona(nowIso, monthlyRevenue || 165_000);

  // ── 書き込み ──────────────────────────────
  // 1. Instagram プロフィール (単体オブジェクト)
  try {
    localStorage.setItem(KEY_IG_PROFILE, JSON.stringify(igProfile));
    localStorage.setItem(KEY_DEMO_CONNECTED, 'true');
  } catch { /* quota */ }

  // 2. ペルソナ (Prism と共存、demo: のみ置換)
  try {
    const raw = localStorage.getItem(KEY_PERSONAS);
    const existing: { id: string }[] = raw ? JSON.parse(raw) : [];
    // 既存の demo:persona-hina だけ取り除き、Tanaka 等は残す
    const cleaned = existing.filter(p => p.id !== DEMO_CREATOR_PID);
    localStorage.setItem(KEY_PERSONAS, JSON.stringify([persona, ...cleaned]));
    localStorage.setItem(KEY_ACTIVE_PERSONA, DEMO_CREATOR_PID);
  } catch { /* */ }

  // 3. 案件
  upsertArr(KEY_DEALS, deals);

  // 4. ファン (demo: で始まるものだけ置換)
  upsertArr(KEY_FANS, fans);

  // 5. 投稿履歴 (id プレフィクスで demo: 置換)
  upsertArr(KEY_POSTHISTORY, postHistory);

  // 6. 投稿予約キュー
  upsertArr(KEY_POST_QUEUE, postQueue);

  // 7. 手動収益エントリ
  upsertArr(KEY_REVENUE, revenue);

  // 8. AgentTaskQueue (Prism の cafe demo の agentTasks と共存)
  upsertArr(KEY_AGENT_QUEUE, agentTasks);

  // 9. MediaKit (人格別、KEY_INF_KIT_ + personaId に上書き)
  try {
    localStorage.setItem(KEY_MEDIA_KIT, JSON.stringify(mediaKit));
  } catch { /* */ }

  // 合計件数
  return (
    1 /* igProfile */ +
    1 /* persona */ +
    deals.length +
    fans.length +
    postHistory.length +
    postQueue.length +
    revenue.length +
    agentTasks.length +
    1 /* mediaKit */
  );
}

/** Iris デモを掃除する (demo: のみ) */
export function clearDemoDataCreator(): void {
  // 単体オブジェクト系は完全削除
  try {
    const raw = localStorage.getItem(KEY_IG_PROFILE);
    if (raw) {
      const p = JSON.parse(raw) as IgProfile;
      // hina_lifestyle のときだけ削除 (実ユーザーのデータを消さない)
      if (p?.handle === 'hina_lifestyle') {
        localStorage.removeItem(KEY_IG_PROFILE);
        localStorage.removeItem(KEY_DEMO_CONNECTED);
      }
    }
  } catch { /* */ }

  // 配列系: demo: で始まる id だけ除去
  const arrKeys = [
    KEY_DEALS, KEY_FANS, KEY_POSTHISTORY, KEY_POST_QUEUE,
    KEY_REVENUE, KEY_AGENT_QUEUE,
  ];
  for (const k of arrKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr: { id?: string }[] = JSON.parse(raw);
      const cleaned = arr.filter(i => !String(i.id || '').startsWith('demo:'));
      localStorage.setItem(k, JSON.stringify(cleaned));
    } catch { /* */ }
  }

  // ペルソナ
  try {
    const raw = localStorage.getItem(KEY_PERSONAS);
    if (raw) {
      const arr: { id: string }[] = JSON.parse(raw);
      const cleaned = arr.filter(p => p.id !== DEMO_CREATOR_PID);
      localStorage.setItem(KEY_PERSONAS, JSON.stringify(cleaned));
    }
  } catch { /* */ }

  // MediaKit
  try { localStorage.removeItem(KEY_MEDIA_KIT); } catch { /* */ }
}
