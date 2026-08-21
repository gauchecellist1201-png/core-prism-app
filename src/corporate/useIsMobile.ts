// ============================================================
//  useIsMobile — iPhone幅かどうか（縦長すぎるLPをモバイルだけ畳むために使う）
//  デスクトップの見え方は一切変えない。
//  2026-08-21: CoreSite.tsx の中だけにあったものを、新しい章からも使えるよう外へ出した。
// ============================================================
import { useEffect, useState } from 'react';

export function useIsMobile(query = '(max-width: 640px)') {
  const [is, setIs] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIs(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return is;
}

export default useIsMobile;
