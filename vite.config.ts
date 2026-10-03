import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages はリポジトリ名のサブパス（/principle-loop/）で公開されるため、
// base を相対パスにしてどのパスでも壊れないようにする。ルーティングは # を使う。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
