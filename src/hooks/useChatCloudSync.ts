// ============================================================
// useChatCloudSync — チャット履歴の端末引き継ぎ（ロードマップ T1-2c）
//
// 「PC で相談した続きが、スマホでは白紙」を根治する。
// personas / knowledge と同じ /api/account/blob（同一メール基準・Upstash）に
// key='chats' で相乗りする。会話は量が多いので送る前に必ず間引く。
//
// 呼び出し側（MobileGeminiDashboard）は
//   ・status を見て「取り寄せ中 / 失敗＋もう一度」を必ず画面に出す（沈黙する失敗ゼロ）
//   ・broughtIn 件数を見て「N件を引き継ぎました」と正直に伝える
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEmailBlobSync } from './useEmailBlobSync';
import {
  readAllChats, writeAllChats, slimChatsForCloud, mergeChats, countNewMessages,
  type ArchivedMsg, type ChatMap,
} from '../lib/chatArchive';

interface Options {
  /** ログイン中ユーザーのメール（無ければ完全 no-op） */
  email: string | null | undefined;
  /** いま開いている人格 */
  personaId: string;
  /** いま画面に出ている会話（この人格ぶん） */
  msgs: ArchivedMsg[];
  /** クラウドから増えた会話を画面へ戻す */
  onMerged: (msgsForCurrentPersona: ArchivedMsg[]) => void;
}

export function useChatCloudSync({ email, personaId, msgs, onMerged }: Options) {
  const [broughtIn, setBroughtIn] = useState(0);
  // pull は「ログインした時に1回」なので、その中で使う値は必ず“今”を見る。
  // ここを閉じ込め（mount 時の値）にすると、待っている間に切り替えた人格や
  // 打ち込んだ1通を、届いた履歴で上書きして消してしまう。
  const liveRef = useRef({ personaId, onMerged });
  useEffect(() => { liveRef.current = { personaId, onMerged }; });

  // 送る値 = 保存済みの全人格ぶん + いま画面にある最新（保存待ちの差分を取りこぼさない）。
  // localStorage 全走査 + JSON 化なので、会話が動いた時だけ作り直す（入力の1文字ごとに走らせない）。
  const outgoing = useMemo(
    () => slimChatsForCloud({ ...readAllChats(), [personaId]: msgs }),
    [personaId, msgs],
  );

  const { status, retry } = useEmailBlobSync<ChatMap>({
    key: 'chats',
    email,
    value: outgoing,
    isEmpty: v => Object.values(v).every(a => !a || a.length === 0),
    // readAllChats() は自動保存済みの“今”を返す（保存は msgs 変化のたびに走る）ので、
    // ここでは閉じ込めた msgs を使わない。
    merge: (_local, remote) => mergeChats(readAllChats(), remote || {}),
    onRemote: (merged) => {
      const before = readAllChats();
      const added = countNewMessages(before, merged);
      writeAllChats(merged);
      if (added > 0) {
        setBroughtIn(added);
        const { personaId: livePersonaId, onMerged: liveOnMerged } = liveRef.current;
        const mine = merged[livePersonaId];
        if (mine && mine.length !== (before[livePersonaId] || []).length) liveOnMerged(mine);
      }
    },
  });

  const dismissBroughtIn = useCallback(() => setBroughtIn(0), []);

  // 「引き継ぎの結果が出たか」。未ログインなら最初から出ている（待つ必要が無い）。
  // 失敗も“出た”に含める＝取り寄せに失敗した人を永久に待たせない。
  const settled = !email || status === 'ready' || status === 'error';

  return { status, retry, broughtIn, dismissBroughtIn, settled };
}
