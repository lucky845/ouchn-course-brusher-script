/**
 * 学习提醒服务
 * 设置和管理学习提醒
 *
 * 清理策略：
 * - 整体数据：存储后 365 天未更新则视为过期，全部清除（防止缓存残留泄漏）
 * - 截止日期提醒：截止时间过去 7 天后自动清理
 * - 每日/每周提醒：保留启用状态，用户手动删除；或 180 天未触发视为过期
 * - 通知历史：只保留最近 50 条，且超过 30 天自动清理
 */
import { writeStorage, readStorage } from '../utils/storage'
import { getCourseId } from '../utils/url'

const REMINDER_KEY = 'ouchn_study_reminders'

/** 整体数据 TTL（毫秒）：365 天未更新则全部清除 */
const DATA_TTL_MS = 365 * 24 * 60 * 60 * 1000
/** 通知保留数量上限 */
const NOTIFICATION_MAX_COUNT = 50
/** 通知保留时间（毫秒）：30 天 */
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** 过期提醒在触发后保留时间（毫秒）：7 天 */
const EXPIRED_REMINDER_GRACE_MS = 7 * 24 * 60 * 60 * 1000
/** 每日/每周提醒闲置超时（毫秒）：180 天未触发则清理 */
const IDLE_REMINDER_TTL_MS = 180 * 24 * 60 * 60 * 1000

/** 提醒类型 */
export enum ReminderType {
  DEADLINE = 'deadline',     // 截止日期提醒
  DAILY = 'daily',           // 每日提醒
  WEEKLY = 'weekly',         // 每周提醒
  CUSTOM = 'custom',          // 自定义提醒
}

/** 学习提醒 */
export interface StudyReminder {
  id: string
  courseId: string
  courseName: string
  type: ReminderType
  title: string
  description?: string
  /** 提醒时间（每日/每周为时间戳格式 HH:mm，每周为 0-6 的数字） */
  time: string
  /** 重复：每日/每周 */
  repeat?: 'daily' | 'weekly' | 'once'
  /** 星期（仅每周提醒）0-6 */
  weekday?: number
  /** 截止日期（仅截止日期提醒） */
  deadline?: number
  enabled: boolean
  lastTriggered?: number
  createdAt: number
}

/** 提醒数据（含版本与更新时间，用于 TTL 清理） */
export interface ReminderData {
  version: number
  updatedAt: number
  reminders: StudyReminder[]
  notifications: Notification[]
}

interface Notification {
  id: string
  reminderId: string
  title: string
  message: string
  timestamp: number
  read: boolean
}

const CURRENT_VERSION = 1
const DEFAULT_DATA: ReminderData = {
  version: CURRENT_VERSION,
  updatedAt: Date.now(),
  reminders: [],
  notifications: [],
}

function isValidData (data: unknown): data is ReminderData {
  if (data === null || typeof data !== 'object') return false
  const d = data as any
  return (
    Array.isArray(d.reminders) &&
    Array.isArray(d.notifications) &&
    typeof d.version === 'number' &&
    typeof d.updatedAt === 'number'
  )
}

type ReminderListener = (data: ReminderData) => void

export class StudyReminderService {
  private data: ReminderData = { ...DEFAULT_DATA }
  private listeners: Set<ReminderListener> = new Set()
  private checkTimer: number | null = null
  private lastCleanAt: number | null = null

  constructor () {
    this.load()
    this.startChecking()
  }

