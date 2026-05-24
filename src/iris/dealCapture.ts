// ============================================================
// IRIS — DM スクショ → 案件抽出 (クライアントヘルパー)
//
// 使い方:
//   const result = await captureDealFromScreenshots([file1, file2]);
//   if (result.ok) { addDeal(personaId, toDealInput(result.deal)); }
// ============================================================

export interface CapturedDeal {
  brandName: string | null;
  senderHandle: string | null;
  contactName: string | null;
  category: string | null;
  fee: number | null;
  requirements: string | null;
  deadline: string | null;
  summary: string;
  rawText: string;
}

export type CaptureResult =
  | {
      ok: true;
      deal: CapturedDeal;
      confidence: 'high' | 'medium' | 'low';
      weakFields: string[];
      followUpQuestions: string[];
      imageCount: number;
    }
  | { ok: false; error: string; message: string; recovery: string; rawText?: string };

/** File を dataURL に変換 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    r.readAsDataURL(file);
  });
}

/** 互換のため 1 枚版も残す */
export async function captureDealFromScreenshot(file: File): Promise<CaptureResult> {
  return captureDealFromScreenshots([file]);
}

/** DM スクショ 1〜3 枚から案件情報を抽出 */
export async function captureDealFromScreenshots(files: File[]): Promise<CaptureResult> {
  if (!files || files.length === 0) {
    return {
      ok: false, error: 'no_image',
      message: '画像が選ばれていません',
      recovery: 'PNG / JPEG / WebP のファイルを選んでください',
    };
  }
  if (files.length > 3) {
    return {
      ok: false, error: 'too_many',
      message: 'スクショは 3 枚までです',
      recovery: '長い DM の場合は、上から順に 3 枚に分けて選び直してください',
    };
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return {
        ok: false, error: 'invalid_type',
        message: '画像ファイル以外は扱えません',
        recovery: 'PNG / JPEG / WebP の画像を選んでください',
      };
    }
    if (file.size > 12 * 1024 * 1024) {
      return {
        ok: false, error: 'too_large',
        message: '画像が大きすぎます (1 枚 12MB 以下)',
        recovery: 'iPhone なら「写真を撮ってトリミング」してから送ってください',
      };
    }
  }

  let imageDataUrls: string[];
  try {
    imageDataUrls = await Promise.all(files.map(fileToDataUrl));
  } catch (e: any) {
    return {
      ok: false, error: 'read_failed',
      message: e?.message || '画像の読み込みに失敗しました',
      recovery: 'もう一度ファイルを選び直してください',
    };
  }

  try {
    const res = await fetch('/api/iris/extract-deal-from-screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrls }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || 'extraction_failed',
        message: data?.message || `読み取りに失敗しました (HTTP ${res.status})`,
        recovery: data?.recovery || '明るく、文字がはっきり見えるスクショで再試行してください',
        rawText: data?.rawText,
      };
    }
    return {
      ok: true,
      deal: data.deal as CapturedDeal,
      confidence: (data.confidence as 'high' | 'medium' | 'low') || 'medium',
      weakFields: Array.isArray(data.weakFields) ? data.weakFields : [],
      followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [],
      imageCount: typeof data.imageCount === 'number' ? data.imageCount : imageDataUrls.length,
    };
  } catch (e: any) {
    return {
      ok: false, error: 'network',
      message: 'ネットワークエラーで読み取れませんでした',
      recovery: '電波の良いところで再試行してください。1 分後に自動で復帰します。',
    };
  }
}

/** 過去の案件の中から似たブランド or 担当者の最近の案件を探す */
export interface SimilarPastDeal {
  brandName: string;
  fee: number;
  contentType?: string;
  deliverables?: string;
  reason: string; // なぜ似ているか (例: "同じブランド", "同じ送り主")
}

export interface PastDealRef {
  brandName: string;
  contactName?: string;
  senderHandle?: string;
  fee: number;
  contentType?: string;
  deliverables?: string;
  category?: string;
  notes?: string;
  createdAt?: string;
}

/** 過去案件配列から、今回の captured と似た最新案件を返す (なければ null) */
export function findSimilarPastDeal(
  current: CapturedDeal,
  past: PastDealRef[],
): SimilarPastDeal | null {
  if (!past || past.length === 0) return null;

  const brand = (current.brandName || '').toLowerCase().trim();
  const handle = (current.senderHandle || '').toLowerCase().trim();
  const contact = (current.contactName || '').toLowerCase().trim();
  const category = (current.category || '').toLowerCase().trim();

  // 新しい順に並び替え
  const sorted = [...past].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // 1. 完全一致するブランド名 (最強)
  if (brand) {
    const hit = sorted.find(p => p.fee > 0 && (p.brandName || '').toLowerCase().trim() === brand);
    if (hit) return {
      brandName: hit.brandName, fee: hit.fee,
      contentType: hit.contentType, deliverables: hit.deliverables,
      reason: `過去に同じ「${hit.brandName}」案件があります`,
    };
  }
  // 2. 送り主ハンドル / 担当者名 で一致
  if (handle) {
    const hit = sorted.find(p => p.fee > 0 && (p.senderHandle || '').toLowerCase().trim() === handle);
    if (hit) return {
      brandName: hit.brandName, fee: hit.fee,
      contentType: hit.contentType, deliverables: hit.deliverables,
      reason: `同じ送り主 (${handle}) との案件履歴があります`,
    };
  }
  if (contact) {
    const hit = sorted.find(p => p.fee > 0 && (p.contactName || '').toLowerCase().trim() === contact);
    if (hit) return {
      brandName: hit.brandName, fee: hit.fee,
      contentType: hit.contentType, deliverables: hit.deliverables,
      reason: `同じ担当者「${hit.contactName}」との案件履歴があります`,
    };
  }
  // 3. 同じカテゴリ で最も新しいもの (弱い)
  if (category) {
    const hit = sorted.find(p => p.fee > 0 && (p.category || '').toLowerCase().trim() === category);
    if (hit) return {
      brandName: hit.brandName, fee: hit.fee,
      contentType: hit.contentType, deliverables: hit.deliverables,
      reason: `同じカテゴリ「${hit.category}」の過去案件があります`,
    };
  }
  return null;
}

