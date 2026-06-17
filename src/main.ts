import { createApp } from 'vue'
import FloatingPanel from './components/FloatingPanel.vue'
import QuizPanel from './components/QuizPanel.vue'

console.log('[刷课脚本] 正在初始化...')

// 判断是否为答题页面
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

// 初始化函数
function init () {
  try {
    if (typeof document === 'undefined') return

    // 确保 body 存在
    if (!document.body) {
      setTimeout(init, 300)
      return
    }

    // 防止重复初始化
    if (document.getElementById('course-brushing-panel') || document.getElementById('quiz-brushing-panel')) {
      return
    }

    if (isQuizPage()) {
      console.log('[刷课脚本] 检测到答题页面，加载答题助手')
      const container = document.createElement('div')
      container.id = 'quiz-brushing-panel'
      document.body.appendChild(container)
      createApp(QuizPanel).mount(container)
    } else {
      console.log('[刷课脚本] 加载刷课控制面板')
      const container = document.createElement('div')
      container.id = 'course-brushing-panel'
      document.body.appendChild(container)
      createApp(FloatingPanel).mount(container)
    }

    console.log('[刷课脚本] ✓ 初始化完成')
  } catch (e) {
    console.warn('[刷课脚本] 初始化失败:', e)
  }
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 800)
  })
} else {
  setTimeout(init, 800)
}

// 页面完全加载后再次检查
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!document.getElementById('course-brushing-panel') && !document.getElementById('quiz-brushing-panel')) {
      init()
    }
  }, 500)
})
