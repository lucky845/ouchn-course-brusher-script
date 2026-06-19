import type { Settings } from '../types'
import { PanelEdge, type PanelType, SpeedMode } from '../types'
import {
  writeStorage,
  readStorage,
  readStorageString,
  writeStorageString,
  readStorageRecord,
  removeStorage
} from '../utils/storage'

export { SpeedMode }

const STORAGE_KEY = 'ouchn_brusher_settings_v2'
const ENABLED_KEY = 'ouchn_brusher_enabled'
const SESSION_KEY = 'ouchn_brusher_session' // 本次刷课：startTime + itemsDone
const PANEL_POSITIONS_KEY = 'ouchn_panel_positions' // 所有面板位置

const DEFAULT_SETTINGS: Settings = {
  videoCheckInterval: 10000,
  pageWaitTime: 5000,
  speedMode: SpeedMode.NORMAL,
  videoPlaybackRate: 1,
  antiDetection: true,
  wakeLock: true
}

export const SPEED_MODES: Record<SpeedMode, { videoCheck: number, pageWait: number }> = {
  [SpeedMode.NORMAL]: { videoCheck: 10000, pageWait: 5000 },
  [SpeedMode.FAST]: { videoCheck: 5000, pageWait: 2000 },
  [SpeedMode.STEALTH]: { videoCheck: 30000, pageWait: 15000 }
}

/** 校验读取到的对象是否符合 Settings 基本结构 */
function isValidSettings(data: unknown): data is Partial<Settings> {
  return data !== null && typeof data === 'object'
}

/** 校验读取到的对象是否符合 session 结构 */
function isValidSession(data: unknown): data is { startTime: number, itemsDone: number } {
  return (
    data !== null &&
    typeof data === 'object' &&
    typeof (data as any).startTime === 'number' &&
    typeof (data as any).itemsDone === 'number'
  )
}

/** 校验读取到的对象是否符合面板位置结构 */
function isValidPanelPos(data: unknown): data is { y: number, edge: PanelEdge } {
  if (data === null || typeof data !== 'object') return false
  const d = data as any
  return (
    typeof d.y === 'number' &&
    (d.edge === PanelEdge.LEFT || d.edge === PanelEdge.RIGHT || d.edge === PanelEdge.NONE)
  )
}

export class SettingsStoreService {
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private listeners = new Set<(settings: Settings)=> void>()

  constructor() {
    this.settings = this.load()
  }

  load(): Settings {
    const parsed = readStorage<Partial<Settings>>(STORAGE_KEY, {}, isValidSettings)
    return { ...DEFAULT_SETTINGS, ...parsed }
  }

  save(newSettings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...newSettings }
    writeStorage(STORAGE_KEY, this.settings)
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.settings })
      } catch (e) {
        console.warn('Listener error in settings save', e)
      }
    })
  }

  get(): Settings {
    return { ...this.settings }
  }

  isEnabled(): boolean {
    return readStorageString(ENABLED_KEY) !== 'false'
  }

  setEnabled(enabled: boolean): void {
    writeStorageString(ENABLED_KEY, enabled ? 'true' : 'false')
  }

  subscribe(listener: (settings: Settings)=> void): ()=> void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setSpeedMode(mode: SpeedMode): void {
    const config = SPEED_MODES[mode]
    if (!config) {
      console.warn(`Unknown speed mode: ${mode}`)
      return
    }
    this.save({
      speedMode: mode,
      videoCheckInterval: config.videoCheck,
      pageWaitTime: config.pageWait
    })
  }

  // ===== 本次刷课 session 存储（跨页面跳转保持） =====
  sessionReset(): void {
    writeStorage(SESSION_KEY, { startTime: Date.now(), itemsDone: 0 })
  }

  sessionGet(): { startTime: number, itemsDone: number } {
    const raw = readStorage<{ startTime: number, itemsDone: number }>(
      SESSION_KEY,
      { startTime: 0, itemsDone: 0 },
      isValidSession
    )
    return {
      startTime: Number(raw.startTime) || 0,
      itemsDone: Number(raw.itemsDone) || 0
    }
  }

  sessionIncrementItems(): number {
    const cur = this.sessionGet()
    const next = Math.max(0, cur.itemsDone) + 1
    const startTime = cur.startTime > 0 ? cur.startTime : Date.now()
    writeStorage(SESSION_KEY, { startTime, itemsDone: next })
    return next
  }

  sessionSetItems(count: number): void {
    const cur = this.sessionGet()
    const startTime = cur.startTime > 0 ? cur.startTime : Date.now()
    writeStorage(SESSION_KEY, { startTime, itemsDone: Math.max(0, count) })
  }

  sessionClear(): void {
    removeStorage(SESSION_KEY)
  }

  // ===== 面板位置存储（只记忆边缘吸附状态和Y轴位置，X轴动态计算） =====
  savePanelPosition(panelType: PanelType, y: number, edge: PanelEdge): void {
    const positions = readStorageRecord<{ y: number, edge: PanelEdge }>(PANEL_POSITIONS_KEY)
    positions[panelType] = { y, edge }
    writeStorage(PANEL_POSITIONS_KEY, positions)
  }

  getPanelPosition(
    panelType: PanelType,
    btnWidth: number = 56,
    margin: number = 10
  ): { x: number, y: number, edge: PanelEdge } {
    // 安全检查：确保 window 对象存在
    const hasWindow = typeof window !== 'undefined'

    // 从存储读取位置
    const positions = readStorageRecord<unknown>(PANEL_POSITIONS_KEY)
    const pos = positions[panelType]

    // 如果有有效的存储位置，使用存储的值
    if (isValidPanelPos(pos)) {
      const edge: PanelEdge = pos.edge === PanelEdge.NONE ? PanelEdge.RIGHT : pos.edge
      const y = Number(pos.y) || 100

      // 计算 X 坐标
      let x: number
      if (hasWindow) {
        const maxX = window.innerWidth - btnWidth - margin
        x = edge === PanelEdge.LEFT ? margin : Math.max(margin, maxX)
      } else {
        x = 100
      }

      // 确保 Y 在可视范围内
      const maxY = hasWindow ? window.innerHeight - btnWidth - margin : 500
      const clampedY = Math.max(margin, Math.min(y, maxY))

      return { x, y: clampedY, edge }
    }

    // 默认位置：右侧贴边，垂直居中偏上
    const defaultY = 100
    const defaultX = hasWindow
      ? Math.max(margin, window.innerWidth - btnWidth - margin)
      : 100

    return {
      x: defaultX,
      y: defaultY,
      edge: PanelEdge.RIGHT
    }
  }
}

export const settingsStoreService = new SettingsStoreService()

export default settingsStoreService
