import type { Settings, PanelEdge, PanelType } from '../types'
import { SpeedMode } from '../types'

export { SpeedMode }

const STORAGE_KEY = 'ouchn_brusher_settings_v2'
const ENABLED_KEY = 'ouchn_brusher_enabled'
const POSITION_KEY = 'ouchn_brusher_position'
const SESSION_KEY = 'ouchn_brusher_session' // 本次刷课：startTime + itemsDone
const PANEL_POSITIONS_KEY = 'ouchn_panel_positions' // 所有面板位置

const DEFAULT_SETTINGS: Settings = {
  videoCheckInterval: 10000,
  pageWaitTime: 5000,
  speedMode: SpeedMode.NORMAL,
  videoPlaybackRate: 1,
  antiDetection: true,
  wakeLock: true,
}

export const SPEED_MODES: Record<SpeedMode, { videoCheck: number; pageWait: number }> = {
  [SpeedMode.NORMAL]: { videoCheck: 10000, pageWait: 5000 },
  [SpeedMode.FAST]: { videoCheck: 5000, pageWait: 2000 },
  [SpeedMode.STEALTH]: { videoCheck: 30000, pageWait: 15000 },
}

export class SettingsStoreService {
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private listeners: Set<(settings: Settings) => void> = new Set()

  constructor() {
    this.settings = this.load()
  }

  load(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { ...DEFAULT_SETTINGS }
      }
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage', e)
    }
    return { ...DEFAULT_SETTINGS }
  }

  save(newSettings: Partial<Settings>): void {
    try {
      this.settings = { ...this.settings, ...newSettings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
      this.listeners.forEach((listener) => {
        try {
          listener({ ...this.settings })
        } catch (e) {
          console.warn('Listener error in settings save', e)
        }
      })
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e)
    }
  }

  get(): Settings {
    return { ...this.settings }
  }

  isEnabled(): boolean {
    try {
      const value = localStorage.getItem(ENABLED_KEY)
      return value !== 'false'
    } catch (e) {
      console.warn('Failed to read enabled key', e)
      return true
    }
  }

  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')
    } catch (e) {
      console.warn('Failed to save enabled key', e)
    }
  }

  setPosition(x: number, y: number, edge: string): void {
    try {
      localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({ x, y, edge })
      )
    } catch (e) {
      console.warn('Failed to save position', e)
    }
  }

  getPosition(): { x: number; y: number; edge?: PanelEdge } {
    try {
      const raw = localStorage.getItem(POSITION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed) {
          const edgeValue = parsed.edge
          const edge: PanelEdge | undefined = 
            (edgeValue === 'left' || edgeValue === 'right' || edgeValue === 'none') 
              ? edgeValue as PanelEdge 
              : undefined
          return {
            x: Number(parsed.x) || 0,
            y: Number(parsed.y) || 0,
            edge,
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read position', e)
    }
    return {
      x: typeof window !== 'undefined' ? window.innerWidth - 60 : 100,
      y: 100,
    }
  }

  subscribe(listener: (settings: Settings) => void): () => void {
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
      pageWaitTime: config.pageWait,
    })
  }

  // ===== 本次刷课 session 存储（跨页面跳转保持） =====
  sessionReset(): void {
    try {
      const now = Date.now()
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ startTime: now, itemsDone: 0 })
      )
    } catch (e) {
      console.warn('Failed to reset session', e)
    }
  }

  sessionGet(): { startTime: number; itemsDone: number } {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return { startTime: 0, itemsDone: 0 }
      const parsed = JSON.parse(raw)
      return {
        startTime: Number(parsed.startTime) || 0,
        itemsDone: Number(parsed.itemsDone) || 0,
      }
    } catch (e) {
      console.warn('Failed to read session', e)
      return { startTime: 0, itemsDone: 0 }
    }
  }

  sessionIncrementItems(): number {
    try {
      const cur = this.sessionGet()
      const next = Math.max(0, cur.itemsDone) + 1
      const startTime = cur.startTime > 0 ? cur.startTime : Date.now()
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ startTime, itemsDone: next })
      )
      return next
    } catch (e) {
      console.warn('Failed to increment session items', e)
      return 0
    }
  }

  sessionSetItems(count: number): void {
    try {
      const cur = this.sessionGet()
      const startTime = cur.startTime > 0 ? cur.startTime : Date.now()
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ startTime, itemsDone: Math.max(0, count) })
      )
    } catch (e) {
      console.warn('Failed to set session items', e)
    }
  }

  sessionClear(): void {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch (e) {
      console.warn('Failed to clear session', e)
    }
  }

  // ===== 面板位置存储（支持多个面板独立记忆） =====
  savePanelPosition(panelType: PanelType, x: number, y: number, edge?: PanelEdge): void {
    try {
      const raw = localStorage.getItem(PANEL_POSITIONS_KEY)
      const positions: Record<string, { x: number; y: number; edge?: PanelEdge }> = raw ? JSON.parse(raw) : {}
      positions[panelType] = { x, y, edge }
      localStorage.setItem(PANEL_POSITIONS_KEY, JSON.stringify(positions))
    } catch (e) {
      console.warn('Failed to save panel position', e)
    }
  }

  getPanelPosition(panelType: PanelType): { x: number; y: number; edge?: PanelEdge } {
    try {
      const raw = localStorage.getItem(PANEL_POSITIONS_KEY)
      if (raw) {
        const positions = JSON.parse(raw)
        const pos = positions[panelType]
        if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
          const edgeValue = pos.edge
          const edge: PanelEdge | undefined = 
            (edgeValue === 'left' || edgeValue === 'right' || edgeValue === 'none') 
              ? edgeValue as PanelEdge 
              : undefined
          return {
            x: Number(pos.x) || 0,
            y: Number(pos.y) || 0,
            edge,
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read panel position', e)
    }
    // 返回默认位置
    return {
      x: typeof window !== 'undefined' ? window.innerWidth - 60 : 100,
      y: 100,
    }
  }
}

export const settingsStoreService = new SettingsStoreService()

export default settingsStoreService