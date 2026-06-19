/**
 * 课程状态注入服务
 *
 * 核心流程：
 *   课程详情页（/course/view.php） → 从 DOM 提取章节/活动状态 → 存入 courseProgressStore
 *   刷课页面（/mod/*）         → 从 courseProgressStore 读取 → 在面包屑/导航处注入徽章
 *   首页（student.syxy.ouchn.cn）→ 找到课程链接 → 从 store 读取 → 注入徽章
 *
 * 课程状态以 courseId 作为 key，区分不同课程
 */
import { courseProgressStore, type CourseProgress } from './courseProgressStore'
import { courseNavigatorService } from './courseNavigator'
import { isCoursePage, isModPage, isStudentHomePage, getCourseId } from '../utils/url'
import { parseQueryParams } from '../utils/url'
import { createLogger } from '../utils/logger'

const logger = createLogger('StatusInjector')

export class SidebarStatusInjector {
  private observer: MutationObserver | null = null
  private isInitialized = false
  private injectedTargets = new WeakSet<HTMLElement>()

  init(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    try {
      if (isCoursePage()) {
        this.handleCoursePage()
      } else if (isModPage()) {
        this.delayedInjectModPage()
      } else if (isStudentHomePage()) {
        const injectedCount = this.handleHomePage()
        if (injectedCount > 0) {
          logger.info(`首页：注入 ${injectedCount} 个徽章`)
        }
      }
    } catch (e) {
      logger.error('初始化失败:', e)
    }

    this.setupMutationObserver()
  }

  // ============================== 页面处理器 ==============================

  /**
   * 课程详情页：只提取状态同步到 store，不做 DOM 注入
   * 课程详情页本身已有完成状态展示，无需额外注入
   */
  private handleCoursePage(): void {
    try {
      const courseInfo = courseNavigatorService.extractCourseInfo()
      if (courseInfo && courseInfo.courseId) {
        courseProgressStore.syncFromCourseInfo(courseInfo)
        logger.info('课程详情页已同步: courseId=' + courseInfo.courseId)
      }
    } catch (e) {
      logger.error('同步课程状态失败:', e)
    }
  }

  private delayedInjectModPage(): void {
    const injectedCount = this.handleModPage()
    logger.debug(`刷课页面：注入 ${injectedCount} 个徽章`)
  }

  private handleModPage(): number {
    let count = 0

    const courseId = this.findCourseIdFromPage()

    if (!courseId) {
      logger.warn('mod 页未能解析到课程ID')
      return 0
    }

    const progress = courseProgressStore.getCourseProgress(courseId)

    count += this.injectIntoBreadcrumb(progress, courseId)
    count += this.injectIntoSidebarNav(progress, courseId)

    return count
  }

  private injectIntoBreadcrumb(progress: ReturnType<typeof courseProgressStore.getCourseProgress>, courseId: string): number {
    const courseLinks = document.querySelectorAll<HTMLElement>(
      'a[href*="/course/view.php?id=' + courseId + '"]'
    )

    if (courseLinks.length === 0) {
      logger.debug('未找到面包屑中的课程链接')
      return 0
    }

    const link = courseLinks[0]

    const isInSidebar = link.closest('aside, .sidebar, .block_navigation, .mobile_course')
    if (isInSidebar) {
      logger.debug('跳过侧边栏中的课程链接')
      return 0
    }

    if (this.injectedTargets.has(link)) return

    let badge: HTMLElement
    if (progress) {
      badge = this.createOverallCourseBadge(progress)
    } else {
      badge = this.createNoDataBadge()
    }
    link.appendChild(badge)
    this.injectedTargets.add(link)
    logger.debug('面包屑注入成功:', link.textContent?.trim())

    return 1
  }

