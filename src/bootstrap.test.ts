import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const PANEL_IDS = [
  'home-brushing-panel',
  'quiz-brushing-panel',
  'course-brushing-panel',
  'mod-brushing-panel'
]

function findPanel(): HTMLElement | null {
  for (const id of PANEL_IDS) {
    const el = document.getElementById(id)
    if (el) return el
  }
  return null
}

/**
 * bootstrap 的挂载/卸载是模块级单例，且 init 依赖真实页面判断。
 * 这里守的是「反复重建面板不会累积监听」：
 * 曾经每次 mountPanel 都新挂 MutationObserver + matchMedia 监听，
 * 却没有任何地方释放，面板重建（跳转 / 宿主被平台清理 / 30 秒兜底）后无限累积。
 * 现在 mountPanel 挂之前先 teardown，unmountPanel 也会 teardown，两条路径都堵死。
 */
describe('bootstrap 主题监听生命周期', () => {
  let activeObservers = 0
  let mediaListeners = 0

  beforeEach(() => {
    activeObservers = 0
    mediaListeners = 0

    const RealMO = window.MutationObserver
    class CountingMO extends RealMO {
      private closed = false

      constructor(cb: MutationCallback) {
        super(cb)
        activeObservers++
      }

      override disconnect(): void {
        if (!this.closed) {
          this.closed = true
          activeObservers--
        }
        super.disconnect()
      }
    }
    vi.stubGlobal('MutationObserver', CountingMO)

    const realMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = ((query: string) => {
      const mql = realMatchMedia(query)
      const add = mql.addEventListener.bind(mql)
      const remove = mql.removeEventListener.bind(mql)
      mql.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject) => {
        mediaListeners++
        add(type, fn)
      }) as typeof mql.addEventListener
      mql.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject) => {
        mediaListeners--
        remove(type, fn)
      }) as typeof mql.removeEventListener
      return mql
    }) as typeof window.matchMedia
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    findPanel()?.remove()
  })

  it('反复重建面板后，主题监听数量不累积', async () => {
    window.history.pushState({}, '', '/course/view.php?id=9527')
    vi.resetModules()
    const { scheduleInit } = await import('./bootstrap')

    scheduleInit()

    await vi.waitFor(() => {
      expect(findPanel()).toBeTruthy()
    }, { timeout: 5000 })

    const first = { observers: activeObservers, media: mediaListeners }
    expect(first.observers).toBeGreaterThan(0)

    for (let i = 0; i < 3; i++) {
      findPanel()?.remove()
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await vi.waitFor(() => {
        expect(findPanel()).toBeTruthy()
      }, { timeout: 5000 })
    }

    // 重建 3 次后监听数应回到同一水位，而不是 +3
    expect(activeObservers).toBeLessThanOrEqual(first.observers)
    expect(mediaListeners).toBeLessThanOrEqual(first.media)
  }, 30000)
})
