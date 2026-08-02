// 会議の書き起こしを「途中でも失わない」ための下書き保存。
// 画面を消した・別のアプリに切り替えた・電話が来た・タブが落ちた —
// どれが起きても、そこまでの文字は端末の中に残しておく。
// 保存はローカルのみ（送信しない）。

const KEY = 'core-prism:meeting-draft:v1';

export interface MeetingDraftSegment {
  id: string;
  speaker: number;
  text: string;
  startMs: number;
}

export interface MeetingDraft {
  savedAt: number;              // 最後に保存した時刻（ミリ秒）
  title: string;
  participants: string;
  segments: MeetingDraftSegment[];
  speakerNames: Record<number, string>;
  recordingMs: number;          // 録音の長さ
}

/** 下書きに意味のある中身があるか（空の保存で上書きしないための判定） */
export function draftHasContent(d: MeetingDraft | null): d is MeetingDraft {
  return !!d && d.segments.some(s => s.text.trim().length > 0);
}

/** 下書きの文字数（画面に出す「◯文字」用・実測値のみ） */
export function draftCharCount(d: MeetingDraft): number {
  return d.segments.reduce((n, s) => n + s.text.trim().length, 0);
}

export function saveMeetingDraft(d: MeetingDraft): void {
  if (!draftHasContent(d)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // 容量オーバー / プライベートモード — 保存できなくても録音は止めない
  }
}

export function loadMeetingDraft(): MeetingDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as MeetingDraft;
    if (!d || !Array.isArray(d.segments)) return null;
    // 壊れた行は落として、読める行だけ返す
    const segments = d.segments.filter(
      (s): s is MeetingDraftSegment =>
        !!s && typeof s.text === 'string' && typeof s.speaker === 'number',
    );
    const draft: MeetingDraft = {
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
      title: typeof d.title === 'string' ? d.title : '',
      participants: typeof d.participants === 'string' ? d.participants : '',
      segments,
      speakerNames: (d.speakerNames && typeof d.speakerNames === 'object') ? d.speakerNames : {},
      recordingMs: typeof d.recordingMs === 'number' ? d.recordingMs : 0,
    };
    return draftHasContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function clearMeetingDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}

/** 「8月3日 1:20」のような、読んで分かる時刻表記 */
export function formatDraftTime(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
