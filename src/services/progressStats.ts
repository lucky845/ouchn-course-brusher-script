import type { ProgressStats } from '../types'

class ProgressStatsService {
  private sessionStats = { startTime: Date.now(), itemsCompleted: 0 }

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
      const sessionTime = Date.now() - this.sessionStats.startTime
      return {
        total,
        current,
        percentage,
        sessionTime,
        itemsCompleted: this.sessionStats.itemsCompleted,
      }
    } catch (e) {
      return {
        total: courseItems.length,
        current: 0,
        percentage: 0,
        sessionTime: Date.now() - this.sessionStats.startTime,
        itemsCompleted: this.sessionStats.itemsCompleted,
      }
    }
  }

  formatTime(ms: number): string {
    try {
      const totalSeconds = Math.floor(ms / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      if (hours > 0) {
        return `${hours}小时${minutes}分`
      }
      if (minutes > 0) {
        return `${minutes}分${seconds}秒`
      }
      return `${seconds}秒`
    } catch (e) {
      return '0秒'
    }
  }

  incrementItemsCompleted(): void {
    try {
      this.sessionStats.itemsCompleted++
    } catch (e) {
      console.error('incrementItemsCompleted error', e)
    }
  }

  getSessionStats(): { startTime: number; itemsCompleted: number } {
    try {
      return {
        startTime: this.sessionStats.startTime,
        itemsCompleted: this.sessionStats.itemsCompleted,
      }
    } catch (e) {
      return { startTime: Date.now(), itemsCompleted: 0 }
    }
  }

  resetSession(): void {
    try {
      this.sessionStats.startTime = Date.now()
      this.sessionStats.itemsCompleted = 0
    } catch (e) {
      console.error('resetSession error', e)
    }
  }
}

export const progressStatsService = new ProgressStatsService()
export default ProgressStatsService
