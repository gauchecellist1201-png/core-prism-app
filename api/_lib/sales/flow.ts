// ============================================================
// Sales OS — 結果を入れたら次の一手が決まる (ステージ遷移 + 追客予約)
//
// 「営業は1回で終わらせない」。活動を記録した瞬間に必ず nextActionAt が入る。
// 入らない経路を作らないこと (入らない = その会社は二度と画面に出てこない)。
// ============================================================
import type { ActivityKind, Company, Stage } from '../../../src/sales/shared/types';
import { nextFollowUp, stageMeta } from '../../../src/sales/shared/catalog';

const DAY = 24 * 3600 * 1000;

export function addDays(baseISODate: string, days: number): string {
  const d = new Date(`${baseISODate}T00:00:00.000Z`);
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}

/**
 * 単発の受注額は足していく。1つの欄に上書きすると、初回受注した会社が
 * 月額に上がった瞬間に単発の実績が消える (同じ欄を月額で塗りつぶすため)。
 */
function addOneOff(c: Company, yen?: number): void {
  if (typeof yen !== 'number' || yen <= 0) return;
  c.dealYen = yen;
  c.oneOffYen = (c.oneOffYen ?? 0) + yen;
  c.oneOffCount = (c.oneOffCount ?? 0) + 1;
}

/** 月額は「今いくらか」なので上書きでよい (足すと解約・増額のたびに膨らむ) */
function setMrr(c: Company, yen?: number): void {
  if (typeof yen !== 'number' || yen <= 0) return;
  c.dealYen = yen;
  c.mrrYen = yen;
}

/** 段が戻らないようにする (返信をもらった会社を「接触ずみ」に落とさない) */
function advance(current: Stage, candidate: Stage): Stage {
  if (current === 'LOST') return candidate;         // 失注からは復活してよい
  if (candidate === 'LOST') return 'LOST';
  return stageMeta(candidate).step >= stageMeta(current).step ? candidate : current;
}

export interface FlowInput {
  company: Company;
  kind: ActivityKind;
  today: string;      // YYYY-MM-DD
  nowISO: string;
  dealYen?: number;
  lostReason?: string;
}

export interface FlowResult {
  company: Company;
  /** 画面に出す「次にやること」 */
  nextActionLabel: string;
}

export function applyActivity(input: FlowInput): FlowResult {
  const { company, kind, today, nowISO, dealYen, lostReason } = input;
  const c: Company = { ...company };

  const setNext = (days: number, label: string) => {
    c.nextActionAt = addDays(today, days);
    c.nextActionLabel = label;
  };

  switch (kind) {
    case 'call':
    case 'email': {
      c.touches += 1;
      c.lastTouchAt = nowISO;
      c.stage = advance(c.stage, 'CONTACTED');
      const f = nextFollowUp(c.touches);
      setNext(f.afterDays, `追客${f.touch}回目 — ${f.angle}`);
      break;
    }
    case 'call_no_answer':
      // 不在は接触にしない (接触回数を水増しすると追客の中身がずれる)
      setNext(2, '不在だったのでかけ直す');
      break;
    case 'reply':
      c.stage = advance(c.stage, 'REPLIED');
      setNext(1, '5分のオンラインを取る');
      break;
    case 'meeting':
      c.stage = advance(c.stage, 'MEETING');
      setNext(2, '企画3案を出して提案する');
      break;
    case 'proposal':
      c.stage = advance(c.stage, 'PROPOSAL');
      if (typeof dealYen === 'number' && dealYen > 0) c.dealYen = dealYen;
      setNext(3, '返事をもらって決める');
      break;
    case 'trial':
      c.stage = advance(c.stage, 'TRIAL');
      addOneOff(c, dealYen);
      setNext(14, '納品後に月額プランを提案する');
      break;
    case 'won':
      c.stage = advance(c.stage, 'WON');
      addOneOff(c, dealYen);
      setNext(14, '月額プランを提案する');
      break;
    case 'monthly':
      c.stage = advance(c.stage, 'MONTHLY');
      setMrr(c, dealYen);
      setNext(30, '本数の引き上げ・別部署へ横展開する');
      break;
    case 'oem':
      c.stage = advance(c.stage, 'OEM');
      setMrr(c, dealYen);
      setNext(30, '案件数を増やす。共同提案に同席する');
      break;
    case 'lost':
      c.stage = 'LOST';
      c.lostReason = (lostReason || '').slice(0, 200);
      setNext(90, '新しい企画で再アプローチする');
      break;
    case 'note':
    default:
      if (!c.nextActionAt) setNext(0, stageMeta(c.stage).nextHint);
      break;
  }

  // 到達した最高段は下げない。失注 (step -1) でも過去の到達は残す。
  c.maxStep = Math.max(c.maxStep ?? 0, stageMeta(c.stage).step);

  return { company: c, nextActionLabel: c.nextActionLabel };
}
