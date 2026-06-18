/**
 * useDraggablePanel —— 可拖拽悬浮面板的 Vue composable
 *
 * 统一三个面板（刷课助手、答题助手、首页课程）的拖拽/吸附/位置记忆逻辑，
 * 避免在每个组件中重复实现相同的拖拽状态管理与边界计算。
 *
 * 使用方式：
 *   const { position, isSnapping, onDragStart, onDragMove, onDragEnd, cleanup, handleResize } =
 *     useDraggablePanel(PanelType.FLOATING, 56, 56, 10, 5)
 */

import type { Ref } from 'vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { PanelEdge, PanelType } from '../types'
import { settingsStoreService } from '../services/settingsStore'
import { clamp, getPanelBounds } from '../utils/math'

export interface DraggablePanel {
  /** 面板位置（px），作为响应式 ref 可直接绑定到 style transform */
  position: Ref<{ x: number; y: number }>
  /** 是否正在播放吸附动画（用于控制 CSS transition 启用） */
  isSnapping: Ref<boolean>
  /** 是否正在拖拽中（用于模板控制 CSS 类） */
  isDragging: Ref<boolean>
  /** 当前吸附的边缘（左/右） */
  snapEdge: PanelEdge
  /** 鼠标按下事件处理器，绑定到 @mousedown.prevent */
  onDragStart: (e: MouseEvent) => void
  /** 点击事件辅助判断：是否刚刚发生了拖拽（点击前需检查） */
  didDragMove: () => boolean
  /** 点击事件辅助：重置 didDragMove 标志（在 click 处理末尾调用） */
  resetDragMove: () => void
  /** 主动触发一次窗口 resize 的位置校正 */
  handleResize: () => void
  /** 清理内部事件监听，组件 unmount 时自动调用 */
  cleanup: () => void
}

/**
 * @param panelType  面板类型，用于 localStorage 独立存储位置
 * @param btnWidth   按钮/面板宽度（px）
 * @param btnHeight  按钮/面板高度（px）
 * @param margin     离边缘的间距（px）
 * @param dragThreshold  判定为拖拽而非点击的像素阈值
 */
export function useDraggablePanel (
  panelType: PanelType,
  btnWidth: number,
  btnHeight: number,
  margin: number = 10,
  dragThreshold: number = 5,
): DraggablePanel {
  // === 位置初始化 ===
  const saved = settingsStoreService.getPanelPosition(panelType, btnWidth, margin)
  let snapEdge: PanelEdge = saved.edge
  const position = ref({
    x: snapEdge === PanelEdge.LEFT ? margin : window.innerWidth - btnWidth - margin,
    y: saved.y,
  })

  // === 拖拽状态 ===
  const isDragging = ref(false)
  let dragOffset = { x: 0, y: 0 }
  let _didDragMove = false
  const isSnapping = ref(false)

  function didDragMove (): boolean {
    return _didDragMove
  }

  function resetDragMove (): void {
    _didDragMove = false
  }

  // === 事件处理 ===
  function onDragStart (e: MouseEvent): void {
    isSnapping.value = false
    dragOffset = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
    isDragging.value = true
    _didDragMove = false
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }

  function onDragMove (e: MouseEvent): void {
    if (!isDragging.value) return
    const rawX = e.clientX - dragOffset.x
    const rawY = e.clientY - dragOffset.y
    if (!_didDragMove) {
      if (Math.abs(rawX - position.value.x) > dragThreshold || Math.abs(rawY - position.value.y) > dragThreshold) {
        _didDragMove = true
      }
    }
    const bounds = getPanelBounds(btnWidth, btnHeight, margin)
    position.value = {
      x: clamp(rawX, bounds.minX, bounds.maxX),
      y: clamp(rawY, bounds.minY, bounds.maxY),
    }
  }

  function onDragEnd (): void {
    isDragging.value = false
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)

    if (_didDragMove) {
      const ww = window.innerWidth
      const centerX = position.value.x + btnWidth / 2
      const snapLeft = centerX < ww / 2
      snapEdge = snapLeft ? PanelEdge.LEFT : PanelEdge.RIGHT

      const bounds = getPanelBounds(btnWidth, btnHeight, margin)
      const targetX = snapLeft ? bounds.minX : bounds.maxX
      const targetY = clamp(position.value.y, bounds.minY, bounds.maxY)

      isSnapping.value = true
      position.value = { x: targetX, y: targetY }

      window.setTimeout(() => {
        isSnapping.value = false
        settingsStoreService.savePanelPosition(panelType, position.value.y, snapEdge)
      }, 280)
    }
  }

  function handleResize (): void {
    const bounds = getPanelBounds(btnWidth, btnHeight, margin)
    const targetX = snapEdge === PanelEdge.LEFT ? bounds.minX : bounds.maxX
    position.value = {
      x: targetX,
      y: clamp(position.value.y, bounds.minY, bounds.maxY),
    }
  }

  function cleanup (): void {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('resize', handleResize)
  }

  // === 自动挂载/解绑 ===
  let mounted = false
  onMounted(() => {
    if (mounted) return
    mounted = true
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    position,
    isSnapping,
    isDragging,
    snapEdge,
    onDragStart,
    didDragMove,
    resetDragMove,
    handleResize,
    cleanup,
  }
}
