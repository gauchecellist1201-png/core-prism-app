// ============================================================
// IRIS — DM スクショ → 案件抽出 (クライアントヘルパー)
//
// 使い方:
//   const result = await captureDealFromScreenshot(file);
//   if (result.ok) { useInfluencerDesk().addDeal(personaId, toDealInput(result.deal)); }
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
  | { ok: true; deal: CapturedDeal; confidence: 'high' | 'medium' | 'low' }
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

/** DM スクショ 1 枚から案件情報を抽出 */
export async function captureDealFromScreenshot(file: File): Promise<CaptureResult> {
  if (!file) {
    return {
      ok: false, error: 'no_image',
      message: '画像が選ばれていません',
      recovery: 'PNG / JPEG / WebP のファイルを選んでください',
    };
  }
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
      message: '画像が大きすぎます (12MB 以下)',
      recovery: 'iPhone なら「写真を撮ってトリミング」してから送ってください',
    };
  }

  let imageDataUrl: string;
  try {
    imageDataUrl = await fileToDataUrl(file);
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
      body: JSON.stringify({ imageDataUrl }),
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
    };
  } catch (e: any) {
    return {
      ok: false, error: 'network',
      message: 'ネットワークエラーで読み取れませんでした',
      recovery: '電波の良いところで再試行してください。1 分後に自動で復帰します。',
    };
  }
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
