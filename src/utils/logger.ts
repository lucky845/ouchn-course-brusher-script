/**
 * 统一日志管理工具
 * 支持不同级别日志、开关控制、模块分类
 */

const LOG_ENABLED = true
const LOG_LEVEL = 'debug' // debug, info, warn, error

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  enabled?: boolean
  level?: LogLevel
}

class Logger {
  private module: string
  private enabled: boolean
  private level: LogLevel

  constructor(module: string, options: LoggerOptions = {}) {
    this.module = module
    this.enabled = options.enabled ?? LOG_ENABLED
    this.level = options.level ?? LOG_LEVEL
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.level)
    const targetIndex = levels.indexOf(level)

    return targetIndex >= currentIndex
  }

  private formatMessage(message: string, ...args: any[]): string {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    const prefix = `[${timestamp}] [${this.module}]`
    return `${prefix} ${message}`
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args)
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args)
    }
  }
}

/**
 * 创建指定模块的日志实例
 */
export function createLogger(module: string, options: LoggerOptions = {}): Logger {
  return new Logger(module, options)
}

/**
 * 全局日志开关
 */
export const loggerConfig = {
  enabled: LOG_ENABLED,
  level: LOG_LEVEL as LogLevel,

  setEnabled(enabled: boolean): void {
    (globalThis as any).__LOGGER_ENABLED__ = enabled
  },

  setLevel(level: LogLevel): void {
    (globalThis as any).__LOGGER_LEVEL__ = level
  }
}

export default Logger
