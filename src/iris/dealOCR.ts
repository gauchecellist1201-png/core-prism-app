// ============================================================
// IRIS — Deal OCR (案件スクショ/メール画像 → AI が構造化)
// ============================================================
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType, DealStage } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface ExtractedDeal {
  brandName?: string;
  agencyName?: string;
  productName?: string;
  platform?: Platform;
  contentType?: ContentType;
  fee?: number;
  usageFee?: number;
  deliverables?: string;
  draftDeadline?: string;     // ISO
  postDeadline?: string;
  reportDeadline?: string;
  contactName?: string;
  contactEmail?: string;
  guidelines?: string;
  notes?: string;
  stage?: DealStage;
  /** 信頼度 0-1 */
  confidence?: number;
  /** AI が読み取れなかった理由 (or 注意点) */
  warnings?: string[];
}

/** Vision API で案件画像/メール画像から情報抽出 */
export async function extractDealFromImages(opts: {
  settings: AppSettings;
  images: { data: string; mediaType: string }[];
  textHint?: string;        // 音声で補足したテキスト等
}): Promise<ExtractedDeal> {

  const sys = `あなたは「インフルエンサー案件メール/DM/オファーレター/SNS DM のスクリーンショット」を読んで、案件情報を構造化する AI。

返答は JSON のみ (説明文・コードブロック禁止):
{
  "brandName": "ブランド/会社名",
  "agencyName": "代理店名 (あれば)",
  "productName": "商品/キャンペーン名",
  "platform": "instagram|tiktok|youtube|x|threads|note|multi",
  "contentType": "reel|story|post|short|longform|tweet|live|article",
  "fee": 数字 (税抜・円),
  "usageFee": 数字 (二次利用料、あれば),
  "deliverables": "納品物の文章 (例: フィード1本+ストーリー3本)",
  "draftDeadline": "YYYY-MM-DDTHH:mm" (下書き提出期限、なければ omit),
  "postDeadline": "YYYY-MM-DDTHH:mm" (本投稿期限),
  "reportDeadline": "YYYY-MM-DDTHH:mm" (レポート提出期限),
  "contactName": "担当者名",
  "contactEmail": "メールアドレス",
  "guidelines": "ハッシュタグ・必須記載・NGワード等",
  "notes": "他のメモ (商品の特徴、相手の好み等)",
  "stage": "inquiry" (打診段階なら inquiry、明確に契約済みなら contracted),
  "confidence": 0.0-1.0 (どれくらい正確に読み取れたか),
  "warnings": ["読み取れなかった項目や注意点"]
}

## 抽出ルール
- 文中に明示されてない項目は省略 (空文字でも null でもなく、フィールド自体を省く)
- 金額は税込/税抜混在の可能性 → 税抜を優先 (記載なら明示)
- 日付はメール本文から取れるなら最優先、Subject から取れるなら次点
- ガイドライン: #PR / #ad / @タグ / NGワード があれば guidelines に
- ${toneInstruction()}

## 詐欺・怪しい案件への注意
- 法人ドメインなしの個人 Gmail
- 急かし表現
- 過度な無償依頼
これらは warnings に明記する`;

  const content: any[] = [];
  // 画像を先に
  for (const img of opts.images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.data },
    });
  }
  // テキストヒント (音声で補足など)
  const textBlock = opts.textHint
    ? `## 補足情報 (音声入力など)\n${opts.textHint}\n\n上記画像 + 補足から JSON で抽出してください。`
    : `上記画像から案件情報を JSON で抽出してください。`;
  content.push({ type: 'text', text: textBlock });

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2000,
        system: sys,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `案件読取APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return { confidence: 0, warnings: ['AI 応答が JSON として解析できませんでした'] };
  }
}

/** 音声/テキストから案件抽出 (画像なし) */
export async function extractDealFromText(opts: {
  settings: AppSettings;
  text: string;
}): Promise<ExtractedDeal> {

  const sys = `あなたはインフルエンサー本人の「ざっくりした口頭メモ」を聞いて、案件情報に構造化する AI。

返答は JSON のみ:
{
  "brandName": "...", "agencyName": "...", "productName": "...",
  "platform": "instagram|tiktok|youtube|x|threads|note|multi",
  "contentType": "reel|story|post|short|longform|tweet|live|article",
  "fee": 数字, "usageFee": 数字,
  "deliverables": "...",
  "draftDeadline": "YYYY-MM-DDTHH:mm",
  "postDeadline": "YYYY-MM-DDTHH:mm",
  "reportDeadline": "YYYY-MM-DDTHH:mm",
  "contactName": "...", "contactEmail": "...",
  "guidelines": "...", "notes": "...",
  "stage": "inquiry|negotiating|contracted|drafting|...",
  "confidence": 0.0-1.0,
  "warnings": ["..."]
}

## 例: 「資生堂から Instagram リール 1 本、8 万円、5 月 20 日が下書き、5 月 25 日投稿」
→ brandName:"資生堂", platform:"instagram", contentType:"reel", fee:80000, draftDeadline:"2025-05-20T...", postDeadline:"2025-05-25T..."

## 例: 「明日のリール」「来週まで」など相対日付
→ 今日の日付 (${new Date().toISOString().slice(0, 10)}) を基準に絶対日付に変換
- 「今日」: ${new Date().toISOString().slice(0, 10)}
- 「明日」: ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
- 「来週」: 7 日後

${toneInstruction()}`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: opts.text }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `案件抽出APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return { confidence: 0, warnings: ['AI 応答が JSON として解析できませんでした'] };
  }
}
