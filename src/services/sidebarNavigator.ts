import { NAV_ITEM_SELECTORS } from './constants'
import { parseQueryParams, getBasePath } from '../utils/url'

const MOD_URL_MARKER = '/mod/'

export type NavItem = HTMLLinkElement | HTMLAnchorElement

export class SidebarNavigatorService {
  /**
   * 查找侧边栏导航容器
   */
  findSidebar(): Element | null {
    try {
      if (typeof document === 'undefined') return null

      for (let i = 0; i < NAV_ITEM_SELECTORS.sidebarSelectors.length; i++) {
        const sel = NAV_ITEM_SELECTORS.sidebarSelectors[i]
        const el = document.querySelector(sel)
        if (el) return el
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 从某个容器下提取活动链接（仅保留 /mod/ 开头的，去重）
   */
  private extractLinks(container: Element | Document): NavItem[] {
    try {
      const anchors = container.querySelectorAll<HTMLAnchorElement>('a[href]')
      if (!anchors || anchors.length === 0) return []

      const seen = new Set<string>()
      const items: NavItem[] = []

      for (let i = 0; i < anchors.length; i++) {
        try {
          const link = anchors[i]
          const href = (link.href || '').trim()
          if (!href) continue
          if (href.indexOf(MOD_URL_MARKER) === -1) continue
          if (seen.has(href)) continue
          seen.add(href)
          items.push(link)
        } catch {
        }
      }
      return items
    } catch {
      return []
    }
  }

  /**
   * 从课程主页（课程目录页）提取活动链接
   */
  getItemsFromCoursePage(): NavItem[] {
    try {
      if (typeof document === 'undefined') return []

      const items: NavItem[] = []
      const seen = new Set<string>()

      // 遍历多个可能的活动列表选择器
      for (let i = 0; i < NAV_ITEM_SELECTORS.courseActivitySelectors.length; i++) {
        const sel = NAV_ITEM_SELECTORS.courseActivitySelectors[i]
        const els = document.querySelectorAll<HTMLAnchorElement>(sel)
        for (let j = 0; j < els.length; j++) {
          try {
            const link = els[j]
            const href = (link.href || '').trim()
            if (!href) continue
            if (href.indexOf(MOD_URL_MARKER) === -1) continue
            if (seen.has(href)) continue
            seen.add(href)
            items.push(link)
          } catch {
          }
        }
        if (items.length > 0) return items
      }

      return items
    } catch {
      return []
    }
  }

  getItems(sidebar: Element): NavItem[] {
    return this.extractLinks(sidebar)
  }

  /**
   * 从侧边栏 + 课程主页中收集所有活动链接
   */
  getAllItems(): NavItem[] {
    try {
      const merged: NavItem[] = []
      const seen = new Set<string>()

      const pushUnique = (link: NavItem): void => {
        const href = (link.href || '').trim()
        if (!href) return
        if (href.indexOf(MOD_URL_MARKER) === -1) return
        if (seen.has(href)) return
        seen.add(href)
        merged.push(link)
      }

      const sidebar = this.findSidebar()
      if (sidebar) {
        const sidebarItems = this.getItems(sidebar)
        sidebarItems.forEach(pushUnique)
      }

      if (merged.length === 0) {
        const pageItems = this.getItemsFromCoursePage()
        pageItems.forEach(pushUnique)
      }

      // 最后兜底：全文扫描所有含 /mod/ 的链接
      if (merged.length === 0) {
        const allItems = this.extractLinks(document)
        allItems.forEach(pushUnique)
      }

      return merged
    } catch {
      return []
    }
  }

  /**
   * 从活动列表中查找当前页的索引
   */
  findCurrentIndex(items: NavItem[]): number {
    try {
      if (!items || items.length === 0) return -1
      if (typeof window === 'undefined' || !window.location) return -1

      const currentHref = window.location.href
      const currentParams = parseQueryParams(currentHref)
      const currentBase = getBasePath(currentHref)

      // 策略 1：完全匹配
      for (let i = 0; i < items.length; i++) {
        try {
          if (items[i].href === currentHref) return i
        } catch {
        }
      }

      // 策略 2：参数 id 匹配（最常见）
      const currentId = currentParams['id']
      if (currentId) {
        for (let i = 0; i < items.length; i++) {
          try {
            const itemParams = parseQueryParams(items[i].href)
            const itemId = itemParams['id']
            if (itemId && itemId === currentId) return i
          } catch {
          }
        }
      }

      // 策略 3：路径部分一致（忽略参数）
      for (let i = 0; i < items.length; i++) {
        try {
          const itemBase = getBasePath(items[i].href)
          if (itemBase && currentBase && itemBase === currentBase) return i
        } catch {
        }
      }

      // 策略 4：通过元素上的 "active/selected/current" 类名匹配
      for (let i = 0; i < items.length; i++) {
        try {
          const el = items[i]
          if (el.classList && (
            el.classList.contains('active') ||
            el.classList.contains('current') ||
            el.classList.contains('selected')
          )) {
            return i
          }
          const parent = el.parentElement
          if (parent && parent.classList && (
            parent.classList.contains('active') ||
            parent.classList.contains('current') ||
            parent.classList.contains('selected') ||
            parent.classList.contains('is-active')
          )) {
            return i
          }
        } catch {
        }
      }

      return -1
    } catch {
      return -1
    }
  }

  /**
   * 查找"下一个活动"导航链接（学习内容页上的下一个按钮）
   */
  findNextActivityLink(): string | null {
    try {
      if (typeof document === 'undefined') return null

      const selectors = NAV_ITEM_SELECTORS.nextActivitySelectors
      for (let i = 0; i < selectors.length; i++) {
        const el = document.querySelector<HTMLAnchorElement>(selectors[i])
        if (el && el.href) {
          const href = (el.href || '').trim()
          if (href && href.indexOf(MOD_URL_MARKER) !== -1) {
            return href
          }
        }
      }

      // 兜底：通过文本内容查找
      const anchors = document.querySelectorAll<HTMLAnchorElement>('a')
      for (let i = 0; i < anchors.length; i++) {
        const text = (anchors[i].textContent || '').trim()
        const keywords = NAV_ITEM_SELECTORS.nextActivityKeywords
        for (let j = 0; j < keywords.length; j++) {
          if (text.indexOf(keywords[j]) !== -1) {
            const href = (anchors[i].href || '').trim()
            if (href && href.indexOf(MOD_URL_MARKER) !== -1) {
              return href
            }
          }
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 查找"返回课程主页"的链接
   */
  findCourseHomeLink(): string | null {
    try {
      if (typeof document === 'undefined') return null

      const currentHref = window.location.href
      const currentParams = parseQueryParams(currentHref)

      // 策略 1：从 breadcrumb 找
      const breadcrumbSelectors = NAV_ITEM_SELECTORS.breadcrumbSelectors
      for (let i = 0; i < breadcrumbSelectors.length; i++) {
        const els = document.querySelectorAll<HTMLAnchorElement>(breadcrumbSelectors[i] + ' a[href]')
        for (let j = 0; j < els.length; j++) {
          const href = (els[j].href || '').trim()
          if (href.indexOf('/course/view.php') !== -1) return href
        }
      }

      // 策略 2：查找显式 course id 链接
      const courseId = currentParams['course'] || currentParams['id']
      if (courseId) {
        const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]')
        for (let i = 0; i < anchors.length; i++) {
          const href = (anchors[i].href || '').trim()
          if (href.indexOf('/course/view.php') !== -1 && href.indexOf('id=' + courseId) !== -1) {
            return href
          }
        }
        // 构造一个链接
        const origin = window.location.origin
        if (origin) {
          return origin + '/course/view.php?id=' + courseId
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 判断当前页是否为课程/目录页
   */
  isCoursePage(): boolean {
    try {
      const url = window.location.href
      if (url.indexOf('/course/view.php') !== -1) return true
      if (url.indexOf('/my/') !== -1 && url.indexOf('/my/index') === -1) {
        // 不是纯 dashboard，需要看内容
      }
      return url.indexOf('/course/index') !== -1
    } catch {
      return false
    }
  }

  /**
   * 判断当前页是否为学习内容页
   */
  isActivityPage(): boolean {
    try {
      return window.location.href.indexOf(MOD_URL_MARKER) !== -1
    } catch {
      return false
    }
  }
}

export const sidebarNavigatorService = new SidebarNavigatorService()
export default sidebarNavigatorService
