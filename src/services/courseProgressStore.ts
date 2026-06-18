/**
 * 课程进度共享状态服务
 * 用于在刷课页面和课程详情页面板之间共享刷课进度
 */
import type { CourseDetailInfo, ChapterItem, ChapterStatus } from '../types'
import { writeStorage, readStorage } from '../utils/storage'

const COURSE_PROGRESS_KEY = 'ouchn_course_progress'

/** 单个课程的刷课进度 */
export interface CourseProgress {
  courseId: string
  courseName: string
  lastActivityName: string
  lastActivityUrl: string
  isBrushing: boolean
  brushingStartTime: number
  lastUpdateTime: number
  /** 已完成的活动索引列表 */
  completedActivities: number[]
  /** 当前正在刷的活动索引 */
  currentActivityIndex: number
  totalActivities: number
}

/** 所有课程的进度数据 */
export interface CourseProgressMap {
  [courseId: string]: CourseProgress
}

export interface CourseProgressStoreData {
  currentCourseId: string | null
  courses: CourseProgressMap
}

const DEFAULT_DATA: CourseProgressStoreData = {
  currentCourseId: null,
  courses: {},
}

function isValidData (data: unknown): data is CourseProgressStoreData {
  if (data === null || typeof data !== 'object') return false
  const d = data as any
  return typeof d.courses === 'object' && d.courses !== null
}

/** 课程进度监听器 */
type ProgressListener = (data: CourseProgressStoreData) => void

export class CourseProgressStore {
  private data: CourseProgressStoreData = { ...DEFAULT_DATA }
  private listeners: Set<ProgressListener> = new Set()
  private updateTimer: number | null = null

  constructor () {
    this.load()
  }

  /** 从 localStorage 加载数据 */
  private load (): void {
    const parsed = readStorage<CourseProgressStoreData>(COURSE_PROGRESS_KEY, DEFAULT_DATA, isValidData)
    this.data = { ...DEFAULT_DATA, ...parsed }
  }

  /** 保存数据到 localStorage */
  private save (): void {
    writeStorage(COURSE_PROGRESS_KEY, this.data)
    this.notifyListeners()
  }

