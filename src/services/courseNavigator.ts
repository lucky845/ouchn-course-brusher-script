/**
 * 课程详情页导航服务
 * 负责解析课程页面的章节结构、活动列表、进度信息等
 */
import type { CourseDetailInfo, ChapterItem, ActivityItem, ChapterStatus } from '../types'
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
        console.log('[CourseNavigator] 非课程详情页，跳过')
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
        completedChapters,
      }

      console.log('[CourseNavigator] 课程信息提取完成:', this.courseInfo)
      return this.courseInfo
    } catch (e) {
      console.warn('[CourseNavigator] 提取课程信息失败:', e)
      return null
    }
  }

  /**
   * 提取课程章节列表
   */
  private extractChapters(): ChapterItem[] {
    const chapters: ChapterItem[] = []

    // 尝试多种选择器来匹配 Moodle 课程章节结构
    const sectionSelectors = [
      '.course-section',
      '.section',
      '.topics .topic',
      '.weeks .week',
      '[id^="section-"]',
    ]

    let sections: NodeListOf<Element> | null = null
    for (const selector of sectionSelectors) {
      sections = document.querySelectorAll(selector)
      if (sections.length > 0) {
        console.log('[CourseNavigator] 使用选择器:', selector, '找到', sections.length, '个章节')
        break
      }
    }

    if (!sections || sections.length === 0) {
      console.log('[CourseNavigator] 未找到章节结构')
      return chapters
    }

    sections.forEach((section, index) => {
      const chapter = this.extractChapterFromSection(section as HTMLElement, index)
      if (chapter) {
        chapters.push(chapter)
      }
    })

    return chapters
  }

  /**
   * 从单个 section 元素提取章节信息
   */
  private extractChapterFromSection(section: HTMLElement, index: number): ChapterItem | null {
    // 提取章节标题
    const titleSelectors = [
      '.section-title',
      '.sectionname',
      '.content .h3',
      'h3',
      '.section-header .title',
    ]

    let chapterName = ''
    for (const selector of titleSelectors) {
      const titleEl = section.querySelector(selector)
      if (titleEl) {
        const text = titleEl.textContent?.trim() || ''
        // 过滤掉章节编号
        const match = text.match(/(?:^\d+[\.、:：]\s*)?(.+)/)
        chapterName = match ? match[1].trim() : text
        if (chapterName) break
      }
    }

    // 如果没有标题，尝试从 section 的 id 或其他属性获取
    if (!chapterName) {
      const sectionId = section.id || ''
      const idMatch = sectionId.match(/section-(\d+)/)
      chapterName = idMatch ? `第${idMatch[1]}节` : `章节 ${index + 1}`
    }

    // 提取活动项
    const activities = this.extractActivities(section)

    // 计算章节进度
    const { status, progress } = this.calculateChapterProgress(activities)

    // 获取章节的链接 URL（如果有）
    const linkEl = section.querySelector('a.section-title, .section-title a, h3 a')
    const linkUrl = linkEl ? (linkEl as HTMLAnchorElement).href : undefined

    return {
      name: chapterName,
      status,
      progress,
      element: section,
      linkUrl,
      activities,
    }
  }

  /**
   * 从 section 中提取活动项
   */
  private extractActivities(section: HTMLElement): ActivityItem[] {
    const activities: ActivityItem[] = []

    // 活动类型映射
    const activityTypeMap: Record<string, string> = {
      'resource': '资源',
      'url': '外部链接',
      'page': '页面',
      'forum': '讨论区',
      'quiz': '测验',
      'assignment': '作业',
      'choice': '投票',
      'scorm': 'SCORM',
      'lesson': '互动课程',
      'workshop': '协作活动',
      'folder': '文件夹',
      'label': '标签',
    }

    // 活动选择器
    const activitySelectors = [
      '.activity',
      '.mod-indent-outer',
      '.activity-item',
      '[class*="activity "]',
    ]

    let activityEls: NodeListOf<Element> | null = null
    for (const selector of activitySelectors) {
      activityEls = section.querySelectorAll(selector)
      if (activityEls.length > 0) break
    }

    if (!activityEls) return activities

    activityEls.forEach((el) => {
      const activity = this.extractActivityItem(el as HTMLElement, activityTypeMap)
      if (activity) {
        activities.push(activity)
      }
    })

    return activities
  }

  /**
   * 从活动元素提取单个活动信息
   */
  private extractActivityItem(el: HTMLElement, typeMap: Record<string, string>): ActivityItem | null {
    // 提取活动名称
    const nameSelectors = [
      '.instancename',
      '.activityname',
      '.content a',
      'a',
      'span',
    ]

    let name = ''
    for (const selector of nameSelectors) {
      const nameEl = el.querySelector(selector)
      if (nameEl) {
        const text = nameEl.textContent?.trim() || ''
        // 过滤掉状态后缀（如 "已完成 (1)"）
        const cleanName = text.replace(/\s*\([\d没\d完成]+\)\s*$/g, '').trim()
        if (cleanName && cleanName.length > 1 && cleanName.length < 100) {
          name = cleanName
          break
        }
      }
    }

    if (!name) return null

    // 提取活动类型
    let activityType = '未知'
    const typeSelectors = [
      '[class*="modtype_"]',
      '.activitytype',
      'img.icon',
    ]

    for (const selector of typeSelectors) {
      const typeEl = el.querySelector(selector)
      if (typeEl) {
        if (typeEl.className.toString().includes('modtype_')) {
          const classList = typeEl.className.toString()
          const typeMatch = classList.match(/modtype_(\w+)/)
          if (typeMatch) {
            activityType = typeMap[typeMatch[1]] || typeMatch[1]
          }
        } else if (typeEl.tagName === 'IMG') {
          // 从图标 alt 或 src 获取类型
          const alt = (typeEl as HTMLImageElement).alt || ''
          if (alt) activityType = alt
        }
        break
      }
    }

    // 提取活动状态
    const status = this.getActivityStatus(el)

    // 提取活动链接
    const linkEl = el.querySelector('a[href*="/mod/"], a[href*="/resources/"]')
    const url = linkEl ? (linkEl as HTMLAnchorElement).href : undefined

    return {
      name,
      type: activityType,
      status,
      url,
      element: el,
    }
  }

  /**
   * 获取活动完成状态
   */
  private getActivityStatus(el: HTMLElement): ChapterStatus {
    const className = el.className.toString().toLowerCase()
    const text = el.textContent?.toLowerCase() || ''

    // 已完成状态
    if (className.includes('completed') || className.includes('done')) {
      return ChapterStatus.COMPLETED
    }
    if (text.includes('已完成')) {
      return ChapterStatus.COMPLETED
    }

    // 进行中状态（可能有部分完成）
    if (className.includes('in-progress') || className.includes('inprogress')) {
      return ChapterStatus.IN_PROGRESS
    }

    // 检查是否有完成标记
    const completionIcon = el.querySelector('.icon.img-filter:only-child, .icon.fa-check, .completion-icon.completed')
    if (completionIcon) {
      return ChapterStatus.COMPLETED
    }

    return ChapterStatus.NOT_STARTED
  }

  /**
   * 计算章节进度
   */
  private calculateChapterProgress(activities: ActivityItem[]): { status: ChapterStatus; progress: number } {
    if (activities.length === 0) {
      return { status: ChapterStatus.NOT_STARTED, progress: 0 }
    }

    const completed = activities.filter(a => a.status === ChapterStatus.COMPLETED).length
    const progress = Math.round((completed / activities.length) * 100)

    let status: ChapterStatus
    if (completed === activities.length) {
      status = ChapterStatus.COMPLETED
    } else if (completed > 0) {
      status = ChapterStatus.IN_PROGRESS
    } else {
      status = ChapterStatus.NOT_STARTED
    }

    return { status, progress }
  }

  /**
   * 滚动到指定章节
   */
  scrollToChapter(chapterIndex: number): boolean {
    if (!this.courseInfo || !this.courseInfo.chapters[chapterIndex]) {
      console.warn('[CourseNavigator] 章节索引无效:', chapterIndex)
      return false
    }

    const chapter = this.courseInfo.chapters[chapterIndex]
    if (chapter.element) {
      chapter.element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // 高亮效果
      chapter.element.classList.add('course-assistant-highlight')
      setTimeout(() => {
        chapter.element?.classList.remove('course-assistant-highlight')
      }, 2000)
      return true
    }

    return false
  }

  /**
   * 滚动到指定活动
   */
  scrollToActivity(chapterIndex: number, activityIndex: number): boolean {
    if (!this.courseInfo) return false
    const chapter = this.courseInfo.chapters[chapterIndex]
    if (!chapter || !chapter.activities[activityIndex]) return false

    const activity = chapter.activities[activityIndex]
    if (activity.element) {
      activity.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      activity.element.classList.add('course-assistant-highlight')
      setTimeout(() => {
        activity.element?.classList.remove('course-assistant-highlight')
      }, 2000)
      return true
    }

    return false
  }

  /**
   * 获取课程信息
   */
  getCourseInfo(): CourseDetailInfo | null {
    return this.courseInfo
  }

  /**
   * 刷新课程信息
   */
  refresh(): CourseDetailInfo | null {
    return this.extractCourseInfo()
  }
}

export const courseNavigatorService = new CourseNavigatorService()
