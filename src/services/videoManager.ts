import { SpeedMode } from '../types'

export class VideoManagerService {
  private video: HTMLVideoElement | null = null
  private protectedVideos: Map<HTMLVideoElement, number> = new Map()
  private activeIntervals: Set<number> = new Set()
  private onCompleteCallback: (() => void) | null = null
  private speedMode: SpeedMode = SpeedMode.NORMAL
  private videoPlaybackRate: number = 1

  find(): HTMLVideoElement | null {
    try {
      if (typeof document === 'undefined') {
        return null
      }

      const directVideo = document.querySelector('video')
      if (directVideo && directVideo instanceof HTMLVideoElement) {
        this.video = directVideo
        return directVideo
      }

      try {
        const iframes = document.querySelectorAll('iframe')
        for (let i = 0; i < iframes.length; i++) {
          const iframe = iframes[i]
          if (!iframe) continue
          try {
            const iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)
            if (!iframeDoc) continue
            const iframeVideo = iframeDoc.querySelector('video')
            if (iframeVideo && iframeVideo instanceof HTMLVideoElement) {
              this.video = iframeVideo
              return iframeVideo
            }
          } catch {
          }
        }
      } catch {
      }

      this.video = null
      return null
    } catch {
      this.video = null
      return null
    }
  }

  protectPlaybackRate(targetRate: number): void {
    try {
      const currentVideo = this.video
      if (!currentVideo) return

      if (!this.protectedVideos.has(currentVideo)) {
        const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate')
        const targetValue = targetRate

        try {
          Object.defineProperty(currentVideo, 'playbackRate', {
            configurable: true,
            get: function (): number {
              if (originalDescriptor && originalDescriptor.get) {
                try {
                  return originalDescriptor.get.call(this) as number
                } catch {
                  return targetValue
                }
              }
              return targetValue
            },
            set: function (value: number): void {
              try {
                if (originalDescriptor && originalDescriptor.set) {
                  originalDescriptor.set.call(this, targetValue)
                }
              } catch {
              }
            }
          })
        } catch {
        }

        this.protectedVideos.set(currentVideo, targetValue)
      }

      try {
        const descriptor = Object.getOwnPropertyDescriptor(currentVideo, 'playbackRate')
        if (descriptor && descriptor.set) {
          descriptor.set.call(currentVideo, targetRate)
        } else {
          const protoDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate')
          if (protoDesc && protoDesc.set) {
            protoDesc.set.call(currentVideo, targetRate)
          } else {
            currentVideo.playbackRate = targetRate
          }
        }
      } catch {
      }
    } catch {
    }
  }

  setPlaybackRate(rate: number): void {
    try {
      if (!this.video) return
      this.protectPlaybackRate(rate)
    } catch {
    }
  }

  async play(): Promise<boolean> {
    if (!this.video) return false

    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!this.video) return false
        this.video.muted = true
        await this.video.play()
        return true
      } catch {
        if (attempt === maxAttempts) {
          return false
        }
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(() => {
            window.clearTimeout(timer)
            resolve()
          }, 300 * attempt)
        })
      }
    }
    return false
  }

  setupAutoAdvance(onComplete: () => void): void {
    try {
      this.onCompleteCallback = onComplete
      const currentVideo = this.video
      if (!currentVideo) return

      try {
        currentVideo.addEventListener('ended', () => {
          try {
            if (this.onCompleteCallback) {
              this.onCompleteCallback()
            }
          } catch {
          }
        })
      } catch {
      }

      try {
        const checkInterval = window.setInterval(() => {
          try {
            const v = this.video
            if (!v) return
            if (v.paused && !v.ended) {
              v.muted = true
              const playPromise = v.play()
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {})
              }
            }
          } catch {
          }
        }, 1000)
        this.activeIntervals.add(checkInterval)
      } catch {
      }

      try {
        currentVideo.addEventListener('click', () => {
          try {
            const v = this.video
            if (v) {
              v.muted = false
            }
          } catch {
          }
        })
      } catch {
      }

      try {
        if (this.speedMode === SpeedMode.FAST && this.videoPlaybackRate !== 1) {
          this.setPlaybackRate(this.videoPlaybackRate)
        }
      } catch {
      }
    } catch {
    }
  }

  cleanup(): void {
    try {
      this.activeIntervals.forEach((id) => {
        try {
          window.clearInterval(id)
        } catch {
        }
      })
      this.activeIntervals.clear()

      try {
        this.protectedVideos.forEach((_, vid) => {
          try {
            const desc = Object.getOwnPropertyDescriptor(vid, 'playbackRate')
            if (desc && desc.configurable) {
              Object.defineProperty(vid, 'playbackRate', {
                configurable: true,
                enumerable: true,
                writable: true,
                value: vid.playbackRate
              })
            }
          } catch {
          }
        })
      } catch {
      }

      this.protectedVideos.clear()
      this.video = null
      this.onCompleteCallback = null
    } catch {
      this.video = null
    }
  }

  getVideo(): HTMLVideoElement | null {
    return this.video
  }

  setPlaybackSettings(speedMode: SpeedMode, playbackRate: number): void {
    try {
      this.speedMode = speedMode
      this.videoPlaybackRate = playbackRate
    } catch {
    }
  }
}

export const videoManagerService = new VideoManagerService()
export default videoManagerService