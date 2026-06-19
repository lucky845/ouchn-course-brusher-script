/**
 * 课程详情页导航服务
 * 负责解析课程页面的章节结构、活动列表、进度信息等
 */
import type { CourseDetailInfo, ChapterItem, ActivityItem } from '../types'
import { ChapterStatus } from '../types'
import { getCourseId, getCourseName } from '../utils/url'

export class CourseNavigatorService {
  private courseInfo: CourseDetailInfo | null = null

  /**
   * 提取课程详情页的完整信息
   */
  extractCourseInfo(): CourseDetailInfo | null {
    try {
      const courseId = getCourseId()
      const courseName = getCourseName()

      if (!courseId) {
        return null
      }

      const chapters = this.extractChapters()
      const completedChapters = chapters.filter(c => c.status === 'completed').length
      const overallProgress = chapters.length > 0
        ? Math.round((completedChapters / chapters.length) * 100)
        : 0

      this.courseInfo = {
        courseId,
        courseName: courseName || '未知课程',
        overallProgress,
        chapters,
        totalChapters: chapters.length,
        completedChapters
      }

      return this.courseInfo
    } catch (e) {
      console.warn('[CourseNavigator] 提取课程信息失败:', e)
      return null
    }
  }

  /**
   * 提取课程章节列表
   * 章节容器：li.card.section.main 或 [id^="section-"]
   */
  private extractChapters(): ChapterItem[] {
    const chapters: ChapterItem[] = []

    // 1. 优先匹配 remuiformat 主题的章节结构
    const sections = document.querySelectorAll('ul.remui-format-list > li.card.section.main, li.card.section.main, li.section, li[id^="section-"]')

    if (sections.length === 0) {
      return chapters
    }

    sections.forEach((section) => {
      const chapter = this.extractChapterFromSection(section as HTMLElement)
      if (chapter) {
        chapters.push(chapter)
      }
    })

    return chapters
  }

  /**
   * 从单个 section 元素提取章节信息
   */
  private extractChapterFromSection(section: HTMLElement): ChapterItem | null {
    // 提取章节名称
    // 优先：h4.sectionname > a 内的文字
    // 备用：span.hidden.sectionname
    const h4Link = section.querySelector('h4.sectionname a, .sectionname a, h3.sectionname a')
    const hiddenSpan = section.querySelector('span.hidden.sectionname')

    let chapterName = ''
    if (h4Link) {
      const fullText = h4Link.textContent?.trim() || ''
      // 移除进度相关的后缀（如 "已完成"）
      chapterName = fullText
        .replace(/已完成$/g, '')
        .replace(/\d+\s*\/\s*\d+$/g, '')
        .trim()
    } else if (hiddenSpan) {
      chapterName = hiddenSpan.textContent?.trim() || ''
    }

    if (!chapterName) {
      return null
    }

    // 提取章节完成状态（从 h4 的 class 或 img 判断）
    const h4 = section.querySelector('h4.sectionname') || section.querySelector('.sectionname')
    const statusIcon = h4?.querySelector('img[src*="finish"], img[src*="nofinish"]')
    let chapterStatus = ChapterStatus.NOT_STARTED

    if (h4) {
      const h4Class = h4.className.toString().toLowerCase()
      if (h4Class.includes('finishtitle') || h4Class.includes('newgk-finishtitle')) {
        chapterStatus = ChapterStatus.COMPLETED
      } else if (h4Class.includes('nofinishtitle')) {
        chapterStatus = ChapterStatus.NOT_STARTED
      }
    }

    if (statusIcon) {
      const src = (statusIcon as HTMLImageElement).getAttribute('src') || ''
      if (src.includes('allfinish')) {
        chapterStatus = ChapterStatus.COMPLETED
      } else if (src.includes('allnofinish')) {
        chapterStatus = ChapterStatus.NOT_STARTED
      }
    }

    // 提取章节进度（如 "4/4"）
    const progressSpan = section.querySelector('span.newgk-jindudivspan2')
    let progress = 0
    if (progressSpan) {
      const progressText = progressSpan.textContent?.trim() || ''
      const match = progressText.match(/(\d+)\s*\/\s*(\d+)/)
      if (match) {
        const completed = parseInt(match[1], 10)
        const total = parseInt(match[2], 10)
        if (total > 0) {
          progress = Math.round((completed / total) * 100)
        }
      }
    }

    // 提取活动项
    const activities = this.extractActivities(section)

    // 如果没有明确的进度显示，则通过活动计算
    if (progress === 0 && activities.length > 0) {
      const completedCount = activities.filter(a => a.status === 'completed').length
      progress = Math.round((completedCount / activities.length) * 100)
      chapterStatus = progress === 100 ? ChapterStatus.COMPLETED
        : progress > 0 ? ChapterStatus.IN_PROGRESS
          : ChapterStatus.NOT_STARTED
    }

    // 获取章节链接
    const linkEl = h4Link as HTMLAnchorElement | null
    const linkUrl = linkEl?.href

    return {
      name: chapterName,
      status: chapterStatus,
      progress,
      element: section,
      linkUrl,
      activities
    }
  }

