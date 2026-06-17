import { createApp } from 'vue'
import FloatingPanel from './components/FloatingPanel.vue'
import QuizPanel from './components/QuizPanel.vue'
import HomePanel from './components/HomePanel.vue'

console.log('[刷课脚本] 正在初始化...')

const STORAGE_KEY = 'ouchn_brusher_panel'

let isInitializing = false
let initializedPanel = ''

function savePanelType(type: string) {
  try {
    localStorage.setItem(STORAGE_KEY, type)
  } catch (e) {
    console.warn('[刷课脚本] 保存面板类型失败', e)
  }
}

function getSavedPanelType(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    return null
  }
}

function removeSavedPanelType() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('[刷课脚本] 移除面板类型失败', e)
  }
}

const isHomePage = (): boolean => {
  try {
    const url = window.location.href
    console.log('[刷课脚本] 当前URL:', url)
    
    const hostname = window.location.hostname
    console.log('[刷课脚本] hostname:', hostname)
    
    if (hostname.includes('student.syxy.ouchn.cn')) {
      console.log('[刷课脚本] 检测到学生站点')
      return true
    }
    
    console.log('[刷课脚本] 不是学生首页')
    return false
  } catch (e) {
    console.warn('[刷课脚本] 首页检测失败', e)
    return false
  }
}

const isQuizPage = (): boolean => {
  try {
    const url = window.location.href
    if (url.includes('/mod/quiz/')) return true
    if (url.includes('/mod/quiz') && (url.includes('attempt') || url.includes('review'))) return true
    if (document.querySelector('.que, .question')) {
      return true
    }
    return false
  } catch (e) {
    console.warn('[刷课脚本] URL 检测失败', e)
    return false
  }
}

function getPanelType(): 'home' | 'quiz' | 'course' | null {
  if (isHomePage()) return 'home'
  if (isQuizPage()) return 'quiz'
  if (window.location.href.includes('moodle.syxy.ouchn.cn')) return 'course'
  return null
}

function init() {
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

    const panelType = getPanelType()
    console.log('[刷课脚本] 面板类型:', panelType)

    const homeExists = document.getElementById('home-brushing-panel')
    const quizExists = document.getElementById('quiz-brushing-panel')
    const courseExists = document.getElementById('course-brushing-panel')
    
    if (homeExists || quizExists || courseExists) {
      console.log('[刷课脚本] 已有面板存在，跳过')
      return
    }

    isInitializing = true
    
    let container: HTMLDivElement
    
    if (panelType === 'home') {
      console.log('[刷课脚本] 检测到学生首页，加载学习助手')
      container = document.createElement('div')
      container.id = 'home-brushing-panel'
      container.setAttribute('data-panel-type', 'home')
      container.style.cssText = 'position:fixed;z-index:999999;pointer-events:auto;'
      document.body.appendChild(container)
      createApp(HomePanel).mount(container)
      initializedPanel = 'home'
      savePanelType('home')
    } else if (panelType === 'quiz') {
      console.log('[刷课脚本] 检测到答题页面，加载答题助手')
      container = document.createElement('div')
      container.id = 'quiz-brushing-panel'
      container.setAttribute('data-panel-type', 'quiz')
      document.body.appendChild(container)
      createApp(QuizPanel).mount(container)
      initializedPanel = 'quiz'
      savePanelType('quiz')
    } else if (panelType === 'course') {
      console.log('[刷课脚本] 加载刷课控制面板')
      container = document.createElement('div')
      container.id = 'course-brushing-panel'
      container.setAttribute('data-panel-type', 'course')
      document.body.appendChild(container)
      createApp(FloatingPanel).mount(container)
      initializedPanel = 'course'
      savePanelType('course')
    } else {
      console.log('[刷课脚本] 不匹配任何页面类型，不加载面板')
      isInitializing = false
      return
    }

    console.log('[刷课脚本] ✓ 初始化完成')
    isInitializing = false
    
    setTimeout(() => {
      const panel = document.getElementById('home-brushing-panel') || 
                    document.getElementById('quiz-brushing-panel') || 
                    document.getElementById('course-brushing-panel')
      if (panel) {
        console.log('[刷课脚本] 面板存在:', panel.id)
      } else {
        console.log('[刷课脚本] 面板不存在，尝试重新初始化')
        isInitializing = false
        initializedPanel = ''
        removeSavedPanelType()
      }
    }, 1000)
    
  } catch (e) {
    console.warn('[刷课脚本] 初始化失败:', e)
    isInitializing = false
  }
}

function scheduleInit() {
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
    
    const saved = getSavedPanelType()
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

scheduleInit()
