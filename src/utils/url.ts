/**
 * URL 和页面检测工具
 * 统一处理 URL 解析、查询参数提取、页面类型判断等通用逻辑
 */

/**
 * 解析 URL 的查询参数为对象
 * @param href 完整 URL（如 https://example.com/course/view.php?id=123&lang=zh）
 * @returns 参数对象（如 { id: '123', lang: 'zh' }）
 */
export function parseQueryParams(href: string): Record<string, string> {
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
      query.split('&').forEach((pair) => {
        const [key, value] = pair.split('=')
        if (key) {
          try {
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
          } catch {
            params[key] = value || ''
          }
        }
      })
    }
  }
  return params
}

/**
 * 获取 URL 的 base path（protocol + host + pathname，不含查询和 hash）
 */
export function getBasePath(href: string): string {
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
export function isActivityPage(): boolean {
  return typeof window !== 'undefined' && window.location.href.indexOf('/mod/') !== -1
}

/**
 * 判断当前页面是否为课程主页（课程目录页）
 */
export function isCoursePage(): boolean {
  if (typeof window === 'undefined') return false
  const href = window.location.href
  // 标准课程页面
  if (href.indexOf('/course/view.php') !== -1) return true
  if (href.indexOf('/course/index') !== -1) return true
  // 课程管理页面
  if (href.indexOf('/course/management') !== -1) return true
  // 课程编辑页面
  if (href.indexOf('/course/edit.php') !== -1) return true
  // 检查页面元素特征
  if (typeof document !== 'undefined') {
    // 课程页面通常有这些特征元素
    if (document.querySelector('.course-content, .course-header, .course-section')) return true
    if (document.querySelector('[role="main"] .page-header-data .page-title')) {
      const title = document.querySelector('.page-header-data .page-title')?.textContent || ''
      if (title.includes('课程') || title.includes('Course')) return true
    }
  }
  return false
}

/**
 * 判断当前页面是否为刷课内容页（/mod/* 路径下的视频、页面、论坛等）
 */
export function isModPage(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.indexOf('/mod/') === 0
}

/**
 * 判断当前页面是否为学生首页站点
 */
export function isStudentHomePage(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.includes('student.syxy.ouchn.cn')
}

/**
 * 判断当前页面是否为答题/测验页面
 */
export function isQuizPage(): boolean {
  if (typeof window === 'undefined') return false
  const href = window.location.href
  if (href.includes('/mod/quiz/')) return true
  if (href.includes('/mod/quiz') && (href.includes('attempt') || href.includes('review'))) return true
  if (typeof document !== 'undefined' && document.querySelector('.que, .question')) return true
  return false
}

/**
 * 获取课程详情页的课程 ID
 * @returns 课程 ID（如 190），如果不在课程详情页则返回 null
 */
export function getCourseId(): string | null {
  if (typeof window === 'undefined') return null
  const href = window.location.href
  const match = href.match(/\/course\/view\.php\?id=(\d+)/)
  return match ? match[1] : null
}

/**
 * 获取课程详情页的课程名称
 * @returns 课程名称，如果获取失败则返回空字符串
 */
export function getCourseName(): string {
  if (typeof document === 'undefined') return ''
  // 尝试从页面标题获取
  const titleEl = document.querySelector('.page-header-data .page-title, h1, .coursename')
  if (titleEl) {
    return titleEl.textContent?.trim() || ''
  }
  // 从 document.title 获取
  const docTitle = document.title
  const match = docTitle.match(/^(.+?)\s*[-_]\s*Moodle/)
  return match ? match[1].trim() : docTitle
}
