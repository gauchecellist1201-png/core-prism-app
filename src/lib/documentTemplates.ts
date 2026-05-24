// ============================================================
// documentTemplates — DocumentStudio の文書テンプレ生成
//
// 6 種類のビジネス文書テンプレを Markdown で生成。
// - 提案書 / 議事メモ / レポート / お礼メール / 求人票 / 取引先紹介状
// AI で人格コンテキストを織り込んだ初稿を作る。失敗時は静的テンプレで継続。
// ============================================================
import type { AppSettings, Persona } from '../types/identity';

export type DocTemplateKind =
  | 'proposal'      // 提案書
  | 'memo'          // 議事メモ (会議外メモ)
  | 'report'        // レポート
  | 'thanks'        // お礼メール
  | 'jobPost'       // 求人票
  | 'introLetter';  // 取引先紹介状

export interface DocTemplateMeta {
  kind: DocTemplateKind;
  label: string;
  emoji: string;
  blurb: string;
  /** プレースホルダー入力欄のヒント */
  inputHint: string;
}

export const DOC_TEMPLATE_META: Record<DocTemplateKind, DocTemplateMeta> = {
  proposal: {
    kind: 'proposal', label: '提案書', emoji: '📑',
    blurb: '背景 → 課題 → 解決 → 価格 の 4 章で意思決定者に届く形式',
    inputHint: '例: ◯◯社向け Web リニューアル提案、現状の課題は SEO 流入低下、予算 200 万円想定',
  },
  memo: {
    kind: 'memo', label: '会議外メモ', emoji: '🗒',
    blurb: '会議以外の場で出てきた論点・決め事を残す軽い議事メモ',
    inputHint: '例: ランチでの雑談で出た新サービスの仮説 3 つと次回検討事項',
  },
  report: {
    kind: 'report', label: 'レポート', emoji: '📊',
    blurb: '要約 → 詳細 → 結論 の三層構造で読み手を疲れさせない',
    inputHint: '例: 5 月の SNS 運用結果、フォロワー +320、反応の良かった投稿は…',
  },
  thanks: {
    kind: 'thanks', label: 'お礼メール', emoji: '💌',
    blurb: '商談・会食・面談後の即送り用。短く具体的に',
    inputHint: '例: ◯◯さん、昨日の打ち合わせで紹介いただいた事例について',
  },
  jobPost: {
    kind: 'jobPost', label: '求人票', emoji: '🪪',
    blurb: '仕事内容 / 求める人 / 条件 / 応募方法 を分かりやすく',
    inputHint: '例: フルリモートの Web エンジニア 1 名、Next.js 経験者、業務委託 月 60-80 万',
  },
  introLetter: {
    kind: 'introLetter', label: '取引先紹介状', emoji: '🤝',
    blurb: '人を別の人へつなぐときの紹介文。失礼のない型',
    inputHint: '例: ◯◯さん (デザイナー) を △△社の □□さんに紹介、リブランディングの相談として',
  },
};

