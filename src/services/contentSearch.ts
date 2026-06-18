/**
 * 内容搜索服务
 * 在课程页面中搜索内容，高亮显示匹配结果
 */
import type { ChapterItem } from '../types'

/** 搜索结果项 */
export interface SearchResult {
  chapterIndex: number
  chapterName: string
  activityIndex?: number
  activityName?: string
  activityUrl?: string
  matchedText: string
  matchType: 'chapter' | 'activity' | 'content'
  element?: HTMLElement
}

/** 搜索配置 */
export interface SearchConfig {
  caseSensitive: boolean
  wholeWord: boolean
  maxResults: number
}

const DEFAULT_CONFIG: SearchConfig = {
  caseSensitive: false,
  wholeWord: false,
  maxResults: 50,
}

export class ContentSearchService {
  private chapters: ChapterItem[] = []
  private highlightMarkers: HTMLElement[] = []

  /**
   * 设置要搜索的章节数据
   */
  setChapters (chapters: ChapterItem[]): void {
    this.chapters = chapters
    this.clearHighlights()
  }

  /**
   * 搜索章节和活动
   */
  search (keyword: string, config: Partial<SearchConfig> = {}): SearchResult[] {
    if (!keyword || keyword.trim().length === 0) {
      return []
    }

    const settings = { ...DEFAULT_CONFIG, ...config }
    const results: SearchResult[] = []

    // 转义特殊正则字符
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flag = settings.caseSensitive ? 'g' : 'gi'
    const pattern = settings.wholeWord
      ? `\\b${escapedKeyword}\\b`
      : escapedKeyword

    let regex: RegExp
    try {
      regex = new RegExp(pattern, flag)
    } catch {
      // 如果正则失败，使用简单匹配
      regex = new RegExp(escapedKeyword.replace(/[^\w\u4e00-\u9fa5]/g, ''), flag)
    }

    // 搜索章节标题
    this.chapters.forEach((chapter, chapterIndex) => {
      if (results.length >= settings.maxResults) return

      if (regex.test(chapter.name)) {
        results.push({
          chapterIndex,
          chapterName: chapter.name,
          matchedText: this.extractMatch(chapter.name, regex),
          matchType: 'chapter',
          element: chapter.element || undefined,
        })
        regex.lastIndex = 0 // 重置正则状态
      }

      // 搜索活动
      chapter.activities.forEach((activity, activityIndex) => {
        if (results.length >= settings.maxResults) return

        if (regex.test(activity.name)) {
          results.push({
            chapterIndex,
            chapterName: chapter.name,
            activityIndex,
            activityName: activity.name,
            activityUrl: activity.url,
            matchedText: this.extractMatch(activity.name, regex),
            matchType: 'activity',
            element: activity.element || undefined,
          })
          regex.lastIndex = 0
        }
      })
    })

    // 搜索页面内容（如果有）
    this.searchPageContent(keyword, results, settings)

    console.log(`[ContentSearch] 搜索 "${keyword}" 找到 ${results.length} 个结果`)
    return results
  }

  /**
   * 在页面内容中搜索
   */
  private searchPageContent (keyword: string, results: SearchResult[], settings: SearchConfig): void {
    if (results.length >= settings.maxResults) return

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flag = settings.caseSensitive ? 'gi' : 'gi'
    const pattern = escapedKeyword

    // 搜索页面中的文本内容
    const contentElements = document.querySelectorAll(
      '.course-section .content, .section .content, .activityinstance, .summary, ' +
      '[class*="section"] p, [class*="section"] li, [class*="activity"] p'
    )

    const seenTexts = new Set<string>()

    contentElements.forEach((el) => {
      if (results.length >= settings.maxResults) return

      const text = el.textContent?.trim() || ''
      if (text.length < keyword.length || seenTexts.has(text)) return

      const lowerText = settings.caseSensitive ? text : text.toLowerCase()
      const lowerKeyword = settings.caseSensitive ? keyword : keyword.toLowerCase()

      if (lowerText.includes(lowerKeyword)) {
        seenTexts.add(text)
        const chapterEl = el.closest('.course-section, .section, [id^="section-"]')
        const chapterIndex = chapterEl
          ? Array.from(document.querySelectorAll('.course-section, .section, [id^="section-"]')).indexOf(chapterEl as HTMLElement)
          : -1

        results.push({
          chapterIndex: chapterIndex >= 0 ? chapterIndex : 0,
          chapterName: chapterIndex >= 0
            ? this.chapters[chapterIndex]?.name || '未知章节'
            : '未知章节',
          matchedText: this.extractMatch(text, new RegExp(pattern, flag)),
          matchType: 'content',
          element: el as HTMLElement,
        })
      }
    })
  }

