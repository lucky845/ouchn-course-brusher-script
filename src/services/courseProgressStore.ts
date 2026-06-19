/**
 * 课程进度共享状态服务
 * 用于在刷课页面和课程详情页面板之间共享刷课进度
 */
import type { CourseDetailInfo, ChapterItem } from '../types'
import { ChapterStatus } from '../types'
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
  /** 已完成的活动 Map：key=moduleId, value=是否完成 */
  completedActivities: Record<string, boolean>
  /** 当前正在刷的活动 moduleId */
  currentActivityId: string | null
  totalActivities: number
  /** 是否已完成（所有活动都完成） */
  isCompleted: boolean
}

/** 所有课程的进度数据 */
export type CourseProgressMap = Record<string, CourseProgress>

export interface CourseProgressStoreData {
  currentCourseId: string | null
  courses: CourseProgressMap
}

const DEFAULT_DATA: CourseProgressStoreData = {
  currentCourseId: null,
  courses: {}
}

function isValidData(data: unknown): data is CourseProgressStoreData {
  if (data === null || typeof data !== 'object') return false
  const d = data as any
  return typeof d.courses === 'object' && d.courses !== null
}

/** 课程进度监听器 */
type ProgressListener = (data: CourseProgressStoreData)=> void

export class CourseProgressStore {
  private data: CourseProgressStoreData = { ...DEFAULT_DATA }
  private listeners = new Set<ProgressListener>()
  private updateTimer: number | null = null

  constructor() {
    this.load()
  }

  /** 从 localStorage 加载数据 */
  private load(): void {
    const parsed = readStorage<CourseProgressStoreData>(COURSE_PROGRESS_KEY, DEFAULT_DATA, isValidData)
    this.data = { ...DEFAULT_DATA, ...parsed }
  }

  /** 保存数据到 localStorage */
  private save(): void {
    writeStorage(COURSE_PROGRESS_KEY, this.data)
    this.notifyListeners()
  }

  /** 通知所有监听器 */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.data })
      } catch (e) {
        console.warn('[CourseProgressStore] Listener error', e)
      }
    })
  }

  /** 订阅进度变化 */
  subscribe(listener: ProgressListener): ()=> void {
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
  getData(): CourseProgressStoreData {
    return { ...this.data }
  }

  /** 获取指定课程的进度 */
  getCourseProgress(courseId: string): CourseProgress | null {
    return this.data.courses[courseId] || null
  }

  /** 获取当前正在刷的课程 ID */
  getCurrentCourseId(): string | null {
    return this.data.currentCourseId
  }

  /** 开始刷课 - 初始化课程进度 */
  startBrushing(courseId: string, courseName: string, totalActivities: number): void {
    if (!this.data.courses[courseId]) {
      this.data.courses[courseId] = {
        courseId,
        courseName,
        lastActivityName: '',
        lastActivityUrl: '',
        isBrushing: false,
        brushingStartTime: 0,
        lastUpdateTime: 0,
        completedActivities: {},
        currentActivityId: null,
        totalActivities,
        isCompleted: false
      }
    }

    this.data.currentCourseId = courseId
    const course = this.data.courses[courseId]
    course.isBrushing = true
    course.brushingStartTime = Date.now()
    course.lastUpdateTime = Date.now()
    course.totalActivities = totalActivities

    this.save()
  }

  /** 更新当前刷课活动 */
  updateCurrentActivity(activityId: string, activityName: string, activityUrl: string): void {
    const courseId = this.data.currentCourseId
    if (!courseId || !this.data.courses[courseId]) return

    const course = this.data.courses[courseId]
    course.currentActivityId = activityId
    course.lastActivityName = activityName
    course.lastActivityUrl = activityUrl
    course.lastUpdateTime = Date.now()

    // 防抖保存
    this.debouncedSave()
  }

  /** 标记活动完成 */
  markActivityCompleted(activityId: string): void {
    const courseId = this.data.currentCourseId
    if (!courseId || !this.data.courses[courseId]) return

    const course = this.data.courses[courseId]
    if (!course.completedActivities[activityId]) {
      course.completedActivities[activityId] = true
      course.lastUpdateTime = Date.now()

      // 检查课程是否全部完成
      this.checkCourseCompleted(courseId)

      this.debouncedSave()
    }
  }

  /** 检查课程是否全部完成 */
  private checkCourseCompleted(courseId: string): void {
    const course = this.data.courses[courseId]
    if (!course) return

    const completedCount = Object.keys(course.completedActivities).length
    const wasCompleted = course.isCompleted
    course.isCompleted = course.totalActivities > 0 && completedCount >= course.totalActivities

    if (course.isCompleted && !wasCompleted) {
      console.log(`[CourseProgressStore] 课程完成: ${course.courseName}`)
    }
  }

  /** 停止刷课 */
  stopBrushing(): void {
    const courseId = this.data.currentCourseId
    if (!courseId) return

    const course = this.data.courses[courseId]
    if (course) {
      course.isBrushing = false
      course.lastUpdateTime = Date.now()
      this.save()
    }

    this.data.currentCourseId = null
    this.save()
  }

  /** 从课程详情页信息更新课程进度 */
  syncFromCourseInfo(courseInfo: CourseDetailInfo): void {
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
        completedActivities: {},
        currentActivityId: null,
        totalActivities: courseInfo.chapters.reduce((sum, ch) => sum + ch.activities.length, 0),
        isCompleted: false
      }
    } else {
      // 更新课程名称
      this.data.courses[courseId].courseName = courseInfo.courseName
      this.data.courses[courseId].totalActivities = courseInfo.chapters.reduce((sum, ch) => sum + ch.activities.length, 0)
      this.data.courses[courseId].lastUpdateTime = Date.now()
    }

    // 从课程详情页同步已完成的活动状态（使用 moduleId 作为 key）
    const completedMap: Record<string, boolean> = {}
    courseInfo.chapters.forEach((chapter) => {
      chapter.activities.forEach((activity) => {
        if (activity.moduleId && activity.status === ChapterStatus.COMPLETED) {
          completedMap[activity.moduleId] = true
        }
      })
    })

    // 更新完成列表
    this.data.courses[courseId].completedActivities = completedMap

    // 检查课程是否完成
    this.checkCourseCompleted(courseId)

    this.save()
    console.log('[CourseProgressStore] 同步课程详情页进度:', courseInfo.courseName)
  }

  /** 获取课程完成百分比 */
  getCourseCompletionPercent(courseId: string): number {
    const course = this.data.courses[courseId]
    if (!course || course.totalActivities === 0) return 0
    const completedCount = Object.keys(course.completedActivities).length
    return Math.round((completedCount / course.totalActivities) * 100)
  }

  /** 防抖保存 */
  private debouncedSave(): void {
    if (this.updateTimer !== null) {
      clearTimeout(this.updateTimer)
    }
    this.updateTimer = window.setTimeout(() => {
      this.save()
      this.updateTimer = null
    }, 500)
  }

  /** 清空所有数据 */
  clear(): void {
    this.data = { ...DEFAULT_DATA }
    this.save()
  }

  /** 清空指定课程的数据 */
  clearCourse(courseId: string): void {
    if (this.data.courses[courseId]) {
      delete this.data.courses[courseId]
      if (this.data.currentCourseId === courseId) {
        this.data.currentCourseId = null
      }
      this.save()
    }
  }
}

export const courseProgressStore = new CourseProgressStore()