/** rawText / summary から簡易な詐欺・不審シグナルを検出 (LLM 呼ばずに即判定) */
export interface CaptureWarning {
  severity: 'high' | 'medium' | 'low';
  kind: string;
  description: string;
}

export function detectCaptureWarnings(d: CapturedDeal): CaptureWarning[] {
  const warnings: CaptureWarning[] = [];
  const text = `${d.rawText || ''}\n${d.summary || ''}\n${d.requirements || ''}`.toLowerCase();

  // 無償 / サンプルのみ
  if (/無償|無料|ノーギャラ|無料提供|商品提供のみ|サンプル提供のみ|ギフティング|交通費のみ/.test(text)) {
    warnings.push({
      severity: 'high', kind: '無償依頼',
      description: '「無償・サンプル提供のみ」を PR と称している可能性。報酬の確認を。',
    });
  }
  // 急かす表現
  if (/今日中|24時間以内|至急|本日限り|今すぐ返事|締切間近/.test(text)) {
    warnings.push({
      severity: 'medium', kind: '急かす表現',
      description: '「今日中」「24時間以内」など、判断を急がせる文言があります。詐欺によくあるパターン。',
    });
  }
  // 暗号資産 / FX / カジノ
  if (/暗号資産|仮想通貨|ビットコイン|btc|nft|fx|オンラインカジノ|バイナリーオプション|ネットワークビジネス|mlm/.test(text)) {
    warnings.push({
      severity: 'high', kind: '高リスク業種',
      description: '暗号資産 / FX / カジノ / MLM 系の案件は、SNS 規約違反 + 詐欺リスクが高めです。',
    });
  }
  // 連絡先が個人 Gmail
  if (/@gmail\.com|@yahoo\.co\.jp|@icloud\.com|@hotmail\.com/.test(text) && !/会社|株式会社|株式|co\.jp|co\.ltd/.test(text)) {
    warnings.push({
      severity: 'medium', kind: '法人ドメインなし',
      description: '連絡先が個人 Gmail / Yahoo のようです。法人ドメインの確認を。',
    });
  }
  // 振込先が個人口座
  if (/個人口座|個人名義|個人銀行口座/.test(text)) {
    warnings.push({
      severity: 'medium', kind: '個人口座への振込',
      description: '振込先が個人口座のようです。法人口座への変更交渉を推奨。',
    });
  }
  // 出会い系 / 大人向け
  if (/出会い系|アダルト|大人向け|オフパコ|ライブチャット/.test(text)) {
    warnings.push({
      severity: 'high', kind: '出会い系・アダルト',
      description: '出会い系・アダルト系の誘導の可能性。プラットフォーム規約違反になりがち。',
    });
  }
  // 異常に高額 (200 万以上)
  if (typeof d.fee === 'number' && d.fee >= 2_000_000) {
    warnings.push({
      severity: 'low', kind: '高額提示',
      description: '提示額が高めです。契約書 + 振込先の確認をしっかり。',
    });
  }
  return warnings;
}

/** 抽出データを InfluencerDeal の addDeal 入力形式に変換 */
export function capturedDealToDealInput(d: CapturedDeal): {
  brandName: string;
  productName?: string;
  platform: 'instagram';
  contentType: 'reel' | 'post';
  fee: number;
  deliverables: string;
  stage: 'inquiry';
  contactName?: string;
  notes?: string;
} {
  // requirements から contentType を推定
  const req = (d.requirements || '').toLowerCase();
  let contentType: 'reel' | 'post' = 'post';
  if (req.includes('リール') || req.includes('reel')) contentType = 'reel';

  const notesParts: string[] = [];
  if (d.summary) notesParts.push(d.summary);
  if (d.senderHandle) notesParts.push(`送信元: ${d.senderHandle}`);
  if (d.deadline) notesParts.push(`締切: ${d.deadline}`);
  if (d.category) notesParts.push(`カテゴリ: ${d.category}`);

  return {
    brandName: d.brandName || '名称不明のブランド',
    platform: 'instagram',
    contentType,
    fee: d.fee || 0,
    deliverables: d.requirements || d.summary || '',
    stage: 'inquiry',
    contactName: d.contactName || undefined,
    notes: notesParts.join('\n') || undefined,
  };
}