  private injectIntoSidebarNav(progress: ReturnType<typeof courseProgressStore.getCourseProgress>, courseId: string): number {
    // 从 store 读取完成状态 Map（key=moduleId, value=isCompleted）
    const completedActivities = progress?.completedActivities || {}

    // 直接查找所有 li.activity 元素（之前能正常显示的方式）
    const activityItems = document.querySelectorAll<HTMLElement>('li.activity')

    logger.debug('侧边栏找到', activityItems.length, '个活动项')

    activityItems.forEach((activityEl, index) => {
      // 先移除之前可能存在的状态图标
      const existingIcon = activityEl.querySelector('.ouchn-status-icon')
      if (existingIcon) {
        existingIcon.remove()
      }

      // 从元素 id 提取 moduleId（如 "module-1764" → "1764"）
      const moduleIdMatch = activityEl.id.match(/^module-(\d+)$/)
      const moduleId = moduleIdMatch ? moduleIdMatch[1] : null

      // 用 moduleId 检查是否完成
      const isCompleted = moduleId ? completedActivities[moduleId] === true : false

      // 创建状态图标（之前能正常显示的方式）
      const icon = document.createElement('span')
      icon.className = 'ouchn-status-icon'

      if (isCompleted) {
        icon.textContent = '✓'
        icon.style.color = '#22c55e'
        icon.style.fontWeight = 'bold'
        icon.style.fontSize = '16px'
        icon.style.marginRight = '6px'
        icon.style.display = 'inline-block'
        icon.style.width = '20px'
        icon.style.textAlign = 'center'
      } else {
        icon.textContent = '○'
        icon.style.color = '#9ca3af'
        icon.style.fontWeight = 'bold'
        icon.style.fontSize = '16px'
        icon.style.marginRight = '6px'
        icon.style.display = 'inline-block'
        icon.style.width = '20px'
        icon.style.textAlign = 'center'
      }

      // 找 instancename span，把图标插入到前面（之前能正常显示的位置）
      const instancename = activityEl.querySelector('.instancename')
      if (instancename) {
        instancename.prepend(icon)
      } else {
        // 找不到 instancename，就插入到第一个子元素前面
        const firstChild = activityEl.querySelector('a.aalink') || activityEl.firstElementChild
        if (firstChild) {
          firstChild.prepend(icon)
        }
      }

      if (index < 5) {
        logger.debug('活动项:', activityEl.id, 'moduleId:', moduleId, '状态:', isCompleted ? '✓ 已完成' : '○ 未完成')
      }
    })

    logger.debug('侧边栏注入完成，共处理', activityItems.length, '个活动项')
    return activityItems.length
  }


  /**
   * 首页：在课程链接旁注入状态徽章
   */
  private handleHomePage(): number {
    let count = 0

    // 在首页中搜索课程链接（可能是卡片、列表项、按钮等包含课程链接的元素）
    const courseLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="course/view.php"]')

    courseLinks.forEach((link) => {
      if (this.injectedTargets.has(link)) return

      const courseId = this.extractCourseIdFromAnyUrl(link.href)
      if (!courseId) return

      const progress = courseProgressStore.getCourseProgress(courseId)
      if (!progress) return

      const badge = this.createOverallCourseBadge(progress)
      link.appendChild(badge)
      this.injectedTargets.add(link)
      count++
    })

