
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 这里的 base 路径会自动适配 GitHub 的二级目录
  // 如果你的仓库名叫 course-tool，它会自动处理成 /course-tool/
  base: './', 
  build: {
    outDir: 'dist',
  }
})
