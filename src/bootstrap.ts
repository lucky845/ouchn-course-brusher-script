/**
 * 面板初始化 / 启动流程
 * 将 main.ts 中的初始化流程、URL 检测、localStorage 管理等逻辑集中到此文件
 */
import { createApp } from 'vue'
import FloatingPanel from './components/FloatingPanel.vue'
import QuizPanel from './components/QuizPanel.vue'
import HomePanel from './components/HomePanel.vue'
import CoursePanel from './components/CoursePanel.vue'
import { writeStorageString, readStorageString, removeStorage } from './utils/storage'
import { isStudentHomePage, isQuizPage, isCoursePage } from './utils/url'

const STORAGE_KEY = 'ouchn_brusher_panel'

type PanelTypeKey = 'home' | 'quiz' | 'course'

interface PanelConfig {
  id: string
  type: PanelTypeKey
  label: string
  component: typeof HomePanel | typeof QuizPanel | typeof FloatingPanel | typeof CoursePanel
}

const PANEL_CONFIGS: Record<PanelTypeKey, PanelConfig> = {
  home: {
    id: 'home-brushing-panel',
    type: 'home',
    label: '学生首页',
    component: HomePanel,
  },
  quiz: {
    id: 'quiz-brushing-panel',
    type: 'quiz',
    label: '答题页面',
    component: QuizPanel,
  },
  course: {
    id: 'course-brushing-panel',
    type: 'course',
    label: '课程页面',
    component: CoursePanel,
  },
}

let isInitializing = false
let initializedPanel = ''

/**
 * 检测当前应加载的面板类型
 */
function detectPanelType (): PanelTypeKey | null {
  if (isStudentHomePage()) return 'home'
  if (isQuizPage()) return 'quiz'
  if (isCoursePage()) return 'course'
  return null
}

/**
 * 挂载指定类型的 Vue 面板
 */
function mountPanel (panelType: PanelTypeKey): void {
  const config = PANEL_CONFIGS[panelType]
  const container = document.createElement('div')
  container.id = config.id
  container.setAttribute('data-panel-type', config.type)
  container.style.cssText = 'position:fixed;z-index:999999;pointer-events:auto;'
  document.body.appendChild(container)
  createApp(config.component).mount(container)
  initializedPanel = panelType
  writeStorageString(STORAGE_KEY, panelType)
}

/**
 * 检查当前页面上是否已经存在任何面板容器
 */
function hasExistingPanel (): boolean {
  return !!document.getElementById('home-brushing-panel') ||
         !!document.getElementById('quiz-brushing-panel') ||
         !!document.getElementById('course-brushing-panel')
}

/**
 * 尝试初始化：检测页面类型 → 挂载对应面板
 */
function init (): void {
  if (isInitializing) {
    console.log('[刷课脚本] 正在初始化中，跳过')
    return
  }

  try {
    if (typeof document === 'undefined') return

    if (!document.body) {
      console.log('[刷课脚本] body 不存在，延迟重试')
      setTimeout(init, 300)
      return
    }

    const panelType = detectPanelType()
    console.log('[刷课脚本] 面板类型:', panelType)

    if (hasExistingPanel()) {
      console.log('[刷课脚本] 已有面板存在，跳过')
      return
    }

    if (!panelType) {
      console.log('[刷课脚本] 不匹配任何页面类型，不加载面板')
      isInitializing = false
      return
    }

    isInitializing = true
    mountPanel(panelType)
    console.log('[刷课脚本] ✓ 初始化完成')
    isInitializing = false

    setTimeout(() => {
      const panel = document.getElementById(PANEL_CONFIGS[panelType].id)
      if (!panel) {
        console.log('[刷课脚本] 面板不存在，尝试重新初始化')
        isInitializing = false
        initializedPanel = ''
        removeStorage(STORAGE_KEY)
      }
    }, 1000)
  } catch (e) {
    console.warn('[刷课脚本] 初始化失败:', e)
    isInitializing = false
  }
}

/**
 * 调度初始化：在多个时间点 / 事件下尝试启动
 */
export function scheduleInit (): void {
  console.log('[刷课脚本] 调度初始化')

  const runInit = () => {
    if (initializedPanel) {
      console.log('[刷课脚本] 已初始化过:', initializedPanel)
      return
    }
    init()
  }

  const checkAndInit = () => {
    if (initializedPanel) return

    const saved = readStorageString(STORAGE_KEY)
    if (saved) {
      console.log('[刷课脚本] 检测到保存的面板类型:', saved)
    }

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
}
