import { describe, it, expect, beforeEach } from 'vitest'
import { parseQueryParams, getModuleIdFromUrl, isQuizPage, getCourseId } from './url'

// happy-dom 提供的 window.happyDOM.setURL 扩展，仅测试文件使用
declare global {
  interface Window {
    happyDOM?: { setURL?: (url: string) => void }
  }
}

describe('parseQueryParams', () => {
  it('解析标准查询参数', () => {
    expect(parseQueryParams('https://a.com/page.php?id=123&lang=zh')).toEqual({ id: '123', lang: 'zh' })
  })

  it('URL 内嵌于完整 href 时正确解析', () => {
    expect(parseQueryParams('https://a.com/path?x=1&y=2#hash')).toEqual({ x: '1', y: '2' })
  })

  it('解析失败时回退手动解析', () => {
    expect(parseQueryParams('abc?foo=bar&baz=1')).toEqual({ foo: 'bar', baz: '1' })
  })

  it('无查询参数时返回空对象', () => {
    expect(parseQueryParams('https://a.com/page')).toEqual({})
  })
})

describe('getModuleIdFromUrl', () => {
  it('从活动链接提取 id', () => {
    expect(getModuleIdFromUrl('https://moodle.syxy.ouchn.cn/mod/quiz/view.php?id=1764')).toBe('1764')
  })

  it('无 id 时用正则兜底', () => {
    expect(getModuleIdFromUrl('https://moodle.syxy.ouchn.cn/mod/resource/view.php?id=99')).toBe('99')
  })

  it('无法解析返回空字符串', () => {
    expect(getModuleIdFromUrl('https://a.com/no-id')).toBe('')
    expect(getModuleIdFromUrl('')).toBe('')
  })
})

describe('isQuizPage', () => {
  beforeEach(() => {
    // 重置为一个干净的非测验地址
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/mod/page/view.php?id=1')
    document.body.innerHTML = ''
  })

  it('/mod/quiz/ 路径判定为测验页', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/mod/quiz/view.php?id=10')
    expect(isQuizPage()).toBe(true)
  })

  it('attempt 页判定为测验页', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/mod/quiz/attempt.php?attempt=5')
    expect(isQuizPage()).toBe(true)
  })

  it('存在 .que 元素判定为测验页', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/course/view.php?id=1')
    document.body.innerHTML = '<div class="que">题目</div>'
    expect(isQuizPage()).toBe(true)
  })

  it('普通页面判定为非测验页', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/mod/page/view.php?id=1')
    expect(isQuizPage()).toBe(false)
  })
})

describe('getCourseId', () => {
  it('从课程详情 URL 提取课程 ID', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/course/view.php?id=190')
    expect(getCourseId()).toBe('190')
  })

  it('非课程页返回 null', () => {
    window.happyDOM?.setURL?.('https://moodle.syxy.ouchn.cn/mod/page/view.php?id=1')
    expect(getCourseId()).toBeNull()
  })
})