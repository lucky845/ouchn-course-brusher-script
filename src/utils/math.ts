/**
 * 通用数学工具
 * 从组件中抽离，避免在多个面板组件中重复定义
 */

/** 将值限制在 [min, max] 范围内 */
export function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 根据窗口宽度和按钮尺寸计算可拖拽的边界范围
 * 用于悬浮按钮拖拽时的上下左右边界约束
 */
export function getPanelBounds (
  btnWidth: number,
  btnHeight: number,
  margin: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (typeof window === 'undefined') {
    return {
      minX: margin,
      minY: margin,
      maxX: btnWidth + margin,
      maxY: btnHeight + margin,
    }
  }
  const ww = window.innerWidth
  const wh = window.innerHeight
  return {
    minX: margin,
    minY: margin,
    maxX: ww - btnWidth - margin,
    maxY: wh - btnHeight - margin,
  }
}
