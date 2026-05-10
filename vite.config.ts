import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Multi-page 構成:
// - / → index.html (Prism LP)
// - /iris → iris.html (Iris LP)  ※ Vercel rewrite で /iris → /iris.html
//
// public/ に置いていた iris.html はビルド変換されず <script src="/src/main.tsx">
// が残ってしまうため、ルートに移動してビルド対象に含める必要がある。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        iris: resolve(__dirname, 'iris.html'),
        corp: resolve(__dirname, 'corp.html'),
      },
    },
  },
})
