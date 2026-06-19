/**
 * 时间格式化工具
 * 统一处理毫秒时长、运行时间显示等
 */

/**
 * 将毫秒时长格式化为易读的时间字符串
 *   12345678ms -> "3小时25分45秒"
 *   123456ms -> "2分03秒"
 *   1234ms -> "1秒"
 */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0秒'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}时${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`
  }
  if (m > 0) {
    return `${m}分${String(s).padStart(2, '0')}秒`
  }
  return `${s}秒`
}

/**
 * 格式化为紧凑时间字符串（如 "12:34:56"）
 */
export function formatClock(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
