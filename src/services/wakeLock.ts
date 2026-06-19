class WakeLockService {
  private lock: WakeLockSentinel | null = null
  private enabled = false
  private reAcquireTimer: number | null = null
  private audioContext: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private active = false

  async acquire(logMessage = true): Promise<void> {
    if (this.enabled) return

    try {
      if ('wakeLock' in navigator) {
        try {
          this.lock = await navigator.wakeLock.request('screen')
          this.enabled = true
          this.active = true
          if (logMessage) {
            console.log('[WakeLock] 屏幕常亮已开启')
          }
          if (this.lock) {
            this.lock.addEventListener('release', () => {
              if (this.enabled) {
                this.reAcquire()
              }
            })
          }
        } catch (e) {
          console.warn('[WakeLock] 获取失败，使用备用方案:', e)
          this.fallbackStart()
          this.enabled = true
          this.active = true
        }
      } else {
        this.fallbackStart()
        this.enabled = true
        this.active = true
        if (logMessage) {
          console.log('[WakeLock] 使用备用方案保持屏幕常亮')
        }
      }
    } catch (e) {
      console.error('[WakeLock] 启动失败:', e)
    }

    if (this.reAcquireTimer) {
      window.clearInterval(this.reAcquireTimer)
    }
    this.reAcquireTimer = window.setInterval(() => {
      if (this.enabled && !this.lock && 'wakeLock' in navigator) {
        this.acquire(false)
      }
    }, 30000)
  }

  private async reAcquire(): Promise<void> {
    if (this.enabled && 'wakeLock' in navigator) {
      try {
        this.lock = await navigator.wakeLock.request('screen')
        if (this.lock) {
          this.lock.addEventListener('release', () => {
            if (this.enabled) {
              this.reAcquire()
            }
          })
        }
      } catch (e) {
        console.warn('[WakeLock] 重新获取失败:', e)
      }
    }
  }

  release(): void {
    try {
      if (this.lock) {
        this.lock.release()
      }
    } catch (e) {
      console.error('[WakeLock] 释放失败:', e)
    }
    this.lock = null
    this.enabled = false
    this.active = false

    if (this.reAcquireTimer) {
      window.clearInterval(this.reAcquireTimer)
      this.reAcquireTimer = null
    }

    this.fallbackStop()
  }

  private fallbackStart(): void {
    try {
      const AudioContextCtor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (!AudioContextCtor) return

      if (!this.audioContext) {
        this.audioContext = new AudioContextCtor()
      }
      if (!this.oscillator && !this.gainNode) {
        this.oscillator = this.audioContext.createOscillator()
        this.gainNode = this.audioContext.createGain()
        this.gainNode.gain.value = 0
        this.oscillator.connect(this.gainNode)
        this.gainNode.connect(this.audioContext.destination)
        this.oscillator.start()
      }
    } catch (e) {
      console.error('[WakeLock] 备用方案启动失败:', e)
    }
  }

  private fallbackStop(): void {
    try {
      if (this.oscillator) {
        try {
          this.oscillator.stop()
        } catch (e) {
          console.warn('[WakeLock] oscillator 停止失败:', e)
        }
        this.oscillator = null
      }
      if (this.audioContext) {
        this.audioContext.close()
        this.audioContext = null
      }
      this.gainNode = null
    } catch (e) {
      console.error('[WakeLock] 备用方案停止失败:', e)
    }
  }

  setActive(active: boolean): void {
    this.active = active
  }

  isEnabled(): boolean {
    return this.enabled
  }

  isActive(): boolean {
    return this.active
  }
}

export const wakeLockService = new WakeLockService()
export default wakeLockService
