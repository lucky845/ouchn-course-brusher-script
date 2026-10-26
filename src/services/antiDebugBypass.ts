/**
 * 平台反调试/DevTools 限制绕过服务
 *
 * 新版平台在页面中注入了反调试逻辑（debugger 陷阱、DevTools 检测、
 * F12/右键/快捷键拦截等），导致脚本调试与运行受影响。
 * 本模块在脚本最早期执行，尽力中和这些限制，保证刷课脚本正常工作。
 */

export function installAntiDebugBypass(): void {
  try {
    if (typeof window === 'undefined') return

    const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window)
    const nativeSetTimeout: typeof window.setTimeout = window.setTimeout.bind(window)

    const containsDebugger = (fn: unknown): boolean => {
      try {
        const src = typeof fn === 'function' ? fn.toString() : String(fn)
        return /debugger\b/.test(src)
      } catch {
        return false
      }
    }

    // 中和 setInterval/setTimeout 中的 debugger 陷阱
    const patchedSetInterval = (handler: any, timeout?: number, ...args: any[]): any => {
      if (containsDebugger(handler)) {
        return nativeSetInterval(() => {}, 1 << 30)
      }
      return nativeSetInterval(handler, timeout, ...args)
    }
    const patchedSetTimeout = (handler: any, timeout?: number, ...args: any[]): any => {
      if (containsDebugger(handler)) {
        return nativeSetTimeout(() => {}, 0)
      }
      return nativeSetTimeout(handler, timeout, ...args)
    }

    try {
      Object.defineProperty(window, 'setInterval', { value: patchedSetInterval, writable: true, configurable: true })
      Object.defineProperty(window, 'setTimeout', { value: patchedSetTimeout, writable: true, configurable: true })
    } catch {
      (window as any).setInterval = patchedSetInterval
      (window as any).setTimeout = patchedSetTimeout
    }

    // 拦截 DevTools 检测常用的尺寸差异：伪装 window 尺寸
    try {
      const origOuterWidth = Object.getOwnPropertyDescriptor(window, 'outerWidth')
      const origOuterHeight = Object.getOwnPropertyDescriptor(window, 'outerHeight')
      // 仅在可写时覆盖 getter，避免破坏
      if (!origOuterWidth || origOuterWidth.configurable) {
        Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth, configurable: true })
      }
      if (!origOuterHeight || origOuterHeight.configurable) {
        Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight, configurable: true })
      }
    } catch {
    }

    // 捕获阶段拦截 F12 / Ctrl+Shift+I / 右键菜单限制
    const stopKey = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase()
      const isDevtoolsShortcut =
        key === 'f12' ||
        (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (e.metaKey && e.altKey && key === 'i')
      if (isDevtoolsShortcut) {
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener('keydown', stopKey, true)

    const stopContext = (e: MouseEvent) => {
      e.stopImmediatePropagation()
    }
    document.addEventListener('contextmenu', stopContext, true)

    // 中和 Function 构造器注入 debugger 的场景
    try {
      const NativeFunction = (window as any).Function
      const patchedFunction = new Proxy(NativeFunction, {
        construct(target, args) {
          const src = args && args.length ? String(args[args.length - 1]) : ''
          if (/debugger\b/.test(src)) {
            args[args.length - 1] = src.replace(/debugger\b/g, '')
          }
          return new target(...args)
        },
        apply(target, thisArg, args) {
          const src = args && args.length ? String(args[args.length - 1]) : ''
          if (/debugger\b/.test(src)) {
            args[args.length - 1] = src.replace(/debugger\b/g, '')
          }
          return target.apply(thisArg, args)
        }
      })
      ;(window as any).Function = patchedFunction
    } catch {
    }
  } catch {
    // 静默失败，不影响脚本主体
  }
}

export default installAntiDebugBypass
