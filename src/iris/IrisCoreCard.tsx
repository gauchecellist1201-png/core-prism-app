// ============================================================
// CORE Iris — あなたの核カード（人格コアの Iris UI）
// プロフィールや投稿を貼る → AI が人格・目的・ゴールを抽出 → 直して保存。
// 保存した核は Iris の全 AI（分析/戦略/リール台本）に毎回効く。
// ============================================================
import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useIrisCore, extractCreatorCore, type CreatorCore } from './irisCore';

const FIELDS: { key: keyof Omit<CreatorCore, 'updatedAt'>; label: string; ph: string }[] = [
  { key: 'identity', label: '人柄・世界観', ph: '例：等身大で、背伸びしない言葉。一人称は「わたし」。やさしく前向き' },
  { key: 'purpose', label: '発信の目的', ph: '例：忙しい人が自分を大事にするきっかけを届ける' },
  { key: 'audience', label: '届けたい相手', ph: '例：仕事と自分時間に悩む20〜30代の女性' },
  { key: 'strengths', label: '強み・武器', ph: '例：理論より実体験。失敗談を正直に出せる' },
  { key: 'goals', label: '目指すゴール', ph: '例：半年でフォロワー1万＋月3件の案件' },
];

export default function IrisCoreCard({ bg }: { bg: IrisBackgroundDef }) {
  const { core, setField, replace, filled } = useIrisCore();
  const [source, setSource] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [open, setOpen] = useState(filled);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)', border: `1px solid ${bg.cardBorder}`, color: '#1F1A2E',
    padding: '0.6rem 0.85rem', borderRadius: 12, fontFamily: IRIS_FONTS.body, fontSize: 16, width: '100%', lineHeight: 1.6,
  };

  async function runExtract() {
    if (source.trim().length < 8) { setMsg('自己紹介やプロフィール文を、もう少し貼ってください。'); return; }
    setExtracting(true); setMsg(null);
    try {
      const c = await extractCreatorCore(source.trim());
      if (!c) { setMsg('うまく読み取れませんでした。文章を増やすか、表現を変えてお試しください。'); return; }
      replace(c); setOpen(true); setSaved(false);
    } finally { setExtracting(false); }
  }

  return (
    <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1rem 1.1rem', marginBottom: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: bg.ink, fontFamily: IRIS_FONTS.display, fontSize: '1rem', fontWeight: 700, padding: 0 }}
      >
        <Sparkles size={18} style={{ color: bg.accent }} />
        あなたの核（人格・目的・ゴール）
        {filled && <Check size={15} style={{ color: bg.accent, marginLeft: 'auto' }} />}
      </button>
      <p style={{ color: bg.inkSoft, fontSize: '0.8rem', lineHeight: 1.6, marginTop: 6, fontFamily: IRIS_FONTS.body }}>
        あなたの自己紹介や投稿を貼ると、AIが人柄・目的・ゴールを読み取ります。保存すると、Irisの分析・戦略・リール台本が<strong style={{ color: bg.ink }}>“あなたらしさ”</strong>で生成されます。
      </p>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={4}
              placeholder="自己紹介・プロフィール・最近の投稿などを貼る（AIが要点だけ抜き取ります）"
              style={{ ...inp, resize: 'vertical' }}
            />
            <button
              onClick={runExtract}
              disabled={extracting || source.trim().length < 8}
              style={{ marginTop: 8, width: '100%', background: bg.accent, color: '#1a1226', border: 'none', borderRadius: 12, padding: '0.7rem', fontFamily: IRIS_FONTS.display, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', opacity: extracting || source.trim().length < 8 ? 0.5 : 1 }}
            >
              {extracting ? 'AIが読み取り中…' : 'AIに読み取らせる'}
            </button>
            {msg && <p style={{ color: '#e26d8a', fontSize: '0.78rem', marginTop: 6, fontFamily: IRIS_FONTS.body }}>{msg}</p>}
          </div>

          {FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'block' }}>
              <span style={{ display: 'block', color: bg.inkSoft, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4, fontFamily: IRIS_FONTS.body }}>{f.label}</span>
              <textarea
                value={core[f.key]}
                onChange={(e) => { setField(f.key, e.target.value); setSaved(false); }}
                rows={2}
                maxLength={600}
                placeholder={f.ph}
                style={{ ...inp, resize: 'vertical' }}
              />
            </label>
          ))}

          <button
            onClick={() => { replace({}); setSaved(true); }}
            style={{ width: '100%', background: 'transparent', color: bg.accent, border: `1px solid ${bg.accent}`, borderRadius: 12, padding: '0.7rem', fontFamily: IRIS_FONTS.display, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            {saved ? '保存しました ✓' : 'この核で保存する'}
          </button>
          <p style={{ color: bg.inkSoft, fontSize: '0.72rem', fontFamily: IRIS_FONTS.body, margin: 0 }}>
            ※ 保存した内容はこの端末に残り、ログイン中はクラウドにも同期されます。
          </p>
        </div>
      )}
    </div>
  );
}
