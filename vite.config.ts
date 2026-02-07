import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 使用相对路径 base，这样无论仓库名叫什么都能正常加载
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})