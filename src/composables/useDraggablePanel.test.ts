import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { PanelType } from '../types'
import { useDraggablePanel } from './useDraggablePanel'

type Api = ReturnType<typeof useDraggablePanel>

function mountComposable(): Api {
  let api!: Api
  const Comp = defineComponent({
    setup() {
      api = useDraggablePanel(PanelType.FLOATING, 56, 56, 30, 5)
      return () => h('div')
    }
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  createApp(Comp).mount(container)
  return api
}

function pointer(type: string, init: PointerEventInit): PointerEvent {
  return new PointerEvent(type, { bubbles: true, ...init })
}

describe('useDraggablePanel 指针拖拽', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('只响应主键：右键按下不进入拖拽', () => {
    const api = mountComposable()
    api.onDragStart(pointer('pointerdown', { button: 2, clientX: 10, clientY: 10 }))
    expect(api.isDragging.value).toBe(false)
  })

  it('拖拽过程中跟随 pointermove，并记录超过阈值的位移', () => {
    const api = mountComposable()
    const start = { x: api.position.value.x, y: api.position.value.y }

    api.onDragStart(pointer('pointerdown', { button: 0, clientX: start.x, clientY: start.y }))
    expect(api.isDragging.value).toBe(true)

    // 面板默认贴右边缘，向左拖才有空间（边界会 clamp 掉越界位移）
    document.dispatchEvent(pointer('pointermove', { clientX: start.x - 40, clientY: start.y + 60 }))
    expect(api.position.value.x).toBeLessThan(start.x)
    expect(api.position.value.y).toBeGreaterThan(start.y)
    expect(api.didDragMove()).toBe(true)
  })

  it('pointercancel 结束拖拽（触摸被系统打断时不会卡在拖拽态）', () => {
    const api = mountComposable()
    api.onDragStart(pointer('pointerdown', { button: 0, clientX: 100, clientY: 100 }))
    document.dispatchEvent(pointer('pointercancel', {}))
    expect(api.isDragging.value).toBe(false)
  })

  it('拖拽结束后吸附到最近的边缘', () => {
    vi.useFakeTimers()
    const api = mountComposable()
    const start = { x: api.position.value.x, y: api.position.value.y }

    api.onDragStart(pointer('pointerdown', { button: 0, clientX: start.x, clientY: start.y }))
    document.dispatchEvent(pointer('pointermove', { clientX: 5, clientY: start.y + 30 }))
    document.dispatchEvent(pointer('pointerup', {}))

    vi.advanceTimersByTime(400)
    // 吸附后回到左边界（margin = 30）
    expect(api.position.value.x).toBe(30)
    vi.useRealTimers()
  })

  it('未超过拖拽阈值时不吸附，位置保持不变', () => {
    const api = mountComposable()
    const start = { x: api.position.value.x, y: api.position.value.y }

    api.onDragStart(pointer('pointerdown', { button: 0, clientX: start.x, clientY: start.y }))
    document.dispatchEvent(pointer('pointerup', {}))

    expect(api.didDragMove()).toBe(false)
    expect(api.position.value.x).toBe(start.x)
    expect(api.position.value.y).toBe(start.y)
  })

  it('pointerup 之后解绑监听，后续 pointermove 不再移动面板', () => {
    const api = mountComposable()
    const start = { x: api.position.value.x, y: api.position.value.y }

    api.onDragStart(pointer('pointerdown', { button: 0, clientX: start.x, clientY: start.y }))
    document.dispatchEvent(pointer('pointermove', { clientX: start.x + 50, clientY: start.y }))
    const moved = api.position.value.x
    document.dispatchEvent(pointer('pointerup', {}))

    document.dispatchEvent(pointer('pointermove', { clientX: start.x + 200, clientY: start.y }))
    // 松开后位置只受吸附影响，不会再跟随指针
    expect(api.position.value.x).not.toBe(start.x + 200)
    expect(typeof moved).toBe('number')
  })
})
