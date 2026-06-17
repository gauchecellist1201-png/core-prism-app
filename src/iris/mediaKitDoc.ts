// ============================================================
// CORE Iris — メディアキット（自動生成）
// 「私のプロフィール」に入れた数字や一言から、ブランドにそのまま
// 送れる "美しいメディアキット" の文章を AI が書き起こす。
// 手入力ゼロで、企業に刺さる自己紹介・強み・コラボ提案を用意する。
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit, Platform } from '../types/influencerDeal';
import { PLATFORM_META } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

export interface MediaKitDoc {
  /** 一言キャッチ（肩書き的なフレーズ） */
  tagline: string;
  /** プロのプロフィール紹介文（2〜3文・敬体） */
  intro: string;
  /** 強み 3 点 */
  strengths: { title: string; detail: string }[];
  /** オーディエンス像（整えた説明文） */
  audience: string;
  /** ブランドが一緒にやる価値（提案の核） */
  whyCollab: string;
  /** コラボの形（提案フォーマット） */
  collabFormats: { title: string; detail: string }[];
  /** 締めの一言（問い合わせを促す） */
  closing: string;
}

/** 数字サマリ（フォロワー/ER）を読みやすい行に */
export function mediaKitStats(kit?: MediaKit): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (!kit) return out;
  const platforms: Platform[] = ['instagram', 'tiktok', 'youtube', 'x'];
  for (const p of platforms) {
    const f = kit.followers?.[p];
    if (f && f > 0) {
      const er = kit.avgEngagementRate?.[p];
      out.push({
        label: PLATFORM_META[p].label,
        value: `${f.toLocaleString()}人${er ? ` ・ 反応率${er}%` : ''}`,
      });
    }
  }
  if (kit.monthlyReach && kit.monthlyReach > 0) {
    out.push({ label: '月間リーチ', value: `${kit.monthlyReach.toLocaleString()}` });
  }
  return out;
}

function kitFacts(kit?: MediaKit): string {
  const lines: string[] = [];
  if (kit?.handleName) lines.push(`- 表示名: ${kit.handleName}`);
  const stats = mediaKitStats(kit);
  if (stats.length) lines.push(`- 数字: ${stats.map(s => `${s.label} ${s.value}`).join(' / ')}`);
  if (kit?.audienceProfile) lines.push(`- よく見てくれる人: ${kit.audienceProfile}`);
  if (kit?.caseHistory) lines.push(`- 過去案件: ${kit.caseHistory}`);
  if (kit?.rateCard) lines.push(`- 希望金額の目安: ${kit.rateCard}`);
  if (kit?.brandValues) lines.push(`- 大切にしたいこと・NG: ${kit.brandValues}`);
  if (kit?.entity) lines.push(`- 形態: ${kit.entity === 'corporate' ? '法人' : '個人'}`);
  if (kit?.legalName) lines.push(`- 屋号/会社名: ${kit.legalName}`);
  return lines.length ? lines.join('\n') : '(ほとんど未入力。一般的なクリエイターとして、無理に数字を作らず書いてください)';
}

/** メディアキットの文章を生成 */
export async function generateMediaKitDoc(opts: {
  settings: AppSettings;
  mediaKit?: MediaKit;
}): Promise<MediaKitDoc> {
  const sys = `あなたは、インフルエンサーが企業に送る「メディアキット（自己紹介資料）」をプロのコピーライターとして書き起こす担当です。
出力は JSON のみ:
{
  "tagline": "一言キャッチ（肩書き的に。15文字前後）",
  "intro": "プロフィール紹介文。敬体で2〜3文。企業の担当者が読んで安心・期待できるトーン",
  "strengths": [{"title": "強みの見出し（短く）", "detail": "1〜2文の説明"}],
  "audience": "よく見てくれる人の像を、企業がイメージしやすい言葉で1〜2文",
  "whyCollab": "このクリエイターと組むと企業に何が起きるか。提案の核を2〜3文",
  "collabFormats": [{"title": "コラボの形（例: フィード投稿 / リール / ストーリーズ連投 / 商品レビュー）", "detail": "中身と狙いを1文"}],
  "closing": "締めの一言。問い合わせを優しく促す1文"
}

## ルール
- strengths は 3 点、collabFormats は 3〜4 点。
- 与えられた数字（フォロワー・反応率）は誇張しない。無い数字は作らない。数字が無ければ「数」ではなく「らしさ・世界観・関係性の濃さ」で価値を語る。
- 押し売りにならない。「一緒に良いものを作りたい」という対等で誠実なトーン。
- 専門用語・横文字を避け、やさしい日本語で。読み手は企業のSNS担当者。
- 絵文字は使わない。
- 全体で「この人にお願いしたい」と思わせる、温度のある文章に。

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 私の情報（メディアキットの素材）
${kitFacts(opts.mediaKit)}

この情報から、企業にそのまま送れるメディアキットの文章を書いてください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2200,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `メディアキット生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : text);
  return {
    tagline: parsed.tagline || '',
    intro: parsed.intro || '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
    audience: parsed.audience || '',
    whyCollab: parsed.whyCollab || '',
    collabFormats: Array.isArray(parsed.collabFormats) ? parsed.collabFormats.slice(0, 4) : [],
    closing: parsed.closing || '',
  };
}

/** メディアキットを、企業に送れる Markdown に整形 */
export function mediaKitDocToMarkdown(doc: MediaKitDoc, kit?: MediaKit): string {
  const stats = mediaKitStats(kit);
  const lines: string[] = [];
  lines.push(`# ${kit?.handleName || 'メディアキット'}`);
  if (doc.tagline) lines.push(`*${doc.tagline}*`);
  lines.push('');
  if (doc.intro) { lines.push(doc.intro); lines.push(''); }
  if (stats.length) {
    lines.push('## 数字');
    for (const s of stats) lines.push(`- ${s.label}: ${s.value}`);
    lines.push('');
  }
  if (doc.strengths.length) {
    lines.push('## 強み');
    for (const s of doc.strengths) lines.push(`- **${s.title}** — ${s.detail}`);
    lines.push('');
  }
  if (doc.audience) { lines.push('## よく見てくれる人'); lines.push(doc.audience); lines.push(''); }
  if (doc.whyCollab) { lines.push('## 一緒にできること'); lines.push(doc.whyCollab); lines.push(''); }
  if (doc.collabFormats.length) {
    lines.push('## コラボの形');
    for (const c of doc.collabFormats) lines.push(`- **${c.title}** — ${c.detail}`);
    lines.push('');
  }
  if (kit?.rateCard) { lines.push('## 金額の目安'); lines.push(kit.rateCard); lines.push(''); }
  if (doc.closing) lines.push(doc.closing);
  return lines.join('\n').trim();
}
