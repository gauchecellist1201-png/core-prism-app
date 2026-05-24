// ============================================================
// IRIS — DM スクショから「複数のファン」を抽出するヘルパー
//
// DM 一覧 (受信箱) のスクショ 1〜3 枚から、差出人 (= ファン候補) を
// 複数まとめて取り出す。1 つの DM スレッドから 1 名を抽出する
// `dealCapture.ts` とは別目的: こちらは "受信箱 / 一覧" 用。
//
// /api/ai (Claude Vision) を直接叩く形にして、deal の OCR 側ロジックを
// 触らずに済むようにしてある。
// ============================================================

import { enqueueClaudeCall } from '../lib/apiQueue';

export interface CapturedFanCandidate {
  name: string;
  handle: string;         // @username (@ 含む)
  platform: 'Instagram' | 'TikTok' | 'X' | 'Threads' | 'その他';
  lastMessage?: string;   // プレビュー文 (一覧画面に出てるアレ)
  tagGuess?: 'スーパーファン' | '長期ファン' | '新規' | '個人的友人';
}

export type FanCaptureResult =
  | { ok: true; fans: CapturedFanCandidate[]; imageCount: number }
  | { ok: false; error: string; message: string; recovery: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    r.readAsDataURL(file);
  });
}

const SYS = `あなたは Instagram / TikTok / X の DM 一覧画面のスクリーンショットを読み取って、
そこに写っている「ファン候補 (差出人)」を全員リストアップする AI です。

返答は JSON のみ (前置きや説明文、コードブロックは禁止):
{
  "fans": [
    {
      "name": "表示名 (例: さくら, Yuki Suzuki)。必須",
      "handle": "@ から始まるハンドル (例: @sakura_fan)。@ を含める。@ 不明なら表示名から推定",
      "platform": "Instagram" | "TikTok" | "X" | "Threads" | "その他",
      "lastMessage": "プレビュー (一覧画面に表示されている最新の本文。30 字以内に省略)。なければ省略",
      "tagGuess": "スーパーファン" | "長期ファン" | "新規" | "個人的友人" | null
        (DM 内容の温度感から推定。'毎日コメくれる' 系→スーパーファン、'はじめまして'→新規 など)
    }
  ]
}

ルール:
- 同一人物は 1 件だけ (重複排除)
- ブランド / 公式アカウント (verified, kg, 株式会社 等が露骨) は除外
- 自分の bot や spam も除外
- name は推測でも可、handle は不明なら表示名をローマ字に変換して @ を付ける
- 最低 1 人、最大 20 人`;

/** DM 受信箱スクショ (1〜3 枚) → ファン候補リスト */
export async function captureFansFromScreenshots(files: File[]): Promise<FanCaptureResult> {
  if (!files || files.length === 0) {
    return { ok: false, error: 'no_image', message: '画像が選ばれていません', recovery: 'PNG / JPEG / WebP の DM 一覧スクショを選んでください' };
  }
  if (files.length > 3) {
    return { ok: false, error: 'too_many', message: 'スクショは 3 枚までです', recovery: '長いリストは 3 枚に分けて選び直してください' };
  }

  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      return { ok: false, error: 'invalid_type', message: '画像ファイル以外は扱えません', recovery: 'PNG / JPEG / WebP の画像を選んでください' };
    }
    if (f.size > 12 * 1024 * 1024) {
      return { ok: false, error: 'too_large', message: '画像が大きすぎます (1 枚 12MB 以下)', recovery: 'iPhone なら「写真をトリミング」してから送ってください' };
    }
  }

  let dataUrls: string[];
  try {
    dataUrls = await Promise.all(files.map(fileToDataUrl));
  } catch (e: any) {
    return { ok: false, error: 'read_failed', message: e?.message || '画像の読み込みに失敗しました', recovery: 'もう一度ファイルを選び直してください' };
  }

  try {
    const content: any[] = dataUrls.map(url => {
      const m = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
      const mediaType = m?.[1] || 'image/png';
      const data = m?.[2] || '';
      return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
    });
    content.push({ type: 'text', text: 'この DM 一覧スクショに写っている差出人を全員リストアップしてください。' });

    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1800,
          system: SYS,
          messages: [{ role: 'user', content }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    });

    const text = data?.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: 'parse', message: 'AI の返答を解析できませんでした', recovery: 'もう一度試してみてください' };
    const parsed = JSON.parse(m[0]);
    const raw = Array.isArray(parsed.fans) ? parsed.fans : [];
    const fans: CapturedFanCandidate[] = raw
      .filter((f: any) => f && (f.name || f.handle))
      .map((f: any) => ({
        name: (f.name || f.handle || '').trim(),
        handle: ((f.handle || '').trim().startsWith('@') ? f.handle.trim() : '@' + (f.handle || f.name || '').replace(/[^A-Za-z0-9_\.]/g, '').toLowerCase()) || '@unknown',
        platform: ['Instagram', 'TikTok', 'X', 'Threads'].includes(f.platform) ? f.platform : 'その他',
        lastMessage: typeof f.lastMessage === 'string' && f.lastMessage.trim() ? f.lastMessage.trim().slice(0, 60) : undefined,
        tagGuess: ['スーパーファン', '長期ファン', '新規', '個人的友人'].includes(f.tagGuess) ? f.tagGuess : undefined,
      }))
      .slice(0, 20);

    if (fans.length === 0) {
      return { ok: false, error: 'empty', message: '差出人を見つけられませんでした', recovery: 'DM 一覧画面が写っているか確認して、もう一度試してみてください' };
    }
    return { ok: true, fans, imageCount: dataUrls.length };
  } catch (e: any) {
    return { ok: false, error: 'network', message: e?.message || 'ネットワークエラー', recovery: '電波の良いところで再試行してください' };
  }
}

/** CSV テキスト (handle,name,tags,lastContact) を行配列にパース */
export interface CsvFanRow {
  handle: string;
  name: string;
  tags: string[];
  lastContact?: string;
}

export function parseFanCsv(text: string): CsvFanRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // ヘッダ行を判定 (handle/name の文字が入ってるかで判定)
  const first = lines[0].toLowerCase();
  const startIdx = (first.includes('handle') || first.includes('name')) ? 1 : 0;

  const rows: CsvFanRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 0) continue;
    const handleRaw = (cells[0] || '').trim();
    const name = (cells[1] || handleRaw).trim();
    const tagsRaw = (cells[2] || '').trim();
    const lastContact = (cells[3] || '').trim() || undefined;
    const handle = handleRaw.startsWith('@') ? handleRaw : '@' + handleRaw.replace(/[^A-Za-z0-9_\.]/g, '').toLowerCase();
    if (!handle || handle === '@') continue;
    const tags = tagsRaw.split(/[;|,]/).map(t => t.trim()).filter(Boolean);
    rows.push({ handle, name: name || handle, tags, lastContact });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  // 簡易 CSV: クオート対応
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === '\t') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
