export enum SpeedMode {
  NORMAL = 'normal',
  FAST = 'fast',
  STEALTH = 'stealth',
}

export enum PanelEdge {
  LEFT = 'left',
  RIGHT = 'right',
  NONE = 'none',
}

export const PLAYBACK_RATES = {
  NORMAL: 1,
  FAST_1_5: 1.5,
  FAST_2: 2,
  FAST_3: 3,
} as const

export type PlaybackRate = typeof PLAYBACK_RATES[keyof typeof PLAYBACK_RATES]

export enum QuestionType {
  SINGLE_CHOICE = '单选题',
  MULTIPLE_CHOICE = '多选题',
  TRUE_FALSE = '判断题',
  SHORT_ANSWER = '简答题',
  CLOZE = '完形填空',
  MATCHING = '匹配题',
  ORDERING = '排序题',
  DRAG_DROP = '拖放匹配',
  NUMERICAL = '数字题',
  CALCULATION = '计算题',
  RANDOM = '随机题',
  UNKNOWN = '未知题型',
  ESSAY = '论述题',
  FILL_BLANK = '填空题',
  COMPREHENSIVE = '综合题',
}

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
  edge?: PanelEdge
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