/**
 * URL 和页面检测工具
 * 统一处理 URL 解析、查询参数提取、页面类型判断等通用逻辑
 */

/**
 * 解析 URL 的查询参数为对象
 * @param href 完整 URL（如 https://example.com/course/view.php?id=123&lang=zh）
 * @returns 参数对象（如 { id: '123', lang: 'zh' }）
 */
export function parseQueryParams (href: string): Record<string, string> {
  const params: Record<string, string> = {}
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.href : undefined)
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })
  } catch {
    // 解析失败时回退到手动解析
    const queryStart = href.indexOf('?')
    if (queryStart !== -1) {
      const queryEnd = href.indexOf('#', queryStart)
      const query = queryEnd === -1
        ? href.substring(queryStart + 1)
        : href.substring(queryStart + 1, queryEnd)
      query.split('&').forEach(pair => {
        const [key, value] = pair.split('=')
        if (key) {
          try { params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '' } catch { params[key] = value || '' }
        }
      })
    }
  }
  return params
}

/**
 * 获取 URL 的 base path（protocol + host + pathname，不含查询和 hash）
 */
export function getBasePath (href: string): string {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.href : undefined)
    return url.origin + url.pathname
  } catch {
    return href
  }
}

/**
 * 判断当前页面是否为学习内容页（包含 /mod/ 路径）
 */
export function isActivityPage (): boolean {
  return typeof window !== 'undefined' && window.location.href.indexOf('/mod/') !== -1
}

/**
 * 判断当前页面是否为课程主页（课程目录页）
 */
export function isCoursePage (): boolean {
  if (typeof window === 'undefined') return false
  const href = window.location.href
  if (href.indexOf('/course/view.php') !== -1) return true
  return href.indexOf('/course/index') !== -1
}

/**
 * 判断当前页面是否为学生首页站点
 */
export function isStudentHomePage (): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.includes('student.syxy.ouchn.cn')
}

/**
 * 判断当前页面是否为答题/测验页面
 */
export function isQuizPage (): boolean {
  if (typeof window === 'undefined') return false
  const href = window.location.href
  if (href.includes('/mod/quiz/')) return true
  if (href.includes('/mod/quiz') && (href.includes('attempt') || href.includes('review'))) return true
  if (typeof document !== 'undefined' && document.querySelector('.que, .question')) return true
  return false
}
