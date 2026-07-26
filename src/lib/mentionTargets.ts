// ============================================================
// mentionTargets — Cmd+K で「@ で対象を指してから頼む」ための実データ供給
//
// ★なぜ (2026-07-27):
//   Cmd+K の AI 依頼は自由文なので「AI が何を見て答えたのか」が分からず、
//   結局オーナーが自分で資料を開いて手で確認していた。ここでは
//   「@ナレッジ / @カレンダー / @メール / @売上」と対象を先に指させ、
//   その対象の"実データだけ"を読んで実行する。見る範囲が目に見える状態にする。
//
// ★正直さの約束:
//   ・繋がっていない連携は候補に出さない (偽の器を作らない)
//   ・読めなかったら理由を返して止める (黙って一般論を書かせない)
//   ・件数は実測値のみ。0 件なら「0 件でした」と出す (水増ししない)
// ============================================================
import type { KnowledgeItem } from '../types/identity';
import { isCalendarConnected, listUpcoming } from './gcal';
import { isGmailConnected, fetchInbox } from './gmail';
import { isRevenueConnectedCached, fetchRevenueSnapshot, fmtJpy } from './revenue';

export type MentionKind = 'knowledge-all' | 'knowledge-one' | 'calendar' | 'mail' | 'revenue';

export interface MentionTarget {
  /** 保存・復元に使う安定 ID */
  id: string;
  kind: MentionKind;
  /** 画面に出す名前 (@ 付き) */
  label: string;
  /** 「何を見るのか」の 1 行説明 */
  hint: string;
  knowledgeId?: string;
}

export interface MentionContext {
  /** AI に渡す実データ本文 */
  text: string;
  /** 画面に出す「何件読んだか」(実測のみ) */
  note: string;
}

/** AI に渡す実データの上限。localStorage とトークンの両方を守る。 */
const MAX_CONTEXT_CHARS = 4000;

