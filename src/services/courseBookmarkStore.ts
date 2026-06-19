/**
 * 学习书签服务
 * 用于保存和恢复学习位置
 */
import { writeStorage, readStorage } from '../utils/storage'
import { getCourseId } from '../utils/url'

const BOOKMARK_KEY = 'ouchn_course_bookmarks'

/** 单个书签 */
export interface Bookmark {
  id: string
  courseId: string
  courseName: string
  chapterIndex: number
  chapterName: string
  activityIndex?: number
  activityName?: string
  activityUrl?: string
  note?: string
  createdAt: number
  updatedAt: number
}

/** 书签数据 */
export interface BookmarkData {
  bookmarks: Bookmark[]
  lastBookmarkId: string | null
}

const DEFAULT_DATA: BookmarkData = {
  bookmarks: [],
  lastBookmarkId: null
}

function isValidData(data: unknown): data is BookmarkData {
  if (data === null || typeof data !== 'object') return false
  const d = data as any
  return Array.isArray(d.bookmarks)
}

type BookmarkListener = (data: BookmarkData)=> void

export class BookmarkStore {
  private data: BookmarkData = { ...DEFAULT_DATA }
  private listeners = new Set<BookmarkListener>()

  constructor() {
    this.load()
  }

  /** 从 localStorage 加载数据 */
  private load(): void {
    const parsed = readStorage<BookmarkData>(BOOKMARK_KEY, DEFAULT_DATA, isValidData)
    this.data = { ...DEFAULT_DATA, ...parsed, bookmarks: parsed?.bookmarks || []}
  }

  /** 保存数据到 localStorage */
  private save(): void {
    writeStorage(BOOKMARK_KEY, this.data)
    this.notifyListeners()
  }

  /** 通知所有监听器 */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.data, bookmarks: [...this.data.bookmarks]})
      } catch (e) {
        console.warn('[BookmarkStore] Listener error', e)
      }
    })
  }

  /** 订阅变化 */
  subscribe(listener: BookmarkListener): ()=> void {
    this.listeners.add(listener)
    listener({ ...this.data, bookmarks: [...this.data.bookmarks]})
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 获取所有书签 */
  getAll(): Bookmark[] {
    return [...this.data.bookmarks]
  }

  /** 获取当前课程的书签 */
  getByCourse(courseId: string): Bookmark[] {
    return this.data.bookmarks.filter(b => b.courseId === courseId)
  }

  /** 获取当前课程的最后书签 */
  getLastBookmark(courseId: string): Bookmark | null {
    const courseBookmarks = this.getByCourse(courseId)
    if (courseBookmarks.length === 0) return null
    // 按更新时间排序，返回最新的
    return courseBookmarks.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  }

  /** 创建书签 */
  create(bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>): Bookmark {
    const now = Date.now()
    const newBookmark: Bookmark = {
      ...bookmark,
      id: `bm_${now}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: now,
      updatedAt: now
    }

    this.data.bookmarks.unshift(newBookmark)
    this.data.lastBookmarkId = newBookmark.id
    this.save()

    console.log('[BookmarkStore] 创建书签:', newBookmark.chapterName, newBookmark.activityName || '')
    return newBookmark
  }

  /** 保存当前位置为书签 */
  saveCurrentPosition(options?: { note?: string }): Bookmark | null {
    const courseId = getCourseId()
    if (!courseId) {
      console.log('[BookmarkStore] 无法获取课程 ID')
      return null
    }

    // 从 DOM 获取当前位置信息
    const courseName = document.title.replace(/\s*[-_].*$/, '').trim() || '未知课程'

    // 查找当前可见的章节和活动
    const chapterEl = document.querySelector('.course-section.current, .section.current, [class*="section"][class*="active"]')
    const chapterIndex = this.getChapterIndex(chapterEl as HTMLElement)
    const chapterName = chapterEl?.querySelector('.section-title, .sectionname, h3')?.textContent?.trim() || `第 ${chapterIndex + 1} 章`

    // 查找当前活动
    const activityEl = document.querySelector('.activity.current, .mod-indent-outer.current, [class*="activity"][class*="active"]')
    const activityInfo = this.getActivityInfo(activityEl as HTMLElement)

    return this.create({
      courseId,
      courseName,
      chapterIndex,
      chapterName,
      activityIndex: activityInfo.index,
      activityName: activityInfo.name,
      activityUrl: activityInfo.url,
      note: options?.note
    })
  }

  /** 更新书签 */
  update(id: string, updates: Partial<Pick<Bookmark, 'note'>>): boolean {
    const index = this.data.bookmarks.findIndex(b => b.id === id)
    if (index === -1) return false

    this.data.bookmarks[index] = {
      ...this.data.bookmarks[index],
      ...updates,
      updatedAt: Date.now()
    }
    this.save()
    return true
  }

  /** 删除书签 */
  delete(id: string): boolean {
    const index = this.data.bookmarks.findIndex(b => b.id === id)
    if (index === -1) return false

    this.data.bookmarks.splice(index, 1)
    if (this.data.lastBookmarkId === id) {
      this.data.lastBookmarkId = this.data.bookmarks[0]?.id || null
    }
    this.save()
    return true
  }

  /** 删除课程的所有书签 */
  deleteByCourse(courseId: string): number {
    const before = this.data.bookmarks.length
    this.data.bookmarks = this.data.bookmarks.filter(b => b.courseId !== courseId)
    if (this.data.lastBookmarkId) {
      const last = this.data.bookmarks[0]
      this.data.lastBookmarkId = last?.id || null
    }
    this.save()
    return before - this.data.bookmarks.length
  }

  /** 获取章节索引 */
  private getChapterIndex(el: HTMLElement | null): number {
    if (!el) return 0
    const allChapters = document.querySelectorAll('.course-section, .section, [id^="section-"]')
    return Array.from(allChapters).indexOf(el)
  }

  /** 获取活动信息 */
  private getActivityInfo(el: HTMLElement | null): { index: number, name: string, url: string } {
    if (!el) return { index: -1, name: '', url: '' }

    const nameEl = el.querySelector('.instancename, .activityname, a')
    const name = nameEl?.textContent?.trim()?.replace(/\s*\([\d没\d完成]+\)\s*$/g, '') || ''

    const linkEl = el.querySelector('a[href]')
    const url = linkEl ? (linkEl as HTMLAnchorElement).href : ''

    // 计算活动索引
    const allActivities = document.querySelectorAll('.activity, .mod-indent-outer, [class*="activity "]')
    const index = Array.from(allActivities).indexOf(el)

    return { index, name, url }
  }
}

export const bookmarkStore = new BookmarkStore()
