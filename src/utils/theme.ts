/**
 * 主题切换
 * 主题写在 <html data-ouch-theme> 上：变量定义在全局样式里，
 * 面板的 Shadow DOM 通过宿主链读到同一套变量。
 */
import type { ThemeMode } from '../types'

const THEME_ATTR = 'data-ouch-theme'

/** 应用主题；auto 表示跟随系统（移除属性，交给 CSS 媒体查询） */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'auto') {
    root.removeAttribute(THEME_ATTR)
  } else {
    root.setAttribute(THEME_ATTR, mode)
  }
}
