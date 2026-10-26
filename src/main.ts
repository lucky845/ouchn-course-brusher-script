/**
 * 油猴脚本入口
 * 负责调度面板的初始化
 */
import { installAntiDebugBypass } from './services/antiDebugBypass'
import { scheduleInit } from './bootstrap'

try {
  installAntiDebugBypass()
} catch (e) {
  // 静默
}

console.log('[刷课脚本] 正在初始化...')

scheduleInit()