  /** 通知所有监听器 */
  private notifyListeners (): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.data })
      } catch (e) {
        console.warn('[CourseProgressStore] Listener error', e)
      }
    })
  }

  /** 订阅进度变化 */
  subscribe (listener: ProgressListener): () => void {
    this.listeners.add(listener)
    // 立即调用一次，传递当前数据
    try {
      listener({ ...this.data })
    } catch (e) {
      console.warn('[CourseProgressStore] Initial listener error', e)
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 获取当前课程进度数据 */
  getData (): CourseProgressStoreData {
    return { ...this.data }
  }

  /** 获取指定课程的进度 */
  getCourseProgress (courseId: string): CourseProgress | null {
    return this.data.courses[courseId] || null
  }

  /** 获取当前正在刷的课程 ID */
  getCurrentCourseId (): string | null {
    return this.data.currentCourseId
  }

  /** 开始刷课 - 初始化课程进度 */
  startBrushing (courseId: string, courseName: string, totalActivities: number): void {
    if (!this.data.courses[courseId]) {
      this.data.courses[courseId] = {
        courseId,
        courseName,
        lastActivityName: '',
        lastActivityUrl: '',
        isBrushing: false,
        brushingStartTime: 0,
        lastUpdateTime: 0,
        completedActivities: [],
        currentActivityIndex: 0,
        totalActivities,
      }
    }

    this.data.currentCourseId = courseId
    const course = this.data.courses[courseId]
    course.isBrushing = true
    course.brushingStartTime = Date.now()
    course.lastUpdateTime = Date.now()
    course.totalActivities = totalActivities

    this.save()
    console.log('[CourseProgressStore] 开始刷课:', courseName)
  }

  /** 更新当前刷课活动 */
  updateCurrentActivity (activityIndex: number, activityName: string, activityUrl: string): void {
    const courseId = this.data.currentCourseId
    if (!courseId || !this.data.courses[courseId]) return

    const course = this.data.courses[courseId]
    course.currentActivityIndex = activityIndex
    course.lastActivityName = activityName
    course.lastActivityUrl = activityUrl
    course.lastUpdateTime = Date.now()

    // 防抖保存
    this.debouncedSave()
    console.log('[CourseProgressStore] 更新活动:', activityName, `(${activityIndex + 1}/${course.totalActivities})`)
  }

  /** 标记活动完成 */
  markActivityCompleted (activityIndex: number): void {
    const courseId = this.data.currentCourseId
    if (!courseId || !this.data.courses[courseId]) return

    const course = this.data.courses[courseId]
    if (!course.completedActivities.includes(activityIndex)) {
      course.completedActivities.push(activityIndex)
      course.lastUpdateTime = Date.now()
      this.debouncedSave()
      console.log('[CourseProgressStore] 标记完成:', activityIndex, `(${course.completedActivities.length}/${course.totalActivities})`)
    }
  }

  /** 停止刷课 */
  stopBrushing (): void {
    const courseId = this.data.currentCourseId
    if (!courseId) return

    const course = this.data.courses[courseId]
    if (course) {
      course.isBrushing = false
      course.lastUpdateTime = Date.now()
      this.save()
      console.log('[CourseProgressStore] 停止刷课:', course.courseName)
    }

    this.data.currentCourseId = null
    this.save()
  }

  /** 从课程详情页信息更新课程进度 */
  syncFromCourseInfo (courseInfo: CourseDetailInfo): void {
    const courseId = courseInfo.courseId
    if (!courseId) return

    if (!this.data.courses[courseId]) {
      this.data.courses[courseId] = {
        courseId,
        courseName: courseInfo.courseName,
        lastActivityName: '',
        lastActivityUrl: '',
        isBrushing: false,
        brushingStartTime: 0,
        lastUpdateTime: Date.now(),
        completedActivities: [],
        currentActivityIndex: 0,
        totalActivities: courseInfo.chapters.reduce((sum, ch) => sum + ch.activities.length, 0),
      }
    } else {
      // 更新课程名称
      this.data.courses[courseId].courseName = courseInfo.courseName
      this.data.courses[courseId].totalActivities = courseInfo.chapters.reduce((sum, ch) => sum + ch.activities.length, 0)
      this.data.courses[courseId].lastUpdateTime = Date.now()
    }

    // 从课程详情页同步已完成的活动状态
    let activityIndex = 0
    courseInfo.chapters.forEach((chapter) => {
      chapter.activities.forEach((activity) => {
        if (activity.status === ChapterStatus.COMPLETED) {
          if (!this.data.courses[courseId].completedActivities.includes(activityIndex)) {
            this.data.courses[courseId].completedActivities.push(activityIndex)
          }
        }
        activityIndex++
      })
    })

    this.save()
    console.log('[CourseProgressStore] 同步课程详情页进度:', courseInfo.courseName)
  }

  /** 获取课程完成百分比 */
  getCourseCompletionPercent (courseId: string): number {
    const course = this.data.courses[courseId]
    if (!course || course.totalActivities === 0) return 0
    return Math.round((course.completedActivities.length / course.totalActivities) * 100)
  }

  /** 防抖保存 */
  private debouncedSave (): void {
    if (this.updateTimer !== null) {
      clearTimeout(this.updateTimer)
    }
    this.updateTimer = window.setTimeout(() => {
      this.save()
      this.updateTimer = null
    }, 500)
  }

  /** 清空所有数据 */
  clear (): void {
    this.data = { ...DEFAULT_DATA }
    this.save()
    console.log('[CourseProgressStore] 已清空所有数据')
  }

  /** 清空指定课程的数据 */
  clearCourse (courseId: string): void {
    if (this.data.courses[courseId]) {
      delete this.data.courses[courseId]
      if (this.data.currentCourseId === courseId) {
        this.data.currentCourseId = null
      }
      this.save()
      console.log('[CourseProgressStore] 已清空课程:', courseId)
    }
  }
}

export const courseProgressStore = new CourseProgressStore()
