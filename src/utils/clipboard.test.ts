import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { copyToClipboard } from './clipboard'

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true
    })
    delete (document as unknown as { execCommand?: unknown }).execCommand
  })

  function stubClipboard(writeText: ()=> Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true
    })
  }

  it('空字符串直接返回 false，不碰剪贴板', async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard(writeText)
    expect(await copyToClipboard('')).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('Clipboard API 可用时走标准路径', async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard(writeText)
    expect(await copyToClipboard('你好')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('你好')
  })

  it('Clipboard API 拒绝（非安全上下文 / 权限被拒）时回退 execCommand', async () => {
    stubClipboard(async () => {
      throw new Error('NotAllowedError')
    })
    const execCommand = vi.fn(() => true)
    ;(document as unknown as { execCommand: unknown }).execCommand = execCommand

    expect(await copyToClipboard('回退文本')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // 回退用的临时 textarea 必须被清理掉
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('完全没有 navigator.clipboard 时也回退 execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    })
    const execCommand = vi.fn(() => true)
    ;(document as unknown as { execCommand: unknown }).execCommand = execCommand

    expect(await copyToClipboard('纯回退')).toBe(true)
    expect(execCommand).toHaveBeenCalled()
  })

  it('两条路径都失败时返回 false，并清理临时节点', async () => {
    stubClipboard(async () => {
      throw new Error('nope')
    })
    ;(document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => false)

    expect(await copyToClipboard('失败')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('execCommand 抛异常也不留下临时节点', async () => {
    stubClipboard(async () => {
      throw new Error('nope')
    })
    ;(document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => {
      throw new Error('boom')
    })

    expect(await copyToClipboard('异常')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