    return count
  }

  // ============================== 课程 ID 提取 ==============================

  /**
   * 从 mod 页面中提取课程 ID
   * ⚠️ Moodle 注意：mod 页面 URL 中的 id=XXX 是活动/模块ID，不是课程ID！
   *    必须从页面内容（面包屑/导航链接）中解析课程ID
   *
   * 策略优先级：
   *   1. 面包屑中指向 course/view.php 的链接（最可靠）
   *   2. 页面上任意 course/view.php?id=XXX 链接
   *   3. body class 中的 course-XXX 类名
   *   4. 整个页面 HTML 中的 course/view.php?id=XXX 正则匹配
   */
  private findCourseIdFromPage(): string | null {
    // ⚠️ 绝对不能从 URL 取 id 参数！mod 页面的 id 是模块ID而非课程ID

    // 1. 面包屑中找课程链接（Moodle 标准面包屑：首页 > 课程名 > 活动名）
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
        const id = this.extractCourseIdFromCourseUrl(links[i].href)
        if (id) {
          logger.debug('✓ 通过面包屑找到 courseId:', id)
          return id
        }
      }
    }

    const allCourseLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="course/view.php"]')
    for (let i = 0; i < allCourseLinks.length; i++) {
      const id = this.extractCourseIdFromCourseUrl(allCourseLinks[i].href)
      if (id) {
        logger.debug('✓ 通过页面链接找到 courseId:', id)
        return id
      }
    }

    if (document.body) {
      const bodyClass = document.body.className
      const match = bodyClass.match(/course-(\d+)/)
      if (match) {
        logger.debug('✓ 通过 body class 找到 courseId:', match[1])
        return match[1]
      }
    }

    const courseMeta = document.querySelector('input[name="courseid"], input[name="course"]')
    if (courseMeta) {
      const value = (courseMeta as HTMLInputElement).value
      if (/^\d+$/.test(value)) {
        logger.debug('✓ 通过隐藏输入框找到 courseId:', value)
        return value
      }
    }

    let pageHtml = ''
    try {
      pageHtml = document.documentElement.innerHTML
    } catch {
      pageHtml = ''
    }
    const htmlMatch = pageHtml.match(/course\/view\.php\?id=(\d+)/)
    if (htmlMatch) {
      logger.debug('✓ 通过页面HTML找到 courseId:', htmlMatch[1])
      return htmlMatch[1]
    }

    logger.warn('✗ 无法从页面解析课程ID')
    return null
  }

  /**
   * 从 course/view.php 类型的 URL 中提取课程 ID
   * 注意：只识别 course/view.php?id=XXX 中的 id，不用于其他页面！
   */
  private extractCourseIdFromCourseUrl(url: string): string | null {
    // 快速过滤：必须包含 course/view.php
    if (!url.includes('course/view.php')) return null

    const params = parseQueryParams(url)
    if (params.id && /^\d+$/.test(params.id)) {
      return params.id
    }

    // 备用正则
    const match = url.match(/course\/view\.php\?id=(\d+)/)
    return match ? match[1] : null
  }

  /**
   * 从任意 URL 中提取课程 ID（用于首页课程卡片等场景）
   * 仅限 URL 确实是课程详情页 URL 时使用
   */
  private extractCourseIdFromAnyUrl(url: string): string | null {
    if (!url.includes('course/view.php')) return null
    return this.extractCourseIdFromCourseUrl(url)
  }

  // ============================== 徽章样式 ==============================

  /**
   * 创建活动状态标记（最简单的方块标记）
   */
  private createActivityBadge(isCompleted: boolean): HTMLElement {
    const badge = document.createElement('span')
    badge.className = 'ouchn-activity-badge'

    // 简单的方块
    badge.textContent = ''

    badge.setAttribute('style',
      'display:inline-block !important;' +
      'width:10px !important;' +
      'height:10px !important;' +
      'margin-right:6px !important;' +
      'border-radius:2px !important;' +
      'vertical-align:middle !important;'
    )

    if (isCompleted) {
      badge.style.background = '#22c55e !important'
      badge.title = '已完成'
    } else {
      badge.style.background = '#d1d5db !important'
      badge.title = '未完成'
    }
    return badge
  }

  /**
   * 创建整体课程状态徽章（用于 mod 页面面包屑、首页课程链接）
   */
  private createOverallCourseBadge(progress: CourseProgress | null): HTMLElement {
    const badge = document.createElement('span')

    if (!progress) {
      // 无数据时的备用显示
      badge.textContent = 'ⓘ 暂无数据'
      badge.setAttribute('style',
        'display:inline-block !important;' +
        'margin-left:10px !important;' +
        'padding:4px 10px !important;' +
        'background:#f3f4f6 !important;' +
        'color:#6b7280 !important;' +
        'border-radius:14px !important;' +
        'font-size:12px !important;' +
        'font-weight:600 !important;' +
        'line-height:1.4 !important;' +
        'vertical-align:middle !important;' +
        'border:2px solid #9ca3af !important;'
      )
      badge.title = '请先打开课程详情页'
      return badge
    }

    const isCompleted = progress.isCompleted
    const completed = progress.completedActivities ? Object.keys(progress.completedActivities).length : 0
    const total = progress.totalActivities ?? 0
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    const isInProgress = percent > 0 && !isCompleted

    let bgColor: string
    let textColor: string
    let borderColor: string
    if (isCompleted) {
      bgColor = '#dcfce7'; textColor = '#15803d'; borderColor = '#22c55e'
    } else if (isInProgress) {
      bgColor = '#fef3c7'; textColor = '#92400e'; borderColor = '#f59e0b'
    } else {
      bgColor = '#f3f4f6'; textColor = '#6b7280'; borderColor = '#9ca3af'
    }

    let badgeText: string
    if (isCompleted) {
      badgeText = `✓ 已完成 (${completed}/${total})`
    } else if (percent > 0) {
      badgeText = `${percent}% (${completed}/${total})`
    } else {
      badgeText = `${completed}/${total} 未开始`
    }

    badge.textContent = badgeText
    badge.setAttribute('style',
      'display:inline-block !important;' +
      'margin-left:10px !important;' +
      'padding:4px 10px !important;' +
      `background:${bgColor} !important;` +
      `color:${textColor} !important;` +
      'border-radius:14px !important;' +
      'font-size:12px !important;' +
      'font-weight:700 !important;' +
      'line-height:1.4 !important;' +
      'vertical-align:middle !important;' +
      `border:2px solid ${borderColor} !important;` +
      'box-shadow:0 2px 4px rgba(0,0,0,0.15) !important;' +
      'white-space:nowrap !important;'
    )

    badge.title = `${progress.courseName || '课程'} - 进度：${completed}/${total}（${percent}%）`
    return badge
  }

  /**
   * 创建"暂无数据"提示徽章
   */
  private createNoDataBadge(): HTMLElement {
    const badge = document.createElement('span')
    badge.textContent = 'ⓘ 请先访问课程详情页'
    badge.setAttribute('style',
      'display:inline-block !important;' +
      'margin-left:10px !important;' +
      'padding:4px 10px !important;' +
      'background:#f3f4f6 !important;' +
      'color:#6b7280 !important;' +
      'border-radius:14px !important;' +
      'font-size:12px !important;' +
      'font-weight:600 !important;' +
      'line-height:1.4 !important;' +
      'vertical-align:middle !important;' +
      'border:2px solid #9ca3af !important;'
    )
    badge.title = '请先打开课程详情页，系统将自动提取课程进度'
    return badge
  }

  // ============================== DOM 变化监听 ==============================

  /**
   * 监听 DOM 变化，处理动态加载内容
   */
  private setupMutationObserver(): void {
    if (this.observer) return
    if (typeof MutationObserver === 'undefined') return

    this.observer = new MutationObserver((mutations) => {
      let shouldReInject = false

      for (const mutation of mutations) {
        if (mutation.addedNodes.length === 0) continue
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i]
          if (node.nodeType !== Node.ELEMENT_NODE) continue
          const el = node as HTMLElement

          if (el.tagName === 'LI' && (el.className.includes('section') || el.className.includes('activity'))) {
            shouldReInject = true
            break
          }

          if (el.querySelector) {
            const hasCourseLink = el.querySelector('a[href*="course/view.php"]')
            if (hasCourseLink) {
              shouldReInject = true
              break
            }

            const hasSection = el.querySelector('li.section.main, li.activity')
            if (hasSection) {
              shouldReInject = true
              break
            }
          }
        }
        if (shouldReInject) break
      }

      if (shouldReInject) {
        setTimeout(() => {
          try {
            if (isCoursePage()) this.handleCoursePage()
            else if (isModPage()) this.handleModPage()
            else if (isStudentHomePage()) this.handleHomePage()
          } catch (e) {
            logger.error('动态注入失败:', e)
          }
        }, 300)
      }
    })

    try {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      })
    } catch (e) {
      logger.error('MutationObserver 启动失败:', e)
    }
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.isInitialized = false
    this.injectedTargets = new WeakSet()
  }
}

