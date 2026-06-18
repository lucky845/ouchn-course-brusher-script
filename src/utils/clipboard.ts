/**
 * 剪贴板工具
 * 统一处理文本复制到剪贴板（优先使用 Clipboard API，降级方案为 textarea + execCommand）
 */

/**
 * 尝试将文本复制到剪贴板
 * @returns 是否成功
 */
export async function copyToClipboard (text: string): Promise<boolean> {
  try {
    if (!text) return false

    // 优先使用现代 Clipboard API
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 降级方案：通过 textarea + execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
