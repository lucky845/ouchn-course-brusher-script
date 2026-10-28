import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Vitest 独立配置
 * 与 vite.config.ts 分离，避免影响生产构建。
 * 测试主要针对纯逻辑模块（utils / services），为覆盖 window/document 相关分支，
 * 使用 happy-dom 环境。
 */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false
  }
})