/**
 * 注入全局 CSS 样式
 */
function injectGlobalStyles(): void {
  if (document.getElementById('ouchn-status-styles')) {
    return
  }

  // 确保在 DOM 完全加载后注入样式
  const inject = () => {
    const style = document.createElement('style')
    style.id = 'ouchn-status-styles'
    style.textContent = `
      /* 完成状态标记 - ul.section.img-text > li.activity */
      body ul.section.img-text > li.activity.ouchn-completed {
        border-left: 6px solid #22c55e !important;
        padding-left: 12px !important;
        background-color: rgba(34, 197, 94, 0.1) !important;
        margin-left: -12px !important;
        padding-right: 12px !important;
        box-sizing: border-box !important;
      }
      
      /* 未完成状态标记 */
      body ul.section.img-text > li.activity.ouchn-not-completed {
        border-left: 6px solid #d1d5db !important;
        padding-left: 12px !important;
        margin-left: -12px !important;
        padding-right: 12px !important;
        box-sizing: border-box !important;
      }
    `
    document.head.appendChild(style)
    logger.debug('✅ CSS样式已注入')
  }

  if (document.readyState === 'complete') {
    inject()
  } else {
    document.addEventListener('DOMContentLoaded', inject)
  }
}

// 初始化时注入样式
injectGlobalStyles()

export const sidebarStatusInjector = new SidebarStatusInjector()
