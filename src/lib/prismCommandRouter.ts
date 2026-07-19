// ============================================================
// Prism チャット指令ルーター (2026-07-19 オーナー指示)
// 「Prism 〇〇して」— 下部チャットが Claude Code のように
// 機能起動・AI実行までやる。キーワード即断 (コード確定・誤爆防止に
// 動詞/短文条件つき) → 外れたら従来のAI会話へフォールバック。
// IrisCommandBar の KEYWORD_ROUTES / CommandPalette の ModalKey を踏襲。
// ============================================================
import type { ModalKey } from '../components/CommandPalette';

export type RouterHit =
  | { type: 'open-modal'; modal: ModalKey; label: string }
  | { type: 'execute'; action: string }
  | { type: 'chat' };

const OPEN_ROUTES: { re: RegExp; modal: ModalKey; label: string }[] = [
  { re: /レシート|経費|OCR/i, modal: 'expense', label: '経費 / レシートOCR' },
  { re: /請求書/, modal: 'invoice', label: '請求書スタジオ' },
  { re: /売上.*(記録|台帳)|台帳/, modal: 'sales', label: '売上台帳' },
  { re: /決算|P\/?L|損益|B\/?S/i, modal: 'pnl', label: 'P&L 損益' },
  { re: /財務.*(相談|コンサル)|財務コンサル/, modal: 'finConsult', label: '財務コンサルタント' },
  { re: /ナレッジ|資料.*(見|開|一覧)/, modal: 'knowledge', label: 'ナレッジ' },
  { re: /議事録|文字起こし/, modal: 'minutes', label: '議事録AI' },
  { re: /スライド|プレゼン資料|pptx/i, modal: 'slides', label: 'スライド生成' },
  { re: /交渉|商談.*(コーチ|準備|戦略)/, modal: 'nego', label: '交渉コーチ' },
  { re: /投稿.*(書|作|生成)|note.*(書|記事)|ツイート|SNS.*(投稿|文)/i, modal: 'post', label: '投稿生成' },
  { re: /画像.*(作|生成)|サムネ|アイキャッチ/, modal: 'image', label: '画像生成' },
  { re: /音声メモ|録音.*(メモ|して)/, modal: 'voice', label: '音声メモ' },
  { re: /youtube|動画.*(取込|要約)/i, modal: 'youtube', label: 'YouTube取込' },
  { re: /メール.*(仕分|整理|片付|トリアージ)|受信箱/, modal: 'email', label: 'メールトリアージ' },
  { re: /crm|案件.*(管理|一覧)|パイプライン/i, modal: 'crm', label: 'CRMパイプライン' },
  { re: /タスク|やる事|やること|todo/i, modal: 'tasks', label: 'タスクハブ' },
  { re: /ヘルス|体調|睡眠|健康/, modal: 'health', label: 'ヘルスHub' },
  { re: /書類|契約書|見積|発注|納品書/, modal: 'documents', label: '書類スタジオ' },
  { re: /1on1|人物カルテ|メンバー.*(記録|カルテ)/i, modal: 'people', label: '人物カルテ' },
  { re: /会議.*(予約|リンク|スケジュール)|ミーティングリンク/, modal: 'meeting', label: '会議リンク' },
  { re: /今日のレポート|日報.*(見|開|出)/, modal: 'dailyReport', label: '今日のレポート' },
  { re: /商談.*(エージェント|ai)|今日の商談/i, modal: 'salesAgent', label: '商談AIエージェント' },
  { re: /環境設定|設定.*(開|変え)/, modal: 'settings', label: '環境設定' },
];

// 「開く」系の意思 (これがあればスタジオ起動が本人の意図)
const OPEN_VERB = /(開いて|ひらいて|開く|見せて|みせて|表示|出して|だして|起動|使いたい|やりたい)/;
// 「やって」系の意思 (実行要求 — 該当スタジオがあればそこへ、無ければAI実行)
const DO_VERB = /(して(?!る)|しといて|やって|作って|つくって|書いて|かいて|生成|まとめて|整理|準備|発行|登録|お願い|たのむ|頼む|実行)/;
// 呼びかけ prefix (「Prism 〜」「プリズム、〜」)
const CALL_PREFIX = /^(prism|プリズム|ぷりずむ)[、,:：!！\s]*/i;

export function routeCommand(raw: string): RouterHit {
  const text = (raw || '').trim();
  if (!text) return { type: 'chat' };
  const called = CALL_PREFIX.test(text);
  const t = text.replace(CALL_PREFIX, '');

  const hit = OPEN_ROUTES.find(r => r.re.test(t));
  if (hit && (OPEN_VERB.test(t) || DO_VERB.test(t) || (called && t.length <= 20) || t.length <= 12)) {
    return { type: 'open-modal', modal: hit.modal, label: hit.label };
  }
  // 明示呼びかけ + 実行動詞 + スタジオ該当なし → AI 実行 (InlineActionExecutor が計画→納品)
  if (called && DO_VERB.test(t) && t.length >= 8) {
    return { type: 'execute', action: t };
  }
  return { type: 'chat' };
}