/** 静的テンプレ (AI 失敗時の安全ネット) */
export function staticTemplate(kind: DocTemplateKind, persona: Persona, topic: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const t = topic.trim() || '(ここに件名を書く)';
  switch (kind) {
    case 'proposal':
      return `# ${t} ご提案書\n\n発行: ${persona.name} / ${today}\n\n## 1. 背景\n- 現状で起きていること\n- なぜ今このタイミングか\n\n## 2. 課題\n- 解決すべき具体的な論点\n- 放置した場合の損失\n\n## 3. 解決策\n- 提案する打ち手 (1 つに絞る)\n- 進め方とスケジュール\n- 期待できる効果\n\n## 4. 価格・条件\n- 金額: ¥— (税抜)\n- 期間: — 週間\n- 支払い条件: 月末締・翌月末払い\n\n---\n以上、ご検討のほどよろしくお願いいたします。\n${persona.name}\n`;

    case 'memo':
      return `# ${t}\n\n日時: ${today}\n記録: ${persona.name}\n\n## 場面\n- どこで / 誰と / どんな話題が出たか\n\n## 出てきた論点\n- 論点 1\n- 論点 2\n- 論点 3\n\n## 仮の結論\n- いまの段階での考え\n\n## 次の動き\n- [ ] 確認したいこと\n- [ ] 次回までに準備すること\n`;

    case 'report':
      return `# ${t} レポート\n\n作成: ${persona.name} / ${today}\n\n## 要約 (30 秒で読める)\n- ひと言で言うと:\n- 数字で言うと:\n- 次にやること:\n\n## 詳細\n### 1. 何をやったか\n- 期間 / 範囲 / 対象\n\n### 2. 結果\n- 数字とハイライト\n- 想定とのズレ\n\n### 3. 学び\n- うまくいった理由\n- うまくいかなかった理由\n\n## 結論と次の一手\n- 続ける: \n- やめる: \n- 試す: \n`;

    case 'thanks':
      return `件名: 本日はありがとうございました\n\n${t}\n\nお世話になっております。${persona.name}です。\n\n本日はお時間をいただきありがとうございました。\nお話しいただいた中で特に印象に残ったのは、\n— (具体的なポイント 1 つ) —\nという点で、こちらでも早速持ち帰り検討させていただきます。\n\n次のステップとしては、\n— (次のアクション) —\nを進めさせていただければと思います。\n\n引き続きどうぞよろしくお願いいたします。\n\n${persona.name}\n`;

    case 'jobPost':
      return `# ${t} 募集要項\n\n発行: ${persona.name} / ${today}\n\n## 仕事内容\n- メインで担当いただくこと\n- チーム構成 / 関わる人\n\n## 求める人\n- 必須経験\n- あると嬉しい経験\n- 大切にしている価値観\n\n## 条件\n- 雇用形態: \n- 報酬: \n- 勤務地 / リモート可否: \n- 勤務時間: \n\n## 応募方法\n- 応募先: \n- 提出書類: \n- 選考フロー: 書類 → カジュアル面談 → 面接\n\n## 連絡先\n${persona.name}\n`;

    case 'introLetter':
      return `件名: ご紹介させてください\n\n${t}\n\nお世話になっております。${persona.name}です。\n\n本日はぜひお引き合わせしたい方がいて、ご連絡しました。\n\n— (紹介する方の名前 / 所属 / 強み) —\n\nお二人を引き合わせたいと考えた理由は、\n— (なぜつなぐと良いと思ったか) —\nという点です。\n\nご都合のいいタイミングで、まずは 30 分ほどのオンライン顔合わせができればと思います。\n候補日をいくつかいただけますと幸いです。\n\n${persona.name}\n`;
  }
}

const TEMPLATE_INSTRUCTIONS: Record<DocTemplateKind, string> = {
  proposal: '4 章構成 (1.背景 / 2.課題 / 3.解決策 / 4.価格・条件)。それぞれ 3-5 行で具体的に。最後に「ご検討のほどよろしくお願いいたします」で締める。',
  memo: '会議外で出た雑談・気づきを残す軽い記録。「場面」「出てきた論点」「仮の結論」「次の動き」の 4 セクション。決定事項ではなく仮説段階の温度で。',
  report: '要約 (30 秒で読める版) → 詳細 (何をやったか / 結果 / 学び) → 結論と次の一手、の三層。要約は箇条書き 3 行以内。',
  thanks: 'メール 1 通の長さ (10-15 行)。件名から始める。冒頭「本日はありがとうございました」、本文に具体的に印象に残ったポイントを 1 つ、最後に次のアクション。',
  jobPost: '「仕事内容 / 求める人 / 条件 / 応募方法」の 4 セクション。読み手は応募者。専門用語を使わず、フランクに、でもプロらしく。',
  introLetter: 'メール 1 通形式。件名は「ご紹介させてください」など。紹介相手の強みと「なぜつなぐと良いと思ったか」を必ず含める。最後に候補日相談の文を入れる。',
};

/** AI でテンプレを生成。失敗時は静的テンプレを返す */
export async function generateTemplateDoc(
  settings: AppSettings,
  persona: Persona,
  kind: DocTemplateKind,
  topic: string,
): Promise<{ markdown: string; usedAI: boolean }> {
  const meta = DOC_TEMPLATE_META[kind];
  const instruction = TEMPLATE_INSTRUCTIONS[kind];

  const sys = `あなたは ${persona.name} (${persona.subtitle}) のビジネス文書アシスタントです。
読み手の頭にすっと入る、敬意のある自然な日本語で文書を書きます。
返答は **Markdown のみ** (コードブロック・前置き・説明文なし)。
専門用語を使うときは括弧で和訳を添える。`;

  const user = `次のテーマで「${meta.label}」を Markdown で書いてください。

# テーマ / 状況
${topic.trim() || '(具体的内容は未指定。一般的な雛形でよい)'}

# 発行者
${persona.name} (${persona.subtitle})
${persona.description || ''}

# 書式ルール
${instruction}

# 大事な姿勢
- 押し付けない、でも具体的に
- 数字や固有名詞があれば積極的に入れる
- 「〜のはずです」「〜してみます」のような柔らかい語り口
- 全体 30 行前後 (お礼メール・紹介状は 15-20 行)`;

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 2000,
        system: sys,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? '';
    const cleaned = text.replace(/^```(?:markdown|md)?\n?/i, '').replace(/```\s*$/m, '').trim();
    if (!cleaned) throw new Error('empty');
    return { markdown: cleaned, usedAI: true };
  } catch {
    return { markdown: staticTemplate(kind, persona, topic), usedAI: false };
  }
}