  /**
   * 从 section 中提取活动项
   * 活动容器：ul.section.img-text > li.activity
   * 排除：modtype_label（纯文本标签）
   */
  private extractActivities(section: HTMLElement): ActivityItem[] {
    const activities: ActivityItem[] = []

    // 在当前 section 内查找活动列表
    const activityItems = section.querySelectorAll('ul.section.img-text > li.activity, ul.section > li.activity')

    activityItems.forEach((activityEl) => {
      const activity = this.extractActivityFromElement(activityEl as HTMLElement)
      if (activity) {
        activities.push(activity)
      }
    })

    return activities
  }

  /**
   * 从单个活动元素提取活动信息
   */
  private extractActivityFromElement(el: HTMLElement): ActivityItem | null {
    // 排除 label 类型（纯文本标签，不是可交互活动）
    const className = el.className.toString().toLowerCase()
    if (className.includes('modtype_label')) {
      return null
    }

    // 提取活动名称
    const instancename = el.querySelector('.instancename')
    const name = instancename
      ? (instancename.textContent?.replace(/\s+/g, ' ').trim().replace(/\s\s*$/, '') || '')
      : (el.textContent?.trim() || '')

    if (!name) {
      return null
    }

    // 提取活动链接
    const linkEl = el.querySelector('.activityinstance a.aalink, .activityinstance a, a.aalink')
    const href = linkEl ? (linkEl as HTMLAnchorElement).href : undefined

    // 提取活动类型
    const typeMatch = className.match(/modtype_(\w+)/)
    const type = typeMatch ? typeMatch[1] : 'unknown'

    // 提取活动完成状态
    const status = this.getActivityStatus(el)

    // 提取 moduleId（从 li.activity 的 id 属性，如 "module-1764"）
    const moduleIdMatch = el.id.match(/^module-(\d+)$/)
    const moduleId = moduleIdMatch ? moduleIdMatch[1] : undefined

    return {
      name,
      status,
      type,
      moduleId,
      linkUrl: href,
      element: el
    }
  }