  /**
   * 提取匹配文本片段
   */
  private extractMatch (text: string, regex: RegExp): string {
    const match = text.match(regex)
    if (!match) return text.substring(0, 50)

    const matched = match[0]
    const index = text.search(regex)

    // 提取匹配词前后各 20 个字符
    const start = Math.max(0, index - 20)
    const end = Math.min(text.length, index + matched.length + 20)

    let snippet = text.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'

    return snippet
  }

  /**
   * 高亮搜索结果
   */
  highlightResults (results: SearchResult[]): void {
    this.clearHighlights()

    results.forEach((result) => {
      if (result.element) {
        this.highlightElement(result.element, result.matchedText)
      }
    })
  }

  /**
   * 高亮单个元素
   */
  private highlightElement (element: HTMLElement, matchedText: string): void {
    // 创建一个高亮标记
    const marker = document.createElement('mark')
    marker.className = 'course-search-highlight'
    marker.style.cssText = `
      background-color: #fef08a;
      border-radius: 2px;
      padding: 0 2px;
      animation: searchHighlightPulse 2s ease-out;
    `

    // 添加动画样式（如果还没有）
    if (!document.getElementById('course-search-styles')) {
      const style = document.createElement('style')
      style.id = 'course-search-styles'
      style.textContent = `
        @keyframes searchHighlightPulse {
          0% { background-color: #facc15; }
          100% { background-color: #fef08a; }
        }
      `
      document.head.appendChild(style)
    }

    // 找到包含匹配文本的元素
    const target = element.querySelector('.instancename, .section-title, .sectionname, .activityname, a')
    const textEl = target || element

    // 包裹匹配文本
    const text = textEl.textContent || ''
    if (text.includes(matchedText.replace(/^\.\.\.|\.\.\.$/g, ''))) {
      const span = document.createElement('span')
      span.innerHTML = text.replace(
        new RegExp(`(${matchedText.replace(/^\.\.\.|\.\.\.$/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark class="course-search-highlight" style="background-color: #fef08a; border-radius: 2px; padding: 0 2px;">$1</mark>'
      )
      textEl.textContent = ''
      textEl.appendChild(span)
      this.highlightMarkers.push(textEl)
    }
  }

  /**
   * 清除高亮
   */
  clearHighlights (): void {
    this.highlightMarkers.forEach((el) => {
      // 移除 highlight 类
      el.querySelectorAll('.course-search-highlight').forEach((mark) => {
        const text = mark.textContent || ''
        mark.replaceWith(document.createTextNode(text))
      })
    })
    this.highlightMarkers = []

    // 移除 highlight 类（直接标记）
    document.querySelectorAll('.course-search-highlight').forEach((mark) => {
      const text = mark.textContent || ''
      mark.replaceWith(document.createTextNode(text))
    })
  }

  /**
   * 滚动到搜索结果
   */
  scrollToResult (result: SearchResult): void {
    if (result.element) {
      result.element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // 添加闪烁效果
      result.element.classList.add('course-search-current')
      setTimeout(() => {
        result.element?.classList.remove('course-search-current')
      }, 2000)
    } else if (result.activityUrl) {
      window.location.href = result.activityUrl
    }
  }

  /**
   * 获取搜索历史
   */
  getSearchHistory (): string[] {
    try {
      const history = localStorage.getItem('ouchn_course_search_history')
      return history ? JSON.parse(history) : []
    } catch {
      return []
    }
  }

  /**
   * 添加到搜索历史
   */
  addToHistory (keyword: string): void {
    try {
      const history = this.getSearchHistory()
      const filtered = history.filter(h => h !== keyword)
      filtered.unshift(keyword)
      localStorage.setItem('ouchn_course_search_history', JSON.stringify(filtered.slice(0, 20)))
    } catch {
      // ignore
    }
  }

  /**
   * 清空搜索历史
   */
  clearHistory (): void {
    localStorage.removeItem('ouchn_course_search_history')
  }
}

export const contentSearchService = new ContentSearchService()
