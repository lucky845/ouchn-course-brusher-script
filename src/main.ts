/**
 * 油猴脚本入口
 * 负责调度面板的初始化
 */
// 设计令牌（毛玻璃/暗色）必须最先载入，bootstrap 挂载时会把它复制进各面板的 Shadow DOM
import './styles/theme.css'
import { installAntiDebugBypass } from './services/antiDebugBypass'
import { scheduleInit } from './bootstrap'
import { settingsStoreService } from './services/settingsStore'
import { applyTheme } from './utils/theme'

applyTheme(settingsStoreService.get().theme)

try {
  installAntiDebugBypass()
} catch (e) {
  // 静默
}

console.log('[刷课脚本] 正在初始化...')

scheduleInit()
