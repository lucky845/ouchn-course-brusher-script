/**
 * localStorage 安全读写工具
 * 统一处理 try/catch 样板代码、类型校验和默认值，减少重复
 */

/** 写入任意 JSON-serializable 值到 localStorage */
export function writeStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.warn(`[storage] Failed to write localStorage key "${key}"`, e)
    return false
  }
}

/** 读取 localStorage 值，解析为 JSON 对象 */
export function readStorage<T>(
  key: string,
  fallback: T,
  validator?: (data: unknown)=> data is T
): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (validator) {
      return validator(parsed) ? parsed : fallback
    }
    return parsed as T
  } catch (e) {
    console.warn(`[storage] Failed to read localStorage key "${key}"`, e)
    return fallback
  }
}

/** 读取 JSON 对象，允许返回 undefined（无默认值） */
export function readStorageOptional<T>(
  key: string,
  validator?: (data: unknown)=> data is T
): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (validator) {
      return validator(parsed) ? parsed : undefined
    }
    return parsed as T
  } catch (e) {
    console.warn(`[storage] Failed to read localStorage key "${key}"`, e)
    return undefined
  }
}

/** 从 localStorage 读取 Record 对象（用于面板位置等聚合存储） */
export function readStorageRecord<T>(
  key: string
): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, T>
    }
  } catch (e) {
    console.warn(`[storage] Failed to read localStorage record "${key}"`, e)
  }
  return {}
}

/** 移除某一 localStorage 项 */
export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`[storage] Failed to remove localStorage key "${key}"`, e)
  }
}

/** 读取字符串值（用于 "true"/"false" 之类的简单标记） */
export function readStorageString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.warn(`[storage] Failed to read localStorage string "${key}"`, e)
    return null
  }
}

/** 写入字符串值（不做 JSON 序列化） */
export function writeStorageString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn(`[storage] Failed to write localStorage string "${key}"`, e)
  }
}