  /** 从 localStorage 加载数据（含版本校验与过期清理） */
  private load (): void {
    const parsed = readStorage<ReminderData>(REMINDER_KEY, DEFAULT_DATA, isValidData)

    // 1) 数据整体过期：超过 DATA_TTL_MS 未更新则全部清空（防止缓存残留泄漏
    if (!parsed || typeof parsed.updatedAt !== 'number' || Date.now() - parsed.updatedAt > DATA_TTL_MS) {
      this.data = { ...DEFAULT_DATA, updatedAt: Date.now() }
      this.save()
      return
    }

    // 2) 版本升级检查：v1 的数据需要补齐字段
    let reminders = (parsed?.reminders || []).slice()
    let notifications = (parsed?.notifications || []).slice()

    // 3) 过期/闲置提醒清理
    const now = Date.now()
    const initialCount = reminders.length
    reminders = reminders.filter((reminder) => {
      // 截止日期已过：超过 grace 期直接删除
      if (reminder.deadline && now - reminder.deadline > EXPIRED_REMINDER_GRACE_MS) {
        return false
      }
      // 每日/每周：长时间未触发且未启用 → 视为闲置删除
      if (
        (reminder.type === ReminderType.DAILY || reminder.type === ReminderType.WEEKLY) &&
        !reminder.enabled &&
        reminder.lastTriggered &&
        now - reminder.lastTriggered > IDLE_REMINDER_TTL_MS
      ) {
        return false
      }
      return true
    })

    // 4) 通知历史：数量限制 + 时间限制
    notifications = notifications
      .filter(n => now - n.timestamp <= NOTIFICATION_TTL_MS)
      .slice(0, NOTIFICATION_MAX_COUNT)

    const removed = initialCount - reminders.length
    const removedNotifs = (parsed?.notifications?.length || 0) - notifications.length
    if (removed > 0 || removedNotifs > 0) {
      console.log(`[StudyReminder] 启动清理：reminders -${removed}，notifications -${removedNotifs}`)
    }

    this.data = {
      version: CURRENT_VERSION,
      updatedAt: Date.now(),
      reminders,
      notifications,
    }
  }

  /** 保存数据到 localStorage（自动更新 updatedAt 与 version） */
  private save (): void {
    this.data.version = CURRENT_VERSION
    this.data.updatedAt = Date.now()
    writeStorage(REMINDER_KEY, this.data)
    this.notifyListeners()
  }

