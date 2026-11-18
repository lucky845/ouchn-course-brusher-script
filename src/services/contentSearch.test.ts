import { describe, it, expect, beforeEach } from 'vitest'
import { ContentSearchService } from './contentSearch'
import type { ChapterItem } from '../types'
import { ChapterStatus } from '../types'

function chapterWithText(text: string): ChapterItem {
  const el = document.createElement('div')
  el.className = 'section-title'
  el.textContent = text
  document.body.appendChild(el)
  return {
    name: '第一章',
    status: ChapterStatus.NOT_STARTED,
    progress: 0,
    element: el,
    activities: []
  }
}

describe('ContentSearchService 高亮', () => {
  let service: ContentSearchService

  beforeEach(() => {
    document.body.innerHTML = ''
    service = new ContentSearchService()
  })

  it('高亮匹配文本时不把页面文本当成 HTML 解析', () => {
    // 页面上真实存在的文本节点，包含看起来像标签的内容
    const payload = '<img src=x onerror="window.__pwned=1">刷课'
    const chapter = chapterWithText(payload)
    service.setChapters([chapter])

    const container = document.createElement('div')
    container.textContent = payload
    document.body.appendChild(container)

    service.highlightResults([
      { chapterIndex: 0, chapterName: '第一章', matchedText: '刷课', matchType: 'chapter', element: container }
    ])

    // 关键断言：注入的尖括号必须仍然是文本，而不是变成真实节点
    expect(document.querySelector('img')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
    expect(container.textContent).toBe(payload)
  })

  it('把每个匹配都包成 mark，并保留原文顺序', () => {
    const chapter = chapterWithText('刷课刷课刷课')
    service.setChapters([chapter])

    service.highlightResults([
      { chapterIndex: 0, chapterName: '第一章', matchedText: '刷课', matchType: 'chapter', element: chapter.element! }
    ])

    const marks = chapter.element!.querySelectorAll('mark.course-search-highlight')
    expect(marks).toHaveLength(3)
    expect(chapter.element!.textContent).toBe('刷课刷课刷课')
  })

  it('关键词里的正则元字符按字面量匹配', () => {
    const chapter = chapterWithText('成本 (元) 与 a.b')
    service.setChapters([chapter])

    service.highlightResults([
      { chapterIndex: 0, chapterName: '第一章', matchedText: '(元)', matchType: 'content', element: chapter.element! }
    ])

    const marks = chapter.element!.querySelectorAll('mark.course-search-highlight')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('(元)')
  })

  it('清除高亮后恢复纯文本', () => {
    const chapter = chapterWithText('刷课内容')
    service.setChapters([chapter])
    service.highlightResults([
      { chapterIndex: 0, chapterName: '第一章', matchedText: '刷课', matchType: 'content', element: chapter.element! }
    ])
    expect(chapter.element!.querySelector('mark')).not.toBeNull()

    service.clearHighlights()
    expect(chapter.element!.querySelector('mark')).toBeNull()
    expect(chapter.element!.textContent).toBe('刷课内容')
  })
})
