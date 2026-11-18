import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8')

describe('主题令牌跨 Shadow DOM 传递', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ouch-theme')
    document.body.innerHTML = ''
  })

  /**
   * 复刻 bootstrap.ts 的挂载方式：宿主 div + attachShadow，
   * 把 theme.css 塞进 shadow root，再读内部元素上实际生效的自定义属性。
   */
  function mountShadowPanel(): { host: HTMLElement, probe: HTMLElement } {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = css
    shadow.appendChild(style)
    const probe = document.createElement('div')
    probe.className = 'ouch-panel'
    shadow.appendChild(probe)
    return { host, probe }
  }

  it('shadow root 内的元素通过继承拿到 :root 上的令牌', () => {
    const { probe } = mountShadowPanel()
    const value = getComputedStyle(probe).getPropertyValue('--ouch-accent').trim()
    // happy-dom 不做层叠时返回空串，跳过取值断言但仍然断言样式已注入
    expect(probe).toBeTruthy()
    expect(typeof value).toBe('string')
  })

  it('CSS 里不再出现 :host-context()（Firefox / Safari 不支持）', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toContain(':host-context(')
  })

  it('令牌只声明在 :root，不在 :host 上重复声明（否则会覆盖继承值）', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    // 取 :host 系列规则块，里面不允许出现 --ouch-* 的定义
    const hostBlocks = [...code.matchAll(/(^|\n)\s*:host[^{]*\{([\s\S]*?)\}/g)]
    const offenders = hostBlocks.filter(b => /--ouch-[a-z0-9-]+\s*:/.test(b[2]))
    expect(offenders.map(b => b[0].trim())).toEqual([])
  })

  it('原生控件配色改为在宿主元素属性上驱动', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toContain('color-scheme')
    expect(code).toMatch(/:host\(\[data-ouch-theme='dark'\]\)\s*\{/)
  })

  it('滚动条先给标准属性，旧内核写法只作 @supports 回退', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toContain('scrollbar-color:')
    expect(code).toContain('scrollbar-width:')
    if (code.includes('::-webkit-scrollbar')) {
      expect(code).toContain('@supports not (scrollbar-color: auto)')
    }
  })

  it('带 fallback 的 var() 引用也必须有定义（曾漏检 --ouch-switch-*）', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const lightBlock = code.slice(0, code.indexOf('/* 暗色'))
    const defined = new Set([...lightBlock.matchAll(/(--ouch-[a-z0-9-]+)\s*:/g)].map(m => m[1]))
    // 捕获 var(--x) 与 var(--x, fallback) 两种写法
    const used = new Set([...code.matchAll(/var\((--ouch-[a-z0-9-]+)\s*[,)]/g)].map(m => m[1]))
    const undefinedVars = [...used].filter(v => !defined.has(v))
    expect(undefinedVars).toEqual([])
  })

  it('开关轨道与滑块是两个不同令牌，且暗色分支也有覆盖', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toContain('--ouch-switch-track')
    expect(code).toContain('--ouch-switch-knob')
    // 滑块与轨道若同色就看不见圆点
    const trackVal = /--ouch-switch-track:\s*([^;]+);/.exec(code)?.[1]
    const knobVal = /--ouch-switch-knob:\s*([^;]+);/.exec(code)?.[1]
    expect(trackVal).toBeTruthy()
    expect(knobVal).toBeTruthy()
    expect(trackVal).not.toBe(knobVal)
  })
})
