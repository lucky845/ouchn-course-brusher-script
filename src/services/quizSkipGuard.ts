/**
 * 测验跳过防死循环守卫
 *
 * 刷课模式会自动跳过测验。若课程连续测验，或导航定位 bug 导致反复跳回
 * 同一个测验，脚本会陷入「跳过 → 跳转 → 重新进入 → 再跳过」的死循环。
 *
 * 本守卫用 localStorage 持久化「最近跳过的测验 moduleId 及时间戳」：
 * - 同一 moduleId 在短时间窗口内被跳过足够多次 → 判定可能死循环 → 返回 shouldStop
 * - 跨页面跳转保持有效（localStorage 而非组件内存）
 */
import { readStorageOptional, writeStorage } from '../utils/storage'
import { QUIZ_SKIP_GUARD_KEY } from './storageKeys'

/** 判定死循环的参数（集中配置，便于调整） */
export const QUIZ_SKIP_GUARD = {
  /** 时间窗口（毫秒）：只看窗口内的跳过记录 */
  windowMs: 3 * 60 * 1000, // 3 分钟
  /** 同一测验在窗口内被跳过多少次视为可能死循环 */
  maxSkipsInWindow: 3
} as const

interface QuizSkipRecord {
  moduleId: string
  /** 最近一次跳过的 Unix 时间戳 */
  lastSkipAt: number
  /** 窗口内的连续跳过次数 */
  skipsInWindow: number
}

/** 读取守卫记录，非法数据返回空对象 */
function load(): Record<string, QuizSkipRecord> {
  const isRecord = (v: unknown): v is Record<string, QuizSkipRecord> =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
  const data = readStorageOptional<Record<string, QuizSkipRecord>>(QUIZ_SKIP_GUARD_KEY, isRecord)
  return data ?? {}
}

/**
 * 记录一次测验跳过，并返回是否需要停止刷课。
 * @param moduleId 被跳过的测验 moduleId（无则用 ''，此时按原始 URL 对待，通常也能命中）
 * @returns true 表示连续跳过过多，建议停止刷课
 */
export function recordQuizSkip(moduleId: string): boolean {
  const now = Date.now()
  const records = load()
  const id = moduleId || ''

  const prev = records[id]
  let skipsInWindow = 1
  if (prev && typeof prev.lastSkipAt === 'number' && now - prev.lastSkipAt <= QUIZ_SKIP_GUARD.windowMs) {
    skipsInWindow = (Number(prev.skipsInWindow) || 0) + 1
  }

  records[id] = { moduleId: id, lastSkipAt: now, skipsInWindow }

  // 收紧：只保留窗口内的记录，避免无限膨胀
  const snapshot: Record<string, QuizSkipRecord> = {}
  Object.entries(records).forEach(([key, rec]) => {
    if (rec && typeof rec.lastSkipAt === 'number' && now - rec.lastSkipAt <= QUIZ_SKIP_GUARD.windowMs) {
      snapshot[key] = rec
    }
  })
  snapshot[id] = records[id]
  writeStorage(QUIZ_SKIP_GUARD_KEY, snapshot)

  return skipsInWindow >= QUIZ_SKIP_GUARD.maxSkipsInWindow
}

/** 清空守卫记录（刷课正常开始/重新开始时调用） */
export function resetQuizSkipGuard(): void {
  writeStorage(QUIZ_SKIP_GUARD_KEY, {})
}