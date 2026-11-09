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
 * 从活动链接 URL 中提取 moduleId
 * 用于与课程进度 store 的 completedActivities key（moduleId）保持一致
 * @param href 完整 URL（如 https://example.com/mod/quiz/view.php?id=1764）
 * @returns moduleId（如 "1764"），无法解析时返回空字符串
 */
export function getModuleIdFromUrl(href: string): string {
  if (!href) return ''
  const params = parseQueryParams(href)
  if (params.id) return params.id.trim()
  // 兜底：直接从 /mod/xxx/view.php?id=(\d+) 正则提取
  const m = href.match(/\/mod\/[^/]+\/view\.php\?id=(\d+)/)
  return m ? m[1] : ''
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
 * 从 course/view.php 类型的 URL 中提取课程 ID
 * 注意：只识别 course/view.php?id=XXX 中的 id，不用于其他页面
 */
export function extractCourseIdFromCourseUrl(url: string): string | null {
  if (!url || !url.includes('course/view.php')) return null
  const id = parseQueryParams(url)['id']
  return id && /^\d+$/.test(id) ? id : null
}

/**
 * 从当前页面解析课程 ID（适用于任何课程内页面，包括 /mod/xxx 活动页）
 *
 * ⚠️ 不能直接取 URL 的 id 参数：mod 页面的 id 是模块 ID 而非课程 ID。
 * 依次尝试 面包屑 → 页面内课程链接 → body class → 隐藏输入框 → 页面 HTML。
 *
 * @returns 课程 ID，解析失败返回 null
 */
export function getCourseIdFromPage(): string | null {
  if (typeof document === 'undefined') return null

  // 1. 面包屑（Moodle 标准：首页 > 课程名 > 活动名）
  const breadcrumbSelectors = [
    '.breadcrumb a[href*="course/view.php"]',
    '.breadcrumb-item a[href*="course/view.php"]',
    '.breadcrumb a[href*="/course/"]',
    'nav[aria-label*="breadcrumb"] a[href*="course/view.php"]',
    'ul.breadcrumb a[href*="course/view.php"]',
    'ol.breadcrumb a[href*="course/view.php"]'
  ]
  for (const selector of breadcrumbSelectors) {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector)
    for (let i = 0; i < links.length; i++) {
      const id = extractCourseIdFromCourseUrl(links[i].href)
      if (id) return id
    }
  }

  // 2. 页面内任意课程链接（侧边栏 / 导航块）
  const allCourseLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="course/view.php"]')
  for (let i = 0; i < allCourseLinks.length; i++) {
    const id = extractCourseIdFromCourseUrl(allCourseLinks[i].href)
    if (id) return id
  }

  // 3. body class（Moodle 会给 body 加 course-<id>）
  if (document.body) {
    const match = document.body.className.match(/course-(\d+)/)
    if (match) return match[1]
  }

  // 4. 隐藏输入框
  const courseMeta = document.querySelector<HTMLInputElement>('input[name="courseid"], input[name="course"]')
  if (courseMeta && /^\d+$/.test(courseMeta.value)) return courseMeta.value

  // 5. 页面 HTML 兜底
  try {
    const htmlMatch = document.documentElement.innerHTML.match(/course\/view\.php\?id=(\d+)/)
    if (htmlMatch) return htmlMatch[1]
  } catch {}

  return null
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
