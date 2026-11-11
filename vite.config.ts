import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages（プロジェクトサイト）でも、リポジトリ名変更後でも壊れないよう相対baseにする
export default defineConfig({
  plugins: [react()],
  base: './',
})
