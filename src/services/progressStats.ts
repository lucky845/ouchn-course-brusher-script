import type { ProgressStats } from '../types'
import { settingsStoreService } from './settingsStore'
import { formatDuration } from '../utils/time'

class ProgressStatsService {
  getStats(sidebar: Element | null, courseItems: HTMLLinkElement[]): ProgressStats {
    try {
      const sidebarItems = sidebar ? sidebar.querySelectorAll('a, li, .item') : []
      const total = sidebar ? sidebarItems.length : courseItems.length
      let current = 0
      if (sidebar) {
        for (let i = 0; i < sidebarItems.length; i++) {
          const item = sidebarItems[i] as HTMLElement
          if (item.classList.contains('active') || item.classList.contains('current')) {
            current = i + 1
            break
          }
        }
      } else {
        for (let i = 0; i < courseItems.length; i++) {
          const item = courseItems[i]
          if (item.classList.contains('active') || item.classList.contains('current')) {
            current = i + 1
            break
          }
        }
      }
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0
      const session = settingsStoreService.sessionGet()
      const sessionTime = session.startTime > 0 ? Date.now() - session.startTime : 0
      return {
        total,
        current,
        percentage,
        sessionTime,
        itemsCompleted: session.itemsDone
      }
    } catch {
      const session = settingsStoreService.sessionGet()
      return {
        total: courseItems.length,
        current: 0,
        percentage: 0,
        sessionTime: session.startTime > 0 ? Date.now() - session.startTime : 0,
        itemsCompleted: session.itemsDone
      }
    }
  }

  formatTime(ms: number): string {
    return formatDuration(ms)
  }
}

export const progressStatsService = new ProgressStatsService()
export default ProgressStatsService