  /**
   * 获取活动完成状态
   * 优先级：
   * 1. span.autocompletion > img.icon 的 title 属性（最可靠）
   * 2. 图片 src 文件名
   * 3. class/text 内容
   */
  private getActivityStatus(el: HTMLElement): ChapterStatus {
    const elClass = el.className.toString().toLowerCase()
    const elText = el.textContent?.toLowerCase() || ''

    // 1. 检查 autocompletion 图标 title
    const autoCompletionIcon = el.querySelector('.autocompletion img.icon, .autocompletion .icon')
    if (autoCompletionIcon) {
      const title = (autoCompletionIcon as HTMLElement).getAttribute('title') || autoCompletionIcon.textContent || ''
      if (title.includes('已完成')) {
        return ChapterStatus.COMPLETED
      }
      if (title.includes('未完成')) {
        return ChapterStatus.NOT_STARTED
      }
    }

    // 2. 检查图片 src
    const icons = el.querySelectorAll('img.icon')
    for (const icon of Array.from(icons)) {
      const src = (icon as HTMLImageElement).getAttribute('src') || ''
      if (src.includes('sectionfinish') || src.includes('allfinish')) {
        return ChapterStatus.COMPLETED
      }
      if (src.includes('allnofinish') || src.includes('notfinish') || src.includes('incomplete')) {
        return ChapterStatus.NOT_STARTED
      }
    }

    // 3. 检查 class 或 text 内容
    if (elClass.includes('completed') || elClass.includes('done')) {
      return ChapterStatus.COMPLETED
    }
    if (elText.includes('已完成')) {
      return ChapterStatus.COMPLETED
    }

    if (elClass.includes('in-progress') || elClass.includes('inprogress')) {
      return ChapterStatus.IN_PROGRESS
    }

    const completionIcon = el.querySelector('.icon.img-filter:only-child, .icon.fa-check, .completion-icon.completed')
    if (completionIcon) {
      return ChapterStatus.COMPLETED
    }

    return ChapterStatus.NOT_STARTED
  }

  /**
   * 计算章节进度和状态
   */
  private calculateChapterProgress(activities: ActivityItem[]): { status: ChapterStatus, progress: number } {
    if (activities.length === 0) {
      return { status: ChapterStatus.NOT_STARTED, progress: 0 }
    }

    const completedCount = activities.filter(a => a.status === 'completed').length
    const inProgressCount = activities.filter(a => a.status === 'in_progress').length
    const progress = Math.round((completedCount / activities.length) * 100)

    let status = ChapterStatus.NOT_STARTED
    if (completedCount === activities.length) {
      status = ChapterStatus.COMPLETED
    } else if (completedCount > 0 || inProgressCount > 0) {
      status = ChapterStatus.IN_PROGRESS
    }

    return { status, progress }
  }

  /**
   * 获取课程信息（缓存）
   */
  getCourseInfo(): CourseDetailInfo | null {
    return this.courseInfo
  }

  /**
   * 刷新课程信息
   */
  refreshCourseInfo(): CourseDetailInfo | null {
    this.courseInfo = null
    return this.extractCourseInfo()
  }

  /**
   * 获取第一个未完成的活动
   */
  getFirstIncompleteActivity(): ActivityItem | null {
    if (!this.courseInfo) return null

    for (const chapter of this.courseInfo.chapters) {
      for (const activity of chapter.activities) {
        if (activity.status !== 'completed') {
          return activity
        }
      }
    }

    return null
  }

  /**
   * 获取未完成活动总数
   */
  getIncompleteCount(): number {
    if (!this.courseInfo) return 0

    let count = 0
    for (const chapter of this.courseInfo.chapters) {
      for (const activity of chapter.activities) {
        if (activity.status !== 'completed') {
          count++
        }
      }
    }
    return count
  }

  /**
   * 刷新课程信息（refresh 别名）
   */
  refresh(): CourseDetailInfo | null {
    return this.refreshCourseInfo()
  }

  /**
   * 滚动到指定章节
   */
  scrollToChapter(chapterIndex: number): void {
    if (!this.courseInfo) return
    const chapter = this.courseInfo.chapters[chapterIndex]
    if (chapter?.element) {
      chapter.element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  /**
   * 滚动到指定活动
   */
  scrollToActivity(chapterIndex: number, activityIndex: number): void {
    if (!this.courseInfo) return
    const chapter = this.courseInfo.chapters[chapterIndex]
    const activity = chapter?.activities[activityIndex]
    if (activity?.element) {
      activity.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}

export const courseNavigatorService = new CourseNavigatorService()