function clip(s: string, n: number): string {
  const t = (s || '').replace(/\s+\n/g, '\n').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

// ────────────────────────────────────────────────────────────
// 候補の列挙
// ────────────────────────────────────────────────────────────

/**
 * いま指せる対象を返す。
 * @param knowledge  いまの人格のナレッジ (呼び出し側で絞り込み済み)
 * @param query      @ の後ろに打った文字 (絞り込み用・空可)
 */
export function listMentionTargets(knowledge: KnowledgeItem[], query = ''): MentionTarget[] {
  const q = query.trim().toLowerCase();
  const out: MentionTarget[] = [];

  if (knowledge.length > 0) {
    out.push({
      id: 'k:all',
      kind: 'knowledge-all',
      label: '@ナレッジ',
      hint: `取り込んだ資料・メモ ${knowledge.length} 件から探して答えます`,
    });
  }
  if (isCalendarConnected()) {
    out.push({ id: 'cal', kind: 'calendar', label: '@カレンダー', hint: '直近の予定だけを見て答えます' });
  }
  if (isGmailConnected()) {
    out.push({ id: 'mail', kind: 'mail', label: '@メール', hint: '受信箱の最近のメールだけを見て答えます' });
  }
  if (isRevenueConnectedCached()) {
    out.push({ id: 'rev', kind: 'revenue', label: '@売上', hint: 'Stripe の実売上だけを見て答えます' });
  }

  // 特定のノートを名指しする (資料が多い人ほど効く)
  const notes = knowledge
    .filter(k => !q || k.title.toLowerCase().includes(q))
    .slice(0, 6)
    .map((k): MentionTarget => ({
      id: 'k:' + k.id,
      kind: 'knowledge-one',
      label: '@' + (k.title.length > 24 ? k.title.slice(0, 24) + '…' : k.title),
      hint: 'このノート 1 件だけを見て答えます',
      knowledgeId: k.id,
    }));

  const primary = q ? out.filter(t => t.label.toLowerCase().includes(q)) : out;
  return [...primary, ...notes];
}

/** 保存した ID から対象を復元する (見つからなければ null = 対象なしで実行) */
export function resolveMentionTarget(id: string, knowledge: KnowledgeItem[]): MentionTarget | null {
  return listMentionTargets(knowledge).find(t => t.id === id)
    // 特定ノートは listMentionTargets の 6 件枠に入らないことがあるので直接引く
    ?? (id.startsWith('k:') && id !== 'k:all'
      ? (() => {
          const k = knowledge.find(x => x.id === id.slice(2));
          return k
            ? {
                id,
                kind: 'knowledge-one' as const,
                label: '@' + (k.title.length > 24 ? k.title.slice(0, 24) + '…' : k.title),
                hint: 'このノート 1 件だけを見て答えます',
                knowledgeId: k.id,
              }
            : null;
        })()
      : null);
}

// ────────────────────────────────────────────────────────────
// 実データの取得
// ────────────────────────────────────────────────────────────

/**
 * 対象の実データを読んで、AI に渡す本文を作る。
 * 読めない時は「なぜ読めないか」を Error で返す (呼び出し側は実行を止める)。
 */
export async function buildMentionContext(
  target: MentionTarget,
  knowledge: KnowledgeItem[],
): Promise<MentionContext> {
  switch (target.kind) {
    case 'knowledge-all': {
      const items = [...knowledge]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 8);
      if (items.length === 0) throw new Error('ナレッジがまだ 0 件です。資料かメモを追加してから使えます');
      const per = Math.max(240, Math.floor(MAX_CONTEXT_CHARS / items.length));
      const text = items
        .map((k, i) => `## ${i + 1}. ${k.title}\n${clip(k.content, per)}`)
        .join('\n\n');
      return { text: clip(text, MAX_CONTEXT_CHARS), note: `ナレッジ ${items.length} 件を読みました` };
    }

    case 'knowledge-one': {
      const k = knowledge.find(x => x.id === target.knowledgeId);
      if (!k) throw new Error('そのノートが見つかりませんでした (消された可能性があります)');
      const body = clip(k.content, MAX_CONTEXT_CHARS);
      if (!body) throw new Error('そのノートは本文が空でした');
      return { text: `## ${k.title}\n${body}`, note: `「${k.title}」を読みました` };
    }

    case 'calendar': {
      if (!isCalendarConnected()) throw new Error('カレンダーが繋がっていません。設定から接続してください');
      const events = await listUpcoming(10);
      if (events.length === 0) {
        return { text: '直近の予定: 0 件 (カレンダーは空でした)', note: '直近の予定は 0 件でした' };
      }
      const text = events
        .map(e => {
          const d = new Date(e.start);
          const when = Number.isNaN(d.getTime())
            ? e.start
            : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          return `- ${when} ${e.summary}`;
        })
        .join('\n');
      return { text: clip(`直近の予定 ${events.length} 件\n${text}`, MAX_CONTEXT_CHARS), note: `予定 ${events.length} 件を読みました` };
    }

    case 'mail': {
      if (!isGmailConnected()) throw new Error('メールが繋がっていません。設定から接続してください');
      const msgs = await fetchInbox(8);
      if (msgs.length === 0) {
        return { text: '受信箱: 0 件 (最近のメールはありません)', note: '最近のメールは 0 件でした' };
      }
      const per = Math.max(200, Math.floor(MAX_CONTEXT_CHARS / msgs.length) - 120);
      const text = msgs
        .map((m, i) => `## ${i + 1}. ${m.subject || '(件名なし)'}\nFrom: ${m.from}\n${m.date}\n${clip(m.body || m.snippet, per)}`)
        .join('\n\n');
      return { text: clip(text, MAX_CONTEXT_CHARS), note: `メール ${msgs.length} 件を読みました` };
    }

    case 'revenue': {
      const snap = await fetchRevenueSnapshot();
      if (snap.source === 'empty') {
        throw new Error(snap.error ? `売上を取得できませんでした (${snap.error})` : '売上データがまだありません');
      }
      const months = snap.monthly.slice(-6)
        .map(m => `- ${m.month}: MRR ${fmtJpy(m.mrrJpy)} (Prism ${fmtJpy(m.prismJpy)} / Iris ${fmtJpy(m.irisJpy)})`)
        .join('\n');
      const text = [
        `今のMRR: ${fmtJpy(snap.totals.mrrJpy)} / 課金数: ${snap.totals.paidCount} 件 / ARR: ${fmtJpy(snap.totals.arrJpy)}`,
        `内訳: Prism ${fmtJpy(snap.totals.prismMrrJpy)} / Iris ${fmtJpy(snap.totals.irisMrrJpy)} / その他 ${fmtJpy(snap.totals.otherMrrJpy)}`,
        months ? `月次推移\n${months}` : '',
        `データ元: ${snap.source}`,
      ].filter(Boolean).join('\n');
      return {
        text: clip(text, MAX_CONTEXT_CHARS),
        note: `売上 (課金 ${snap.totals.paidCount} 件) を読みました`,
      };
    }
  }
}

/** エラーをやさしい日本語 1 行に (silent fail を作らないための表示用) */
export function mentionErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message || '';
  if (!msg) return 'データを読めませんでした。もう一度お試しください';
  if (/401|403|token|auth/i.test(msg)) return '接続が切れていました。設定から繋ぎ直してください';
  if (/network|fetch|timeout|abort/i.test(msg)) return '通信に失敗しました。電波の良い場所でもう一度お試しください';
  return msg;
}
