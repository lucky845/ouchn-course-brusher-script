/**
 * 面板初始化 / 启动流程
 */
import { createApp } from 'vue'
import FloatingPanel from './components/FloatingPanel.vue'
import QuizPanel from './components/QuizPanel.vue'
import HomePanel from './components/HomePanel.vue'
import CoursePanel from './components/CoursePanel.vue'
import { writeStorageString, removeStorage } from './utils/storage'
import { isStudentHomePage, isQuizPage, isCoursePage, isModPage } from './utils/url'
import { sidebarStatusInjector } from './services/sidebarStatusInjector'
import { settingsStoreService } from './services/settingsStore'
import { PANEL_TYPE_KEY } from './services/storageKeys'

type PanelTypeKey = 'home' | 'quiz' | 'course' | 'mod'

interface PanelConfig {
  id: string
  type: PanelTypeKey
  label: string
  component: typeof HomePanel | typeof QuizPanel | typeof FloatingPanel | typeof CoursePanel
}

const PANEL_CONFIGS: Record<PanelTypeKey, PanelConfig> = {
  home: { id: 'home-brushing-panel', type: 'home', label: '学生首页', component: HomePanel },
  quiz: { id: 'quiz-brushing-panel', type: 'quiz', label: '答题页面', component: QuizPanel },
  course: { id: 'course-brushing-panel', type: 'course', label: '课程页面', component: CoursePanel },
  mod: { id: 'mod-brushing-panel', type: 'mod', label: '刷课页面', component: FloatingPanel }
}

let isInitializing = false
let initializedPanel = ''

function detectPanelType(): PanelTypeKey | null {
  if (isStudentHomePage()) return 'home'
  if (isQuizPage()) {
    // 若正处于刷课模式（已启用且存在进行中的刷课会话），保持刷课面板，
    // 不要切换到答题面板，让 FloatingPanel 在测验页显示提示并继续刷课（跳过测验）。
    if (isActivelyBrushing()) return 'mod'
    return 'quiz'
  }
  if (isCoursePage()) return 'course'
  if (isModPage()) return 'mod'
  return null
}

/** 判断是否正处于刷课进行中：已启用 且 存在进行中的刷课会话（startTime>0） */
function isActivelyBrushing(): boolean {
  try {
    if (!settingsStoreService.isEnabled()) return false
    const session = settingsStoreService.sessionGet()
    return session.startTime > 0
  } catch {
    return false
  }
}

function hasExistingPanel(): boolean {
  return !!document.getElementById('home-brushing-panel') ||
         !!document.getElementById('quiz-brushing-panel') ||
         !!document.getElementById('course-brushing-panel') ||
         !!document.getElementById('mod-brushing-panel')
}

function mountPanel(panelType: PanelTypeKey): void {
  const config = PANEL_CONFIGS[panelType]
  // 使用 Shadow DOM 容器，避免平台清理
  const host = document.createElement('div')
  host.id = config.id
  host.style.cssText = 'position:fixed!important;z-index:2147483647!important;pointer-events:auto!important;top:0;left:0;'
  const shadow = host.attachShadow({ mode: 'open' })
  const container = document.createElement('div')
  container.id = 'panel-root'
  shadow.appendChild(container)
  // 挂载到 document.documentElement 而非 body，避免平台清理 body 子节点
  document.documentElement.appendChild(host)

  // 关键：GM_addStyle 注入的全局 CSS 进不了 Shadow DOM，需手动复制到 shadow root
  try {
    const copyStylesIntoShadow = (): void => {
      const shadowStyle = document.createElement('style')
      shadowStyle.id = 'ouchn-shadow-styles'
      let css = ''
      // 首选构建时内联的全局 CSS，最可靠（不依赖 head 中可能被平台清理的 style）
      try {
        const inline = (window as any).__OCHN_CSS__
        if (typeof inline === 'string' && inline.length > 0) {
          css += inline + '\n'
        }
      } catch {}
      // 兜底：复制 head 里所有 style 标签内容
      if (!css) {
        document.querySelectorAll('style').forEach((s) => {
          const text = s.textContent || ''
          if (text && text.length > 0) css += text + '\n'
        })
      }
      if (css) {
        shadowStyle.textContent = css
        // 移除旧节点避免重复
        const old = shadow.getElementById('ouchn-shadow-styles')
        if (old) old.remove()
        shadow.insertBefore(shadowStyle, container)
      }
    }
    copyStylesIntoShadow()
    window.setTimeout(copyStylesIntoShadow, 200)
    window.setTimeout(copyStylesIntoShadow, 800)
    window.setTimeout(copyStylesIntoShadow, 1500)
  } catch {}
  try {
    createApp(config.component).mount(container)
  } catch (e) {
    console.error('[刷课脚本] Vue 挂载失败:', e)
    host.textContent = '刷课脚本挂载失败: ' + (e as Error).message
  }
  initializedPanel = panelType
  writeStorageString(PANEL_TYPE_KEY, panelType)
  // 诊断标记
  const marker = document.createElement('div')
  marker.textContent = '✓ ' + config.label
  marker.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:2147483647;background:#6c5ce7;color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;'
  document.documentElement.appendChild(marker)
}

function init(): void {
  if (isInitializing) return
  try {
    if (!document.documentElement) return
    const panelType = detectPanelType()
    if (!panelType) return
    if (hasExistingPanel()) return

    isInitializing = true
    mountPanel(panelType)
    try { sidebarStatusInjector.init() } catch {}
    isInitializing = false

    setTimeout(() => {
      if (!hasExistingPanel()) {
        isInitializing = false
        initializedPanel = ''
        removeStorage(PANEL_TYPE_KEY)
      }
    }, 1000)
  } catch (e) {
    console.warn('[刷课脚本] 初始化失败:', e)
    isInitializing = false
  }
}

export function scheduleInit(): void {
  const ensurePanel = (): void => {
    const pt = detectPanelType()
    if (!pt) return
    if (hasExistingPanel()) return
    initializedPanel = ''
    isInitializing = false
    init()
  }

  const runInit = (): void => {
    if (initializedPanel && hasExistingPanel()) return
    init()
  }

  const checkAndInit = (): void => {
    runInit()
  }

  setTimeout(checkAndInit, 300)
  setTimeout(checkAndInit, 800)
  setTimeout(checkAndInit, 1500)

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkAndInit, 500)
  })

  window.addEventListener('load', () => {
    setTimeout(checkAndInit, 300)
  })

  window.addEventListener('hashchange', () => setTimeout(ensurePanel, 300))
  window.addEventListener('popstate', () => setTimeout(ensurePanel, 300))

  const observer = new MutationObserver(() => {
    ensurePanel()
  })
  const attachObserver = (): void => {
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true })
    }
  }
  if (document.documentElement) attachObserver()
  else document.addEventListener('DOMContentLoaded', attachObserver)

  // 兜底轮询
  window.setInterval(ensurePanel, 1000)
}