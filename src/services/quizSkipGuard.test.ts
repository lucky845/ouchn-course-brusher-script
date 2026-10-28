import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { recordQuizSkip, resetQuizSkipGuard, QUIZ_SKIP_GUARD } from './quizSkipGuard'

describe('quizSkipGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    // 用假时钟控制时间窗口
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-28T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('首次跳过不会触发停止', () => {
    expect(recordQuizSkip('quiz-1')).toBe(false)
  })

  it('同一测验在窗口内连续达到阈值返回停止信号', () => {
    const max = QUIZ_SKIP_GUARD.maxSkipsInWindow
    // 连续跳过次数 = max 时返回 true
    let result = false
    for (let i = 1; i <= max; i++) {
      result = recordQuizSkip('quiz-1')
    }
    expect(result).toBe(true)
  })

  it('不同测验互不影响，各自计数', () => {
    recordQuizSkip('quiz-1')
    recordQuizSkip('quiz-2')
    recordQuizSkip('quiz-1')
    // quiz-1 跳了 2 次，不到阈值
    expect(recordQuizSkip('quiz-2')).toBe(false)
    // quiz-1 第 3 次达到阈值
    expect(recordQuizSkip('quiz-1')).toBe(true)
  })

  it('超过时间窗口后计数重置，停止信号消失', () => {
    const max = QUIZ_SKIP_GUARD.maxSkipsInWindow
    for (let i = 1; i < max; i++) {
      recordQuizSkip('quiz-1')
    }
    // 推进超过窗口
    vi.setSystemTime(new Date(Date.now() + QUIZ_SKIP_GUARD.windowMs + 1000))
    // 窗口外重新计数，不触发停止
    expect(recordQuizSkip('quiz-1')).toBe(false)
  })

  it('reset 后清空记录', () => {
    const max = QUIZ_SKIP_GUARD.maxSkipsInWindow
    for (let i = 1; i <= max; i++) {
      recordQuizSkip('quiz-1')
    }
    expect(recordQuizSkip('quiz-1')).toBe(true)
    resetQuizSkipGuard()
    expect(recordQuizSkip('quiz-1')).toBe(false)
  })

  it('moduleId 为空时也正常计数', () => {
    recordQuizSkip('')
    recordQuizSkip('')
    expect(recordQuizSkip('')).toBe(true)
  })
})