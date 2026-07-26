// ============================================================
// useProducts — プロダクト（人格を横断する箱）の管理
//
// 保存も同期も、既存の usePersonas / useKnowledge と同じ作法に揃えている:
//   localStorage → Supabase(useCloudSync) → 同一メール引き継ぎ(useEmailBlobSync)
// 端末をまたいでも消えないようにするため。
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PersonaId } from '../types/identity';
import { type Product, type ProductId, PRODUCTS_STORAGE_KEY, ACTIVE_PRODUCT_KEY } from '../types/product';
import { useCloudSync } from './useCloudSync';
import { useEmailBlobSync } from './useEmailBlobSync';
import { useBillingUser } from '../lib/billing';

// 他の useProducts() インスタンスへ変更を配る（usePersonas と同じ仕組み）
const subscribers = new Set<(next: Product[]) => void>();

function load(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 壊れたレコードで画面を落とさない
    return arr.filter((p: unknown): p is Product => {
      const o = p as Partial<Product>;
      return !!o && typeof o.id === 'string' && typeof o.name === 'string';
    }).map((p: Product) => ({ ...p, personaIds: Array.isArray(p.personaIds) ? p.personaIds : [] }));
  } catch {
    return [];
  }
}

function save(items: Product[]) {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* 容量超過などで保存できなくても操作は止めない */
  }
  subscribers.forEach(fn => fn(items));
}

const PALETTE = ['#4a9eff', '#c9a96e', '#a78bfa', '#34d399', '#f87171', '#fb923c', '#e879f9', '#2dd4bf'];

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(load);
  const [activeProductId, setActiveProductIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_PRODUCT_KEY); } catch { return null; }
  });

  useEffect(() => {
    const sub = (next: Product[]) => {
      setProducts(prev => (prev === next ? prev : next));
    };
    subscribers.add(sub);
    return () => { subscribers.delete(sub); };
  }, []);

  const persist = useCallback((next: Product[]) => {
    setProducts(next);
    save(next);
  }, []);

  useCloudSync({
    key: PRODUCTS_STORAGE_KEY,
    value: products,
    setValue: setProducts,
    isEmpty: v => v.length === 0,
  });

  const { user: billingUser } = useBillingUser();
  useEmailBlobSync<Product[]>({
    key: 'products',
    enabled: true,
    email: billingUser?.email,
    value: products,
    isEmpty: v => v.length === 0,
    onRemote: (merged) => setProducts(merged),
    merge: (local, remote) => {
      const byId = new Map<string, Product>();
      for (const p of remote) byId.set(p.id, p);
      for (const p of local) byId.set(p.id, p); // ローカルの最新を優先
      return Array.from(byId.values());
    },
  });

  const createProduct = useCallback((name: string, description: string, personaIds: PersonaId[]): Product => {
    const p: Product = {
      id: uuidv4(),
      name: name.trim() || '名前のないプロダクト',
      description: description.trim(),
      personaIds: [...personaIds],
      accentColor: PALETTE[products.length % PALETTE.length],
      createdAt: new Date().toISOString(),
    };
    persist([...products, p]);
    return p;
  }, [products, persist]);

  const updateProduct = useCallback((id: ProductId, patch: Partial<Product>) => {
    persist(products.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }, [products, persist]);

  const deleteProduct = useCallback((id: ProductId) => {
    persist(products.filter(p => p.id !== id));
    setActiveProductIdState(cur => {
      if (cur !== id) return cur;
      try { localStorage.removeItem(ACTIVE_PRODUCT_KEY); } catch { /* */ }
      return null;
    });
  }, [products, persist]);

  /** この人格を、このプロダクトの箱に入れる／外す。 */
  const togglePersona = useCallback((id: ProductId, personaId: PersonaId) => {
    persist(products.map(p => {
      if (p.id !== id) return p;
      const has = p.personaIds.includes(personaId);
      return { ...p, personaIds: has ? p.personaIds.filter(x => x !== personaId) : [...p.personaIds, personaId] };
    }));
  }, [products, persist]);

  const setActiveProductId = useCallback((id: ProductId | null) => {
    setActiveProductIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_PRODUCT_KEY, id);
      else localStorage.removeItem(ACTIVE_PRODUCT_KEY);
    } catch { /* */ }
  }, []);

  const activeProduct = products.find(p => p.id === activeProductId) ?? null;

  /** この人格が入っているプロダクト一覧。 */
  const getForPersona = useCallback(
    (personaId: PersonaId) => products.filter(p => p.personaIds.includes(personaId)),
    [products],
  );

  return {
    products,
    activeProduct,
    activeProductId,
    setActiveProductId,
    createProduct,
    updateProduct,
    deleteProduct,
    togglePersona,
    getForPersona,
  };
}
