import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatTime, getActivityIcon, getReminderTimeText, getResultTypeLabel } from './coursePanel'

describe('coursePanel utils', () => {
  describe('getActivityIcon', () => {
    it('返回已知类型的图标', () => {
      expect(getActivityIcon('视频')).toBe('🎬')
      expect(getActivityIcon('测验')).toBe('📝')
      expect(getActivityIcon('作业')).toBe('📋')
    })

    it('未知类型回退到占位图标', () => {
      expect(getActivityIcon('未知类型')).toBe('📌')
    })
  })

  describe('getResultTypeLabel', () => {
    it('返回带 emoji 的类型标签', () => {
      expect(getResultTypeLabel('chapter')).toBe('📚 章节')
      expect(getResultTypeLabel('activity')).toBe('📌 活动')
      expect(getResultTypeLabel('content')).toBe('📝 内容')
    })

    it('未知类型原样返回', () => {
      expect(getResultTypeLabel('other')).toBe('other')
    })
  })

  describe('getReminderTimeText', () => {
    it('每日', () => {
      expect(getReminderTimeText({ type: 'daily', time: '08:30' })).toBe('每日 08:30')
    })

    it('每周', () => {
      expect(getReminderTimeText({ type: 'weekly', time: '18:00', weekday: 3 })).toBe('周三 18:00')
    })

    it('截止日期（数值时间戳）', () => {
      const ts = new Date('2026-11-01T10:00:00').getTime()
      const text = getReminderTimeText({ type: 'deadline', deadline: ts })
      expect(text).toBe(new Date(ts).toLocaleString())
    })
  })

  describe('formatTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('今天', () => {
      const now = new Date('2026-10-28T12:00:00')
      vi.setSystemTime(now)
      // 今天 09:05
      const today = new Date('2026-10-28T09:05:00').getTime()
      expect(formatTime(today)).toBe('今天 09:05')
    })

    it('昨天', () => {
      const now = new Date('2026-10-28T12:00:00')
      vi.setSystemTime(now)
      const y = new Date('2026-10-27T08:10:00').getTime()
      expect(formatTime(y)).toBe('昨天 08:10')
    })

    it('7 天内为 X天前', () => {
      const now = new Date('2026-10-28T12:00:00')
      vi.setSystemTime(now)
      const d3 = new Date('2026-10-25T12:00:00').getTime()
      expect(formatTime(d3)).toBe('3天前')
    })

    it('7 天以上为月/日', () => {
      const now = new Date('2026-10-28T12:00:00')
      vi.setSystemTime(now)
      const old = new Date('2026-08-15T12:00:00').getTime()
      expect(formatTime(old)).toBe('8/15')
    })
  })
})
