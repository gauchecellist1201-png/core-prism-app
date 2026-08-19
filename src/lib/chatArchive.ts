// ============================================================
// chatArchive.ts — チャット履歴（core_mobile_gemini_v1:<personaId>）の
//                  「端末引き継ぎ」用の読み書き・間引き・マージ
//
// ロードマップ T1-2c。
// PC で話した続きがスマホで白紙、を根治する。personas / knowledge と同じ
// /api/account/blob（Upstash・同一メール基準）に相乗りさせるが、
// 会話は量が多いので **必ず上限に収めてから** 送る必要がある。
//
// 設計のキモ:
//   ・送る前に「1人格あたりの件数」を段階的に減らして 600KB 以内へ確実に収める
//     （収まらないものを投げると 413 で毎回黙って捨てられる＝一生引き継げない）
//   ・マージは id 単位の和集合。ローカルを勝ちにするので、こちらの最新は消えない
//   ・plan（実行カード）は重くなり得るので、小さいものだけ載せる
// ============================================================

export const CHAT_STORAGE_PREFIX = 'core_mobile_gemini_v1';

/** MobileGeminiDashboard の Msg と同形（循環 import を避けるため最小定義） */
export interface ArchivedMsg {
  id: string;
  kind: 'user' | 'ai' | 'plan' | 'system';
  text?: string;
  plan?: unknown;
  agentKey?: string;
  ts: number;
}

export type ChatMap = Record<string, ArchivedMsg[]>;

/** ローカル 1人格あたりの保持上限（MobileGeminiDashboard の saveMessages と一致させる） */
const LOCAL_CAP = 100;
/** クラウドへ送る時の 1人格あたり件数の候補（大きい順に試して収まるものを選ぶ） */
const CLOUD_CAPS = [40, 25, 15, 8, 4];
/** 1メッセージの本文上限（長い生成物で 1件が枠を食い潰さないように） */
const TEXT_CAP = 4000;
/** plan を載せる上限（これを超える実行カードは本文だけ残す） */
const PLAN_CAP = 2000;
/** サーバー側 MAX_BYTES=900,000 に対する安全側の目標 */
const TARGET_BYTES = 600_000;

function isMsg(v: unknown): v is ArchivedMsg {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return typeof m.id === 'string' && typeof m.ts === 'number';
}

/** localStorage から全人格分の会話を読む */
export function readAllChats(): ChatMap {
  const out: ChatMap = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${CHAT_STORAGE_PREFIX}:`)) continue;
      const personaId = k.slice(CHAT_STORAGE_PREFIX.length + 1);
      if (!personaId) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(arr)) out[personaId] = arr.filter(isMsg);
      } catch { /* 壊れた1件で全体を落とさない */ }
    }
  } catch { /* localStorage 自体が使えない環境 */ }
  return out;
}

/** マージ結果を localStorage へ書き戻す（人格ごと・上限つき） */
export function writeAllChats(map: ChatMap): void {
  for (const [personaId, msgs] of Object.entries(map)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    try {
      localStorage.setItem(`${CHAT_STORAGE_PREFIX}:${personaId}`, JSON.stringify(msgs.slice(-LOCAL_CAP)));
    } catch { /* 容量超過。ここで落とさない */ }
  }
}

function slimMsg(m: ArchivedMsg): ArchivedMsg {
  const out: ArchivedMsg = { id: m.id, kind: m.kind, ts: m.ts };
  if (typeof m.text === 'string') out.text = m.text.length > TEXT_CAP ? `${m.text.slice(0, TEXT_CAP)}…` : m.text;
  if (m.agentKey) out.agentKey = m.agentKey;
  if (m.plan !== undefined) {
    try {
      const s = JSON.stringify(m.plan);
      if (s.length <= PLAN_CAP) out.plan = m.plan;
    } catch { /* 載せない */ }
  }
  return out;
}

/**
 * クラウドへ送る形へ間引く。**必ず TARGET_BYTES 以内に収める**。
 * どの上限でも収まらない場合は最小上限で切って返す（送れない、を作らない）。
 */
export function slimChatsForCloud(map: ChatMap): ChatMap {
  let last: ChatMap = {};
  for (const cap of CLOUD_CAPS) {
    const out: ChatMap = {};
    for (const [personaId, msgs] of Object.entries(map)) {
      if (!Array.isArray(msgs) || msgs.length === 0) continue;
      out[personaId] = msgs.slice(-cap).map(slimMsg);
    }
    last = out;
    if (JSON.stringify(out).length <= TARGET_BYTES) return out;
  }
  return last;
}

/** 人格ごとに id の和集合を取り、時刻順に並べ直す。同じ id はローカル側を優先。 */
export function mergeChats(local: ChatMap, remote: ChatMap): ChatMap {
  const out: ChatMap = {};
  const personaIds = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const personaId of personaIds) {
    const byId = new Map<string, ArchivedMsg>();
    for (const m of remote?.[personaId] || []) if (isMsg(m)) byId.set(m.id, m);
    for (const m of local?.[personaId] || []) if (isMsg(m)) byId.set(m.id, m);
    out[personaId] = Array.from(byId.values()).sort((a, b) => a.ts - b.ts).slice(-LOCAL_CAP);
  }
  return out;
}

/** マージで「新しく増えた件数」を数える（引き継ぎましたの表示を嘘にしないため） */
export function countNewMessages(before: ChatMap, after: ChatMap): number {
  let n = 0;
  for (const [personaId, msgs] of Object.entries(after)) {
    const had = new Set((before?.[personaId] || []).map(m => m.id));
    for (const m of msgs) if (!had.has(m.id)) n++;
  }
  return n;
}
