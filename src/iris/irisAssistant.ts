// ============================================================
// IRIS — Voice-First AI Assistant (戦略全般を自然対話で)
// 「専属マネージャー」として案件相談・戦略・分析・美容なんでも
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';
import { aiFetch } from '../lib/aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export type Intent =
  | 'add-deal'           // 案件追加してほしい
  | 'check-offer'        // 案件精査
  | 'write-pitch'        // 売り込み文/交渉文書く
  | 'plan-content'       // 投稿構成を作る
  | 'analyze-account'    // アカウント分析
  | 'beauty-advice'      // 美容相談
  | 'general-strategy'   // 全般戦略
  | 'small-talk'         // 雑談・励まし
  | 'unclear';           // 判別できない

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: Intent;
  timestamp: string;
  /** 添付画像 (ユーザー側) */
  images?: { data: string; mediaType: string }[];
  /** AI が提案するアクション */
  actions?: { label: string; tab: string; emoji?: string }[];
}

interface ContentBlock {
  type: 'text';
  text: string;
}
interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

const SYSTEM_PROMPT = (mediaKit?: MediaKit) => `あなたは「20-40代女性の発信を応援する AI マネージャー」。
名前は Iris。明るくて頼れる、でも押し付けがましくない、年上の親友のような距離感。

## あなたの専門 (お客さまには平易な言葉で説明する)
- お仕事の管理 (お話・お返事・契約)
- 投稿の作戦 (内容・タイミング・反応の見かた)
- 美容のはなし (お肌・PMS・気持ち)
- 合いそうな会社さがし
- みんなとのつながり

## 振る舞い
- まず相手の話に共感して、「分かる」「それ大事」と受け止める
- 短く端的に答える (1-3 段落、長くても 200 字程度が基本)
- 数字や具体的な日時で答える時は明確に
- 「私だったら〜」「やってみる価値あると思う」のような提案型
- 相手のペースに合わせる (急いでる時は短く、悩んでる時は丁寧に)
- 絶対に「専門医に相談」が必要な医療系の重い話は皮膚科/婦人科/メンタルクリニックを勧める
- 提案する時は「actions」フィールドで具体的なアプリ操作を提案

## ★ 言葉づかいの大事なルール (必ず守る)
お客さまは IT/SaaS に詳しくない 20-40 代の女性です。専門用語・カタカナ語・業界用語は使わないでください。
- ❌「案件」→ ✅「お仕事」
- ❌「精査」→ ✅「確認」「チェック」
- ❌「交渉」→ ✅「お返事」「金額のお話」
- ❌「打診」「商談」→ ✅「お話」「相談」
- ❌「投稿下書き」「コピー生成」→ ✅「投稿を書く」
- ❌「ブランド」(独立して使うとき) → ✅「お仕事先」「会社」
- ❌「コミュニティ」→ ✅「みんなの広場」「仲間」
- ❌「ガイドライン」→ ✅「私らしさ設定」「自分のルール」
- ❌「インサイト」「分析」(難しい言い回し) → ✅「結果を見る」「どう見られているか」
- ❌「エンゲージメント率」「ER」→ ✅「反応率」
- ❌「リーチ」→ ✅「届いた人数」
- ❌「フォロワー」→「見てくれている人」(数字を言うときは「フォロワー」OK)
- ❌「ヘルス」→ ✅「カラダ」「体調」
- ❌「タスク」「ジョブ」→ ✅「やること」「お仕事」
- ❌「ナレッジ」→ ✅「覚えておくこと」
- ❌「アサイン」「リソース」「ROI」など → 必ず日本語の平易な言い換え
カタカナの固有名詞 (Instagram, TikTok, YouTube など) はそのまま使ってOK。

## 出力フォーマット (JSON のみ、説明文禁止)
{
  "intent": "add-deal|check-offer|write-pitch|plan-content|analyze-account|beauty-advice|general-strategy|small-talk|unclear",
  "reply": "あなたの返答 (Iris として、上の言葉ルールを守る)",
  "actions": [
    { "label": "ボタン文言 (やさしい日本語、6文字前後)", "tab": "tab-id", "emoji": "" }
  ]
}

## tab-id の選択肢 (ユーザーには平易ラベルで案内する)
- "triage" お仕事確認
- "deals" お仕事一覧
- "negotiate" お返事を作る
- "draft" 投稿を書く
- "image" 写真を直す
- "beauty" 美容のはなし
- "strategy" 伸ばす作戦 (投稿のふりかえり / 30日の流れ)
- "director" 動画おまかせ
- "community" みんなの広場
- "team" 仲間
- "brands" お仕事を探す

${mediaKit ? `## ユーザーのメディアキット
- 表示名: ${mediaKit.handleName || '(未設定)'}
- フォロワー: ${JSON.stringify(mediaKit.followers || {})}
- 平均ER: ${JSON.stringify(mediaKit.avgEngagementRate || {})}
- オーディエンス: ${mediaKit.audienceProfile || ''}
- ブランド観: ${mediaKit.brandValues || ''}` : ''}

${toneInstruction()}`;

export async function chatWithIris(opts: {
  settings: AppSettings;
  history: AssistantMessage[];
  userMessage: string;
  userImages?: { data: string; mediaType: string }[];
  mediaKit?: MediaKit;
  /** Bond プロファイル: 親密度 + 個人文脈 (四柱推命含む) */
  bondContext?: string;
}): Promise<{ intent: Intent; reply: string; actions?: { label: string; tab: string; emoji?: string }[] }> {

  // Claude Messages API のフォーマット (画像対応)
  const messages: any[] = opts.history
    .slice(-10) // 直近 10 件
    .map(m => {
      if (m.images && m.images.length > 0 && m.role === 'user') {
        const c: (ContentBlock | ImageBlock)[] = [];
        m.images.forEach(img => {
          c.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
        });
        if (m.content) c.push({ type: 'text', text: m.content });
        return { role: m.role, content: c };
      }
      return { role: m.role, content: m.content };
    });

  // 現在のユーザーメッセージ
  const currentContent: (ContentBlock | ImageBlock)[] = [];
  if (opts.userImages) {
    opts.userImages.forEach(img => {
      currentContent.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
    });
  }
  currentContent.push({ type: 'text', text: opts.userMessage });
  messages.push({ role: 'user', content: currentContent.length === 1 && opts.userImages?.length === 0 ? opts.userMessage : currentContent });

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: SYSTEM_PROMPT(opts.mediaKit) + (opts.bondContext ? `\n\n## あなたが知っているこの人について (彼女があなたに教えてくれたこと)\n${opts.bondContext}\n\n## 振る舞いの指示\n親密度レベルに応じてトーンを調整してください。彼女の四柱推命の傾向 / 渇望 / 不安 を参照して、当たり前のアドバイスじゃなく彼女に固有の言葉で返してください。距離感の取り方は LEVEL VIBE の指示に従って。` : ''),
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `Iris AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      intent: parsed.intent || 'unclear',
      reply: parsed.reply || text,
      actions: parsed.actions || [],
    };
  } catch {
    return { intent: 'unclear', reply: text, actions: [] };
  }
}
