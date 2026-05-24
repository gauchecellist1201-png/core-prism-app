// ============================================================
// シャドー秘書フック — Gmail 未読を 30 分ごとにポーリングし
// 返信下書きを事前生成して localStorage にキャッシュする
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, Persona } from '../types/identity';
import { isGmailConnected, fetchInbox, sendReply, gmailToTriageText } from '../lib/gmail';
import { triageEmails } from '../lib/emailTriage';
import { enqueueClaudeCall } from '../lib/apiQueue';

const STORAGE_KEY = 'core_shadow_drafts_v1';
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 分
const MAX_PER_POLL = 5;                   // API コスト考慮
const MAX_STORED = 50;

export interface ShadowDraft {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  draftText: string;
  importance: 'high' | 'mid' | 'low' | 'spam';
  summary: string;
  generatedAt: string;
  sent?: boolean;
  dismissed?: boolean;
  /** どの人格として下書きしたか — persona 切替後に他人格のドラフトを混ぜないため */
  personaId?: string;
}

function loadDrafts(): ShadowDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShadowDraft[]) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: ShadowDraft[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // localStorage quota exceeded — fail silently
  }
}

export function useShadowSecretary(settings: AppSettings, persona: Persona) {
  const [drafts, setDrafts] = useState<ShadowDraft[]>(loadDrafts);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);
  const pollingRef = useRef(false);

  // ユーザーに見せる drafts は当 persona のものだけ。
  // 旧仕様 (personaId 無し) のドラフトは「全人格共有」とみなして表示 (互換)。
  const activeDrafts = drafts.filter(d =>
    !d.sent && !d.dismissed && (!d.personaId || d.personaId === persona.id)
  );

  const runPoll = useCallback(async () => {
    if (!isGmailConnected()) return;
    if (pollingRef.current) return;

    const apiKey =
      (import.meta.env.VITE_CLAUDE_API_KEY as string | undefined) ||
      settings.claudeApiKey;
    if (!apiKey) return;

    pollingRef.current = true;
    setIsPolling(true);

    try {
      const messages = await fetchInbox(20);

      // 既に処理済みの messageId をスキップ
      const stored = loadDrafts();
      const knownIds = new Set(stored.map(d => d.messageId));

      const candidates = messages
        .filter(m => m.isUnread && !knownIds.has(m.id))
        .slice(0, MAX_PER_POLL);

      if (candidates.length === 0) {
        setLastPolledAt(new Date());
        return;
      }

      const rawText = gmailToTriageText(candidates);
      const batch = await enqueueClaudeCall(() =>
        triageEmails(settings, persona, rawText),
      );

      const newDrafts: ShadowDraft[] = [];
      for (const triaged of batch.emails) {
        if (!triaged.needsReply || triaged.importance === 'spam' || !triaged.draftReply) {
          continue;
        }

        // e1 → index 0, e2 → index 1, …
        const idx = parseInt(triaged.id.replace(/\D/g, ''), 10) - 1;
        const msg =
          candidates[idx] ??
          candidates.find(m => triaged.from.includes(m.from.split('<')[0].trim()));
        if (!msg) continue;

        newDrafts.push({
          messageId: msg.id,
          threadId: msg.threadId,
          subject: msg.subject,
          from: msg.from,
          draftText: triaged.draftReply,
          importance: triaged.importance,
          summary: triaged.summary,
          generatedAt: new Date().toISOString(),
          personaId: persona.id,
        });
      }

      if (newDrafts.length > 0) {
        setDrafts(prev => {
          const updated = [...newDrafts, ...prev].slice(0, MAX_STORED);
          saveDrafts(updated);
          return updated;
        });
      }

      setLastPolledAt(new Date());
    } catch (err) {
      console.error('[ShadowSecretary] poll error:', err);
    } finally {
      pollingRef.current = false;
      setIsPolling(false);
    }
  }, [settings, persona]);

  // Gmail 接続済みの場合のみポーリング開始
  useEffect(() => {
    if (!isGmailConnected()) return;
    const initial = setTimeout(() => runPoll(), 3_000);
    const interval = setInterval(() => runPoll(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [runPoll]);

  const refresh = useCallback(() => runPoll(), [runPoll]);

  const dismissDraft = useCallback((messageId: string) => {
    setDrafts(prev => {
      const updated = prev.map(d =>
        d.messageId === messageId ? { ...d, dismissed: true } : d,
      );
      saveDrafts(updated);
      return updated;
    });
  }, []);

  const sendDraft = useCallback(
    async (messageId: string, overrideText?: string) => {
      const draft = drafts.find(d => d.messageId === messageId);
      if (!draft) return;
      const body = overrideText ?? draft.draftText;
      await sendReply({
        threadId: draft.threadId,
        to: draft.from,
        subject: /^re:/i.test(draft.subject)
          ? draft.subject
          : `Re: ${draft.subject}`,
        body,
        inReplyTo: `<${messageId}@mail.gmail.com>`,
        references: `<${messageId}@mail.gmail.com>`,
      });
      setDrafts(prev => {
        const updated = prev.map(d =>
          d.messageId === messageId ? { ...d, sent: true } : d,
        );
        saveDrafts(updated);
        return updated;
      });
    },
    [drafts],
  );

  return {
    drafts: activeDrafts,
    isPolling,
    lastPolledAt,
    refresh,
    dismissDraft,
    sendDraft,
  };
}
