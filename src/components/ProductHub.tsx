// ============================================================
// ProductHub — プロダクト（人格を横断する箱）の管理画面
//
// オーナー要望 2026-07-26:
//   「人格を横断して、一つのプロダクトを横断的に使えるようにしたい」
//
// できること:
//   ・プロダクトを作る（名前・説明）
//   ・どの人格をこの箱に入れるかを選ぶ
//   ・選んだプロダクトを「いま扱っているもの」にする
//     → AI がその箱の中の人格の資料をまとめて見て答えるようになる
//
// 人格ごとの分離はそのまま。箱に入れたものだけが横断される。
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check, Trash2, Layers } from 'lucide-react';
import type { Persona } from '../types/identity';
import type { Product } from '../types/product';
import type { useProducts } from '../hooks/useProducts';

interface Props {
  onClose: () => void;
  personas: Persona[];
  activePersonaId: string;
  products: ReturnType<typeof useProducts>;
  /** 各人格が持っている資料の数（横断すると何件になるかを実数で見せる） */
  knowledgeCountByPersona: Record<string, number>;
  accent?: string;
}

export default function ProductHub({
  onClose, personas, activePersonaId, products, knowledgeCountByPersona, accent = '#4a9eff',
}: Props) {
  const {
    products: list, activeProductId, setActiveProductId,
    createProduct, updateProduct, deleteProduct, togglePersona,
  } = products;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    // 作った瞬間から使えるよう、いまいる人格を最初から箱に入れておく
    const p = createProduct(name, desc, [activePersonaId]);
    setActiveProductId(p.id);
    setName(''); setDesc(''); setCreating(false);
    setEditingId(p.id);
  };

  const countFor = (p: Product) =>
    p.personaIds.reduce((sum, id) => sum + (knowledgeCountByPersona[id] || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(8,8,18,0.8)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 24 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121E', borderRadius: 22, padding: '1.4rem',
          maxWidth: 620, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', fontWeight: 800, color: accent }}>PRODUCTS</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.25rem 0 0' }}>プロダクト</h2>
          </div>
          <button
            type="button" onClick={onClose} aria-label="閉じる"
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
              width: 38, height: 38, cursor: 'pointer', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: '1.1rem', lineHeight: 1.7 }}>
          ひとつの商品や事業を、複数の立場（人格）にまたがって扱うための箱です。
          箱に入れた人格の資料は、AIがまとめて見て答えるようになります。
          <br />
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>
            箱に入れていない人格の情報は、これまでどおり混ざりません。
          </span>
        </p>

        {/* 横断をやめる（＝いまの人格だけに戻す） */}
        {activeProductId && (
          <button
            type="button"
            onClick={() => setActiveProductId(null)}
            style={{
              width: '100%', marginBottom: '0.9rem', padding: '9px 12px', borderRadius: 10,
              fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
              cursor: 'pointer',
            }}
          >
            横断をやめて、いまの人格だけに戻す
          </button>
        )}

        {/* 一覧 */}
        {list.length === 0 && !creating && (
          <div style={{
            padding: '1.4rem 1rem', borderRadius: 14, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)',
            marginBottom: '0.9rem',
          }}>
            <Layers size={22} style={{ color: accent, marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>まだプロダクトがありません</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              例：「Resonance」「受託事業」など。<br />
              作ってから、関わっている人格を選んでください。
            </div>
          </div>
        )}

        {list.map(p => {
          const isActive = p.id === activeProductId;
          const isEditing = p.id === editingId;
          return (
            <div
              key={p.id}
              style={{
                borderRadius: 14, marginBottom: 10, padding: '0.9rem',
                background: isActive ? `linear-gradient(135deg, ${p.accentColor}22, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? `${p.accentColor}88` : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', background: p.accentColor,
                  marginTop: 5, flex: 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.6 }}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 5 }}>
                    {p.personaIds.length} つの立場 ／ 資料 {countFor(p)} 件を横断
                  </div>
                </div>
                {isActive && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: '#34D399',
                    background: 'rgba(52,211,153,0.14)', borderRadius: 999,
                    padding: '3px 8px', flex: 'none',
                  }}>使用中</span>
                )}
              </div>

              {/* 操作 */}
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => setActiveProductId(p.id)}
                    style={{
                      fontSize: 11.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${p.accentColor}, ${p.accentColor}cc)`,
                      border: 'none', borderRadius: 9, padding: '7px 13px',
                    }}
                  >このプロダクトを使う</button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : p.id)}
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 9, padding: '7px 13px',
                  }}
                >{isEditing ? '閉じる' : '関わる人格を選ぶ'}</button>
                <button
                  type="button"
                  onClick={() => { if (confirm(`「${p.name}」を削除しますか？（資料そのものは消えません）`)) deleteProduct(p.id); }}
                  aria-label="削除"
                  style={{
                    fontSize: 11.5, color: 'rgba(248,113,113,0.85)', cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(248,113,113,0.3)',
                    borderRadius: 9, padding: '7px 10px',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                ><Trash2 size={13} /></button>
              </div>

              {/* 人格の選択 */}
              {isEditing && (
                <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 7 }}>
                    このプロダクトに関わっている人格をすべて選んでください
                  </div>
                  {personas.map(pa => {
                    const on = p.personaIds.includes(pa.id);
                    const kc = knowledgeCountByPersona[pa.id] || 0;
                    return (
                      <button
                        key={pa.id}
                        type="button"
                        onClick={() => togglePersona(p.id, pa.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 10px', borderRadius: 9, marginBottom: 5, cursor: 'pointer',
                          background: on ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${on ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 17, height: 17, borderRadius: 5, flex: 'none',
                          background: on ? '#34D399' : 'rgba(255,255,255,0.1)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{on && <Check size={12} color="#0b1220" />}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, display: 'block' }}>{pa.name}</span>
                          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
                            {pa.subtitle}{kc > 0 ? ` ・資料 ${kc} 件` : ' ・資料なし'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <div style={{ marginTop: 9 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                      このプロダクトで必ず守ってほしいこと（任意）
                    </label>
                    <textarea
                      value={p.instructions || ''}
                      onChange={e => updateProduct(p.id, { instructions: e.target.value })}
                      placeholder="例：価格は必ず税込で答える／〇〇という言い回しは使わない"
                      rows={2}
                      style={{
                        width: '100%', fontSize: 11.5, padding: '8px 10px', borderRadius: 9,
                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                        marginTop: 4, resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 新規作成 */}
        {creating ? (
          <div style={{
            borderRadius: 14, padding: '0.9rem', marginTop: 4,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>プロダクトの名前</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="例：Resonance"
              style={{
                width: '100%', fontSize: 13, padding: '9px 11px', borderRadius: 9,
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                marginTop: 4, marginBottom: 9,
              }}
            />
            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>どんなプロダクトか（任意）</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="例：公式LINEの返信と集客を自動にするサービス"
              style={{
                width: '100%', fontSize: 12.5, padding: '9px 11px', borderRadius: 9,
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                marginTop: 4, marginBottom: 11,
              }}
            />
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                type="button" onClick={handleCreate} disabled={!name.trim()}
                style={{
                  flex: 1, fontSize: 12.5, fontWeight: 800, color: '#fff',
                  background: name.trim() ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 10, padding: '10px 16px',
                  cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.6,
                }}
              >作る</button>
              <button
                type="button" onClick={() => { setCreating(false); setName(''); setDesc(''); }}
                style={{
                  fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
                }}
              >やめる</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{
              width: '100%', fontSize: 12.5, fontWeight: 800, color: '#fff',
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              border: 'none', borderRadius: 10, padding: '11px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginTop: 4,
            }}
          ><Plus size={15} /> プロダクトを作る</button>
        )}
      </motion.div>
    </motion.div>
  );
}