// ============================================================
// 最小 Markdown → HTML transformer (依存追加なし)
// 完全な仕様ではなく、ビジネス文書で頻出する記法のみカバー:
// - 見出し (# / ## / ### / #### )
// - 箇条書き ( - / * )、番号付き (1. 2.)
// - 太字 **bold** / 斜体 *italic*
// - インラインコード `code`
// - 区切り線 (---)
// - リンク [text](url)
// - 段落 / 空行
// XSS 対策で `<` `>` `&` を全文エスケープ後、置換でタグを生成
// ============================================================
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let src = md.replace(/\r\n?/g, '\n');

  // エスケープ
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // コードブロック (```) は事前に取り出して prot
  const codeBlocks: string[] = [];
  src = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    codeBlocks.push(code);
    return ` CODE${codeBlocks.length - 1} `;
  });

  // 行単位処理
  const lines = src.split('\n');
  const out: string[] = [];
  let i = 0;

  const renderInline = (s: string) => {
    let r = esc(s);
    // インラインコード
    r = r.replace(/`([^`]+)`/g, (_m, c) =>
      `<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:0.9em">${c}</code>`);
    // 太字 + 斜体 (簡易順)
    r = r.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // リンク
    r = r.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">$1</a>');
    return r;
  };

  while (i < lines.length) {
    const line = lines[i];

    // 区切り線
    if (/^---+\s*$/.test(line)) {
      out.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:18px 0" />');
      i++;
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (h) {
      const lv = h[1].length;
      const sz = [22, 18, 16, 14][lv - 1];
      const mt = [22, 18, 14, 12][lv - 1];
      out.push(`<h${lv} style="font-size:${sz}px;font-weight:700;margin:${mt}px 0 6px 0;line-height:1.3">${renderInline(h[2])}</h${lv}>`);
      i++;
      continue;
    }

    // 番号付きリスト
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol style="margin:6px 0 10px 22px;padding:0;list-style:decimal">' +
        items.map(it => `<li style="margin:2px 0;line-height:1.6">${renderInline(it)}</li>`).join('') + '</ol>');
      continue;
    }

    // 箇条書き
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push(raw);
        i++;
      }
      out.push('<ul style="margin:6px 0 10px 18px;padding:0;list-style:disc">' +
        items.map(it => {
          // チェックリスト [ ] / [x]
          const cb = it.match(/^\[( |x|X)\]\s+(.+)$/);
          if (cb) {
            const checked = cb[1].toLowerCase() === 'x';
            return `<li style="list-style:none;margin:2px 0 2px -18px;line-height:1.6">${checked ? '☑' : '☐'} ${renderInline(cb[2])}</li>`;
          }
          return `<li style="margin:2px 0;line-height:1.6">${renderInline(it)}</li>`;
        }).join('') + '</ul>');
      continue;
    }

    // 空行
    if (line.trim() === '') {
      out.push('');
      i++;
      continue;
    }

    // 段落 (連続する非空行を統合)
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p style="margin:6px 0;line-height:1.7">${renderInline(para.join(' '))}</p>`);
  }

  let html = out.join('\n');

  // コードブロックを戻す
  html = html.replace(/ CODE(\d+) /g, (_m, idx) => {
    const code = codeBlocks[Number(idx)] || '';
    return `<pre style="background:rgba(0,0,0,0.35);padding:10px 12px;border-radius:6px;overflow-x:auto;font-size:12px;line-height:1.45">${esc(code)}</pre>`;
  });

  return html;
}

/** Markdown を平文 (.txt 用) へ。極めて素朴: 記号を取るだけ。 */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/```([\s\S]*?)```/g, (_m, c) => c)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^---+$/gm, '──────────')
    .replace(/^\s*[-*]\s+/gm, '・')
    .replace(/^\s*(\d+)\.\s+/gm, '$1. ');
}
