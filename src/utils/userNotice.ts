/**
 * 用户可见提示浮层工具
 * 在页面顶层（document.documentElement）显示一条醒目提示，自动消失。
 * 采用独立 Shadow DOM 隔离，避免被平台清理脚本干扰，也不与页面样式冲突。
 */

interface NoticeOptions {
  /** 提示层级，控制颜色区分（info / warn / error） */
  type?: 'info' | 'warn' | 'error'
  /** 停留时长（毫秒），默认 4000 */
  duration?: number
}

const NOTICE_STYLE = `
.notice {
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  max-width: min(92vw, 560px);
  padding: 12px 20px;
  border-radius: 10px;
  font: 500 14px/1.5 -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #fff;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform-origin: center;
  animation: notice-in 0.25s ease forwards;
  pointer-events: auto;
  letter-spacing: 0.3px;
}
.notice.type-info { background: linear-gradient(135deg, #667eea, #764ba2); }
.notice.type-warn { background: linear-gradient(135deg, #f6a523, #e67e22); }
.notice.type-error { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.notice-leave { animation: notice-out 0.3s ease forwards; }
@keyframes notice-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes notice-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
}
.notice .notice-emoji { font-size: 18px; }
`

const NOTICE_ID = 'ouchn-user-notice'

let noticeHost: HTMLDivElement | null = null
let noticeEl: HTMLDivElement | null = null
let hideTimer: number | null = null

function ensureHost(): HTMLDivElement {
  if (noticeHost && document.documentElement.contains(noticeHost)) return noticeHost
  const host = document.createElement('div')
  host.id = NOTICE_ID
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = NOTICE_STYLE
  shadow.appendChild(style)
  document.documentElement.appendChild(host)
  noticeHost = host
  return host
}

/**
 * 显示一条用户提示，若干秒后自动消失（每次调用会清除上一条）。
 * @param message 提示内容
 * @param options 配置项
 */
export function showUserNotice(message: string, options: NoticeOptions = {}): void {
  if (typeof document === 'undefined' || !document.documentElement) return
  const { type = 'info', duration = 4000 } = options

  // 清理上一条
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (noticeEl) {
    noticeEl.remove()
    noticeEl = null
  }

  const host = ensureHost()
  const el = document.createElement('div')
  el.className = `notice type-${type}`
  const emojiMap = { info: '💡', warn: '⚠️', error: '⛔' }
  const emoji = emojiMap[type] || '💡'
  el.innerHTML = `<span class="notice-emoji">${emoji}</span><span>${message}</span>`
  host.shadowRoot!.appendChild(el)
  noticeEl = el

  hideTimer = window.setTimeout(() => {
    hideNotice()
  }, duration)
}

/** 立即隐藏当前提示（带退出动画） */
export function hideUserNotice(): void {
  hideNotice()
}

function hideNotice(): void {
  if (noticeEl) {
    noticeEl.classList.add('notice-leave')
    const el = noticeEl
    window.setTimeout(() => {
      el.remove()
      if (noticeEl === el) noticeEl = null
    }, 300)
  }
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  noticeEl = null
}