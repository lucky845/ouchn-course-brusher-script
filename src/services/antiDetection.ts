export class AntiDetectionService {
  private intervals: number[] = []
  private active = false

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private simulateScroll(): void {
    try {
      if (typeof window === 'undefined' || !window.scrollBy) {
        return
      }
      const x = this.getRandomInt(-20, 50)
      const y = this.getRandomInt(30, 120)
      window.scrollBy(x, y)
      setTimeout(() => {
        try {
          window.scrollBy(-x, -y)
        } catch {
        }
      }, 1000)
    } catch {
    }
  }

  start(): void {
    try {
      if (this.active) return
      this.active = true

      const interval = window.setInterval(() => {
        this.simulateScroll()
      }, this.getRandomInt(20000, 30000))
      this.intervals.push(interval)

      const heartbeat = window.setInterval(() => {
        this.simulateScroll()
      }, this.getRandomInt(20000, 30000))
      this.intervals.push(heartbeat)
    } catch {
    }
  }

  stop(): void {
    try {
      this.intervals.forEach(id => {
        try {
          window.clearInterval(id)
        } catch {
        }
      })
      this.intervals = []
    } catch {
    }
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }
}

export const antiDetectionService = new AntiDetectionService()
export default antiDetectionService
