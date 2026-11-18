/**
 * 剪贴板工具
 * 统一处理文本复制到剪贴板：优先 Clipboard API，失败时退回 execCommand。
 */

/**
 * 降级复制：textarea + execCommand('copy')
 * 必须在用户点击的同步调用栈里执行，否则浏览器会拒绝。
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false
  const ta = document.createElement('textarea')
  ta.value = text
  // readonly 避免移动端弹出键盘；位置放到视口外而不是 opacity:0，
  // 某些浏览器会跳过不可见元素的选区
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
  document.body.appendChild(ta)
  try {
    ta.select()
    ta.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}

/**
 * 尝试将文本复制到剪贴板
 *
 * navigator.clipboard 只在安全上下文（https / localhost）可用，且写入可能被权限拒绝，
 * 所以两种失败都要落到 execCommand 回退，而不是直接返回 false。
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 继续走降级方案
    }
  }

  try {
    return legacyCopy(text)
  } catch {
    return false
  }
}
