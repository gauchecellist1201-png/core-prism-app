// ============================================================
// CORE Studio Sales OS — エントリ (/sales)
// Prism 本体 (src/App.tsx) とは完全に別のバンドル。既存を巻き込まない。
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SalesOS from './SalesOS';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <SalesOS />
    </StrictMode>,
  );
}