  /** 通知所有监听器 */
  private notifyListeners (): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.data })
      } catch (e) {
        console.warn('[StudyReminder] Listener error', e)
      }
    })
  }

  /** 订阅变化 */
  subscribe (listener: ReminderListener): () => void {
    this.listeners.add(listener)
    listener({ ...this.data })
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 启动定时检查 */
  private startChecking (): void {
    if (this.checkTimer !== null) return

    // 每分钟检查一次
    this.checkTimer = window.setInterval(() => {
      this.checkReminders()
    }, 60000)

    // 启动后 5 秒做一次清理 + 检查
    setTimeout(() => {
      this.cleanExpiredData(true)
      this.checkReminders()
    }, 5000)
  }

  /** 停止定时检查 */
  stopChecking (): void {
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * 清理过期数据（运行时定期调用）
   * @param force 强制清理，否则每小时最多清理一次
   */
  private cleanExpiredData (force = false): void {
    const now = Date.now()
    // 每小时最多清理一次（节省性能）
    if (!force && this.lastCleanAt && now - this.lastCleanAt < 60 * 60 * 1000) {
      return
    }
    this.lastCleanAt = now

    const beforeReminders = this.data.reminders.length
    const beforeNotifs = this.data.notifications.length

    // 清理过期/闲置提醒
    this.data.reminders = this.data.reminders.filter((reminder) => {
      // 截止日期已过 grace 期
      if (reminder.deadline && now - reminder.deadline > EXPIRED_REMINDER_GRACE_MS) {
        return false
      }
      // 每日/每周：关闭状态 + 长期未触发 → 视为闲置
      if (
        (reminder.type === ReminderType.DAILY || reminder.type === ReminderType.WEEKLY) &&
        !reminder.enabled &&
        reminder.lastTriggered &&
        now - reminder.lastTriggered > IDLE_REMINDER_TTL_MS
      ) {
        return false
      }
      return true
    })

    // 通知历史：时间 + 数量限制
    this.data.notifications = this.data.notifications
      .filter((n) => now - n.timestamp <= NOTIFICATION_TTL_MS)
      .slice(0, NOTIFICATION_MAX_COUNT)

    const removedReminders = beforeReminders - this.data.reminders.length
    const removedNotifs = beforeNotifs - this.data.notifications.length

    if (removedReminders > 0 || removedNotifs > 0) {
      console.log(`[StudyReminder] 定期清理：reminders -${removedReminders}，notifications -${removedNotifs}`)
      this.save()
    } else if (force) {
      // 强制模式下至少刷新 updatedAt
      this.save()
    }
  }

  /** 检查提醒 */
  private checkReminders (): void {
    // 先做一次惰性过期清理
    this.cleanExpiredData(false)

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const currentWeekday = now.getDay()
    const currentTimestamp = now.getTime()

    this.data.reminders.forEach((reminder) => {
      if (!reminder.enabled) return

      // 检查是否应该触发
      let shouldTrigger = false

      switch (reminder.type) {
        case ReminderType.DAILY:
          shouldTrigger = reminder.time === currentTime
          break

        case ReminderType.WEEKLY:
          shouldTrigger = reminder.weekday === currentWeekday && reminder.time === currentTime
          break

        case ReminderType.DEADLINE:
          if (reminder.deadline) {
            const timeUntilDeadline = reminder.deadline - currentTimestamp
            // 在截止前 1 天、3 天、7 天提醒
            const days = [1, 3, 7]
            for (const day of days) {
              const dayMs = day * 24 * 60 * 60 * 1000
              if (timeUntilDeadline > 0 && timeUntilDeadline <= dayMs) {
                // 检查是否已经提醒过
                if (!reminder.lastTriggered || currentTimestamp - reminder.lastTriggered > 12 * 60 * 60 * 1000) {
                  shouldTrigger = true
                }
                break
              }
            }
          }
          break

        case ReminderType.CUSTOM:
          if (reminder.deadline && reminder.deadline <= currentTimestamp) {
            shouldTrigger = true
          }
          break
      }

      if (shouldTrigger) {
        this.triggerReminder(reminder)
      }
    })
  }

  /** 触发提醒 */
  private triggerReminder (reminder: StudyReminder): void {
    // 更新最后触发时间
    reminder.lastTriggered = Date.now()
    this.save()

    // 创建通知
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      reminderId: reminder.id,
      title: reminder.title,
      message: this.getReminderMessage(reminder),
      timestamp: Date.now(),
      read: false,
    }

    this.data.notifications.unshift(notification)

    // 只保留最近 NOTIFICATION_MAX_COUNT 条通知
    if (this.data.notifications.length > NOTIFICATION_MAX_COUNT) {
      this.data.notifications = this.data.notifications.slice(0, NOTIFICATION_MAX_COUNT)
    }

    this.save()
    this.showBrowserNotification(notification)

    console.log('[StudyReminder] 触发提醒:', reminder.title)
  }

  /** 获取提醒消息 */
  private getReminderMessage (reminder: StudyReminder): string {
    switch (reminder.type) {
      case ReminderType.DAILY:
        return `该学习了！${reminder.description || ''}`

      case ReminderType.WEEKLY:
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        return `${weekdays[reminder.weekday || 0]}了，该学习了！${reminder.description || ''}`

      case ReminderType.DEADLINE:
        if (reminder.deadline) {
          const daysLeft = Math.ceil((reminder.deadline - Date.now()) / (24 * 60 * 60 * 1000))
          return `距截止还有 ${daysLeft} 天！${reminder.description || ''}`
        }
        return `${reminder.description || '任务即将到期！'}`

      default:
        return reminder.description || '学习提醒'
    }
  }

  /** 显示浏览器通知 */
  private showBrowserNotification (notification: Notification): void {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '📚',
        tag: notification.id,
      })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '📚',
            tag: notification.id,
          })
        }
      })
    }
  }

  /** 获取所有提醒 */
  getAll (): StudyReminder[] {
    return [...this.data.reminders]
  }

  /** 获取当前课程提醒 */
  getByCourse (courseId: string): StudyReminder[] {
    return this.data.reminders.filter(r => r.courseId === courseId)
  }

  /** 获取未读通知数 */
  getUnreadCount (): number {
    return this.data.notifications.filter(n => !n.read).length
  }

  /** 获取通知 */
  getNotifications (limit = 20): Notification[] {
    return this.data.notifications.slice(0, limit)
  }

  /** 标记通知已读 */
  markAsRead (notificationId: string): void {
    const notif = this.data.notifications.find(n => n.id === notificationId)
    if (notif) {
      notif.read = true
      this.save()
    }
  }

  /** 全部标记已读 */
  markAllAsRead (): void {
    this.data.notifications.forEach(n => {
      n.read = true
    })
    this.save()
  }

  /** 清空通知 */
  clearNotifications (): void {
    this.data.notifications = []
    this.save()
  }

  /** 创建每日提醒 */
  createDailyReminder (title: string, time: string, description?: string): StudyReminder {
    const courseId = getCourseId() || 'global'
    const courseName = document.title.replace(/\s*[-_].*$/, '').trim() || '通用'

    const reminder: StudyReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      courseId,
      courseName,
      type: ReminderType.DAILY,
      title,
      description,
      time,
      repeat: 'daily',
      enabled: true,
      createdAt: Date.now(),
    }

    this.data.reminders.push(reminder)
    this.save()
    console.log('[StudyReminder] 创建每日提醒:', title, time)
    return reminder
  }

  /** 创建每周提醒 */
  createWeeklyReminder (title: string, weekday: number, time: string, description?: string): StudyReminder {
    const courseId = getCourseId() || 'global'
    const courseName = document.title.replace(/\s*[-_].*$/, '').trim() || '通用'

    const reminder: StudyReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      courseId,
      courseName,
      type: ReminderType.WEEKLY,
      title,
      description,
      time,
      weekday,
      repeat: 'weekly',
      enabled: true,
      createdAt: Date.now(),
    }

    this.data.reminders.push(reminder)
    this.save()
    console.log('[StudyReminder] 创建每周提醒:', title, weekday, time)
    return reminder
  }

  /** 创建截止日期提醒 */
  createDeadlineReminder (title: string, deadline: number, description?: string): StudyReminder {
    const courseId = getCourseId() || 'global'
    const courseName = document.title.replace(/\s*[-_].*$/, '').trim() || '通用'

    const reminder: StudyReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      courseId,
      courseName,
      type: ReminderType.DEADLINE,
      title,
      description,
      deadline,
      enabled: true,
      createdAt: Date.now(),
    }

    this.data.reminders.push(reminder)
    this.save()
    console.log('[StudyReminder] 创建截止日期提醒:', title, new Date(deadline).toLocaleString())
    return reminder
  }

  /** 更新提醒 */
  update (id: string, updates: Partial<StudyReminder>): boolean {
    const index = this.data.reminders.findIndex(r => r.id === id)
    if (index === -1) return false

    this.data.reminders[index] = { ...this.data.reminders[index], ...updates }
    this.save()
    return true
  }

  /** 删除提醒 */
  delete (id: string): boolean {
    const index = this.data.reminders.findIndex(r => r.id === id)
    if (index === -1) return false

    this.data.reminders.splice(index, 1)
    this.save()
    return true
  }

  /** 删除课程的所有提醒 */
  deleteByCourse (courseId: string): number {
    const before = this.data.reminders.length
    this.data.reminders = this.data.reminders.filter(r => r.courseId !== courseId)
    this.save()
    return before - this.data.reminders.length
  }

  /** 切换提醒启用状态 */
  toggle (id: string): boolean {
    const reminder = this.data.reminders.find(r => r.id === id)
    if (!reminder) return false

    reminder.enabled = !reminder.enabled
    this.save()
    return true
  }
}

export const studyReminderService = new StudyReminderService()
