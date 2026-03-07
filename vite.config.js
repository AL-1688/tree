import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    allowedHosts: ['.monkeycode-ai.online']
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  }
})
