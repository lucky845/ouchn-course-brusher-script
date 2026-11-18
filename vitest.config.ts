import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * Vitest 独立配置
 * 与 vite.config.ts 分离，避免影响生产构建。
 * 测试主要针对纯逻辑模块（utils / services），为覆盖 window/document 相关分支，
 * 使用 happy-dom 环境。
 *
 * 这里挂 @vitejs/plugin-vue：少数回归（面板监听生命周期、对话框状态）只能
 * 通过真实组件挂载才能守住，手写等价逻辑的测试挡不住真正的回归。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false
  }
})
