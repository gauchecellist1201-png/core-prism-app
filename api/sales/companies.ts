// ============================================================
// /api/sales/companies — 営業先の一覧 / 追加 / 編集 / 削除
//   GET                     一覧 (軽い行) + 件数
//   GET ?id=xxx             1社の全データ + 活動履歴
//   POST { url|name|... }   1社追加 (ドメインで重複排除)
//   POST { bulk: "..." }    まとめて追加 (1行1社 / 「社名,URL」or URL のみ)
//   PATCH { id, patch }     手で直せる項目だけ更新
//   DELETE { id }           削除
// x-master-key 必須
// ============================================================
import { corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import {
  blankCompany, claimDomain, deleteCompany, domainOf, getCompany, listActivities,
  confirmDomain, listRows, newId, normalizeUrl, putCompany, releaseDomain,
} from '../_lib/sales/store';
import { guessTier } from '../../src/sales/shared/catalog';
import type { Company } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

// 1件の追加で Upstash に 2〜3 往復するので、Edge の 25 秒に収まる件数で切る。
// 超えた分は取り込まず、何件落としたかを必ず画面に返す (黙って捨てない)。
const MAX_BULK = 60;

type Body = Record<string, unknown>;
const s = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface Seed {
  name: string; url: string; phone: string; email: string; sns: string;
  contactName: string; memo: string; industry: string;
}

function seedFrom(b: Body): Seed {
  return {
    name: s(b.name, 120),
    url: s(b.url, 500),
    phone: s(b.phone, 40),
    email: s(b.email, 200),
    sns: s(b.sns, 500),
    contactName: s(b.contactName, 80),
    memo: s(b.memo, 2000),
    industry: s(b.industry, 40),
  };
}

/** 1行から「社名」と「URL」を拾う。区切りは , / タブ / 全角カンマ。 */
function parseBulkLine(line: string): { name: string; url: string } | null {
  const t = line.trim();
  if (!t) return null;
  const cols = t.split(/[,\t、]/).map(x => x.trim()).filter(Boolean);
  if (!cols.length) return null;
  const urlCol = cols.find(c => /^(https?:\/\/|www\.)/i.test(c) || /\.[a-z]{2,}(\/|$)/i.test(c)) || '';
  const nameCol = cols.find(c => c !== urlCol) || '';
  if (!urlCol && !nameCol) return null;
  return { name: nameCol, url: normalizeUrl(urlCol) };
}

async function createOne(seed: Seed): Promise<{ company: Company | null; created: boolean; reason: string }> {
  const url = normalizeUrl(seed.url);
  // 社名が入っていると「URLは壊れているが登録は成功」になり、URL が黙って消えて
  // 分析もできない会社ができる。PATCH 側と同じく弾く。
  if (seed.url && !url) return { company: null, created: false, reason: 'URLの形が正しくありません' };
  const name = seed.name || (url ? domainOf(url) : '');
  if (!name && !url) return { company: null, created: false, reason: '社名もURLもありません' };

  const domain = domainOf(url);
  const candidateId = newId();
  const claim = domain
    ? await claimDomain(domain, candidateId)
    : { id: candidateId, created: true };

  if (!claim.created) {
    const existing = await getCompany(claim.id);
    return {
      company: existing,
      created: false,
      reason: claim.pending ? '同じドメインをいま登録中です' : 'すでに登録ずみです',
    };
  }

  const c = blankCompany({
    id: claim.id,
    name,
    url,
    domain,
    industry: seed.industry,
    targetTier: guessTier(`${seed.industry} ${name} ${seed.memo}`),
    phone: seed.phone,
    email: seed.email,
    sns: seed.sns,
    contactName: seed.contactName,
    memo: seed.memo,
    nextActionLabel: '企業分析をかける',
  });
  const saved = await putCompany(c);
  // 本体を書き終えてから札を恒久化する (TTL を外す)
  await confirmDomain(domain, saved.id);
  return { company: saved, created: true, reason: '' };
}

function badUrl(ch: Record<string, string>): Response {
  return json({
    error: 'BAD_URL',
    message: 'URL の形が正しくありません。https:// から始まる住所を入れてください (消したいときは空にしてください)。',
  }, 400, ch);
}

// 手で直せる項目 (AI が作った分析・企画は API 側からしか書き換えない)
const EDITABLE = ['name', 'url', 'phone', 'email', 'sns', 'contactName', 'memo', 'industry'] as const;

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  try {
    if (req.method === 'GET') {
      const id = new URL(req.url).searchParams.get('id') || '';
      if (id) {
        const c = await getCompany(id);
        if (!c) return json({ error: 'NOT_FOUND', message: 'その営業先は見つかりませんでした。' }, 404, ch);
        const activities = await listActivities(id, 60);
        return json({ company: c, activities }, 200, ch);
      }
      const rows = await listRows();
      return json({ rows, total: rows.length }, 200, ch);
    }

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Body;

      const bulk = s(body.bulk, 40_000);
      if (bulk) {
        const rawLines = bulk.split(/\r?\n/);
        const parsed = rawLines.map(l => ({ raw: l, p: parseBulkLine(l) }));
        const lines = parsed.filter(x => x.p).map(x => x.p as { name: string; url: string });
        if (!lines.length) return json({ error: 'EMPTY', message: '読み取れる行がありませんでした。1行に1社、「社名,URL」の形で貼ってください。' }, 400, ch);
        const over = lines.length > MAX_BULK;
        const use = lines.slice(0, MAX_BULK);
        let created = 0;
        const skipped: string[] = [];
        for (const l of use) {
          const r = await createOne({ ...seedFrom({}), name: l.name, url: l.url });
          if (r.created) created += 1;
          else skipped.push(`${l.name || l.url}: ${r.reason}`);
        }
        // 上限を超えて処理しなかった行は、そのまま返して画面の入力欄へ戻す。
        // 件数だけ返して本文を消すと、貼った人は残りを手元から作り直すことになる。
        const leftover = over
          ? parsed.filter(x => x.p).slice(MAX_BULK).map(x => x.raw).join('\n')
          : '';
        return json({
          created,
          skipped: skipped.length,
          skippedDetail: skipped.slice(0, 30),
          truncated: over ? lines.length - MAX_BULK : 0,
          leftover,
          note: over
            ? `1回に取り込めるのは${MAX_BULK}件までです。残り${lines.length - MAX_BULK}件は入力欄に残してあるので、もう一度「まとめて追加する」を押してください。`
            : '',
        }, 200, ch);
      }

      const seed = seedFrom(body);
      if (!seed.name && !seed.url) {
        return json({ error: 'EMPTY', message: '社名かURLのどちらかは必要です。' }, 400, ch);
      }
      const r = await createOne(seed);
      if (!r.created && r.reason === 'URLの形が正しくありません') return badUrl(ch);
      if (!r.created) {
        return json({ created: false, company: r.company, message: r.reason }, 200, ch);
      }
      return json({ created: true, company: r.company }, 201, ch);
    }

    if (req.method === 'PATCH') {
      const body = (await req.json().catch(() => ({}))) as Body;
      const id = s(body.id, 80);
      if (!id) return json({ error: 'EMPTY', message: 'id がありません。' }, 400, ch);
      const c = await getCompany(id);
      if (!c) return json({ error: 'NOT_FOUND', message: 'その営業先は見つかりませんでした。' }, 404, ch);

      const patch = (body.patch && typeof body.patch === 'object' ? body.patch : {}) as Body;
      const next: Company = { ...c };
      for (const k of EDITABLE) {
        if (!(k in patch)) continue;
        const v = s(patch[k], k === 'memo' ? 2000 : 500);
        switch (k) {
          case 'url': {
            const url = normalizeUrl(v);
            // 打ち間違いを黙って空にしない。空にすると URL が消えるうえに
            // 重複防止の札まで外れる (200 が返るので気づけない)。
            // 意図して空にしたいときだけ、空文字で消せる。
            if (v && !url) return badUrl(ch);
            next.url = url;
            next.domain = domainOf(url);
            break;
          }
          case 'name': next.name = v; break;
          case 'phone': next.phone = v; break;
          case 'email': next.email = v; break;
          case 'sns': next.sns = v; break;
          case 'contactName': next.contactName = v; break;
          case 'memo': next.memo = v; break;
          case 'industry': next.industry = v; break;
        }
      }
      // URL を書き換えたら重複防止の札も張り替える。
      // 順番が大事: 新しい札を取る → 保存 → 新しい札を恒久化 → 最後に古い札を外す。
      // 先に古い札を外すと、保存が失敗したときに「会社は旧ドメインを指しているのに
      // 札だけ無い」状態になり、同じ会社をもう一度登録できてしまう。
      const domainChanged = next.domain !== c.domain;
      if (domainChanged && next.domain) {
        const claim = await claimDomain(next.domain, next.id);
        if (!claim.created && claim.id !== next.id) {
          return json({
            error: 'DUPLICATE',
            message: claim.pending
              ? 'そのドメインはいま別の登録処理が使っています。少し待ってからお試しください。'
              : 'そのドメインは別の営業先がすでに使っています。',
            existingId: claim.id,
          }, 409, ch);
        }
      }

      const saved = await putCompany(next);

      if (domainChanged) {
        // 取った札は TTL 30 秒付きなので、本体を書いたら必ず恒久化する。
        if (next.domain) await confirmDomain(next.domain, saved.id);
        // ここまで来て初めて古い札を外す。
        if (c.domain) await releaseDomain(c.domain, c.id);
      }
      return json({ company: saved }, 200, ch);
    }

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => ({}))) as Body;
      const id = s(body.id, 80) || new URL(req.url).searchParams.get('id') || '';
      if (!id) return json({ error: 'EMPTY', message: 'id がありません。' }, 400, ch);
      await deleteCompany(id);
      return json({ deleted: true }, 200, ch);
    }

    return json({ error: 'Method not allowed' }, 405, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN を設定してください。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
