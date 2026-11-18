import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { showUserNotice, hideUserNotice } from './userNotice'

function noticeHost(): HTMLElement | null {
  return document.getElementById('ouchn-user-notice')
}

describe('showUserNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    hideUserNotice()
    vi.advanceTimersByTime(400)
    noticeHost()?.remove()
  })

  afterEach(() => {
    vi.useRealTimers()
    noticeHost()?.remove()
  })

  it('提示文案按纯文本插入，不会被当作 HTML 执行', () => {
    const payload = '<img src=x onerror="window.__pwned=1">危险'
    showUserNotice(payload)

    const shadow = noticeHost()?.shadowRoot
    expect(shadow).toBeTruthy()
    expect(shadow!.querySelector('img')).toBeNull()
    expect(shadow!.textContent).toContain(payload)
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('带 emoji 与类型的提示结构正确', () => {
    showUserNotice('已复制', { type: 'warn' })
    const shadow = noticeHost()!.shadowRoot!
    const el = shadow.querySelector('.notice')
    expect(el).not.toBeNull()
    expect(el!.classList.contains('type-warn')).toBe(true)
    expect(el!.querySelector('.notice-emoji')!.textContent).toBe('⚠️')
    expect(el!.textContent).toContain('已复制')
  })

  it('duration 到期后自动移除', () => {
    showUserNotice('短提示', { duration: 1000 })
    const shadow = noticeHost()!.shadowRoot!
    expect(shadow.querySelector('.notice')).not.toBeNull()

    vi.advanceTimersByTime(1000)
    vi.advanceTimersByTime(400)
    expect(shadow.querySelector('.notice')).toBeNull()
  })

  it('连续调用只保留最后一条', () => {
    showUserNotice('第一条')
    showUserNotice('第二条')
    const shadow = noticeHost()!.shadowRoot!
    const notices = shadow.querySelectorAll('.notice')
    expect(notices).toHaveLength(1)
    expect(notices[0].textContent).toContain('第二条')
  })
})
