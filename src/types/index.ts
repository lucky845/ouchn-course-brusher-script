export type SpeedMode = 'normal' | 'fast' | 'stealth'

export type QuestionType =
  | '单选题'
  | '多选题'
  | '判断题'
  | '简答题'
  | '完形填空'
  | '匹配题'
  | '排序题'
  | '拖放匹配'
  | '数字题'
  | '计算题'
  | '随机题'
  | '未知题型'

export interface Question {
  number: number
  text: string
  type: QuestionType
  options: string[]
  answer?: string
  rawHtml?: string
}

export interface Settings {
  videoCheckInterval: number
  pageWaitTime: number
  speedMode: SpeedMode
  videoPlaybackRate: number
  antiDetection: boolean
  wakeLock: boolean
}

export interface SessionStats {
  startTime: number
  itemsCompleted: number
}

export interface PanelPosition {
  x: number
  y: number
  edge?: 'left' | 'right' | 'none'
}

export interface ProgressStats {
  total: number
  current: number
  percentage: number
  sessionTime: number
  itemsCompleted: number
}

export interface ExtractResult {
  success: boolean
  count: number
  message: string
  questions?: Question[]
}

export interface VideoState {
  video: HTMLVideoElement | null
  isPlaying: boolean
  playbackRate: number
  checkInterval: number | null
}

export interface WakeLockState {
  lock: any
  enabled: boolean
  reAcquireTimer: number | null
}
