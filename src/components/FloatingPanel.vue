<template>
  <div
    class="ouchn-brusher"
    :class="{ dragging: isDragging, snapping: isSnapping }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <!-- 悬浮按钮 (可拖拽) -->
    <div
      class="float-btn ouch-float-btn"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      aria-label="刷课助手"
      @mousedown.prevent="onDragStart"
      @click.stop="onBtnClick"
      @keydown.enter.prevent="onBtnClick"
    >
      <span class="btn-emoji">🎓</span>
    </div>

    <!-- 展开面板 -->
    <div
      v-show="isOpen"
      class="panel ouch-panel"
      role="dialog"
      aria-label="刷课助手"
      @click.stop
    >
      <!-- header -->
      <div class="panel-header ouch-titlebar">
        <span class="panel-title">刷课助手 v2.0</span>
        <button class="close-btn ouch-btn-close" aria-label="关闭" @click="isOpen = false">✕</button>
      </div>

      <!-- body -->
      <div class="panel-body ouch-panel-body">
        <!-- 进度卡片 -->
        <div class="progress-card ouch-card">
          <div class="progress-top">
            <span class="progress-count">{{ stats.current }} / {{ stats.total }}</span>
            <span class="progress-percent">{{ stats.percentage }}%</span>
          </div>
          <div class="progress-bar ouch-progress-track">
            <div class="progress-fill ouch-progress-fill" :style="{ width: stats.percentage + '%' }"></div>
          </div>
          <div class="progress-info">
            <span>📚 本次 {{ stats.itemsDone }} 个</span>
            <span v-if="isRunning || stats.elapsedTime.length > 0"> ⏱ {{ stats.elapsedTime }}</span>
            <span v-if="isRunning && currentAction.length > 0"> · {{ currentAction }}</span>
          </div>
        </div>

        <!-- 速度模式 -->
        <div class="section-card ouch-card">
          <div class="section-title ouch-section-title">⚡ 速度模式</div>
          <div class="seg-group ouch-seg-group">
            <button
              v-for="opt in speedModeOptions"
              :key="opt.value"
              class="seg-btn ouch-seg-btn"
              :class="{ active: speedMode === opt.value }"
              @click="changeSpeedMode(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 播放速率 (仅快速模式) -->
        <div v-if="speedMode === SpeedMode.FAST" class="section-card ouch-card">
          <div class="section-title ouch-section-title">🎬 播放速率</div>
          <div class="seg-group ouch-seg-group">
            <button
              v-for="r in playbackRateOptions"
              :key="r"
              class="seg-btn ouch-seg-btn"
              :class="{ active: playbackRate === r }"
              @click="changePlaybackRate(r)"
            >
              {{ r }}x
            </button>
          </div>
        </div>

        <!-- 开关 -->
        <div class="section-card ouch-card">
          <div class="toggle-row">
            <span>🔇 静音刷课</span>
            <label class="switch ouch-switch">
              <input v-model="mutedOn" type="checkbox" @change="onToggleMuted" />
              <span class="slider ouch-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span>🔒 防息屏</span>
            <label class="switch ouch-switch">
              <input v-model="wakeLockOn" type="checkbox" @change="onToggleWakeLock" />
              <span class="slider ouch-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span>🛡️ 防检测</span>
            <label class="switch ouch-switch">
              <input v-model="antiDetectionOn" type="checkbox" @change="onToggleAntiDetection" />
              <span class="slider ouch-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span>▶️ 启用脚本</span>
            <label class="switch ouch-switch">
              <input type="checkbox" :checked="isRunning" @change="onToggleRunning" />
              <span class="slider ouch-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span>🎨 面板主题</span>
            <div class="seg-group ouch-seg-group theme-seg">
              <button
                v-for="opt in themeOptions"
                :key="opt.value"
                class="seg-btn ouch-seg-btn"
                :class="{ active: themeMode === opt.value }"
                @click="changeTheme(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 状态 -->
        <div class="status-area ouch-status" :class="{ running: isRunning }">
          <span>{{ statusText }}</span>
        </div>

        <!-- 开始/停止 -->
        <div class="action-row">
          <button
            class="action-btn start ouch-btn"
            :disabled="isRunning"
            @click="() => startBrushing()"
          >
            ▶ 开始
          </button>
          <button
            class="action-btn stop ouch-btn ouch-btn-danger"
            :disabled="!isRunning"
            @click="stopBrushing"
          >
            ⏹ 停止
          </button>
        </div>

        <!-- 调试日志 -->
        <div v-if="logs.length > 0" class="log-area ouch-log">
          <div
            v-for="(log, i) in logs.slice(-8)"
            :key="i"
            class="log-line ouch-log-line"
          >
            [{{ log.time }}] {{ log.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { settingsStoreService } from '../services/settingsStore'
import { SpeedMode, PanelType, PanelEdge, type ThemeMode } from '../types'
import { videoManagerService } from '../services/videoManager'
import { wakeLockService } from '../services/wakeLock'
import { antiDetectionService } from '../services/antiDetection'
import { sidebarNavigatorService } from '../services/sidebarNavigator'
import { courseProgressStore } from '../services/courseProgressStore'
import { recordQuizSkip, resetQuizSkipGuard } from '../services/quizSkipGuard'
import { useDraggablePanel } from '../composables/useDraggablePanel'
import { getPanelConfig } from '../utils/panel'
import { getCourseIdFromPage, getModuleIdFromUrl, isQuizPage } from '../utils/url'
import { formatDuration } from '../utils/time'
import { showUserNotice } from '../utils/userNotice'

// ===== 面板尺寸（由 utils/panel 统一配置） =====
const { width: BTN_WIDTH, height: BTN_HEIGHT, margin: MARGIN, dragThreshold: DRAG_THRESHOLD } = getPanelConfig(PanelType.FLOATING)

// ===== 拖拽（由 composable 统一管理） =====
const {
  position,
  isSnapping,
  isDragging,
  onDragStart,
  didDragMove,
  resetDragMove,
  snapEdge
} = useDraggablePanel(PanelType.FLOATING, BTN_WIDTH, BTN_HEIGHT, MARGIN, DRAG_THRESHOLD)
// 保留本地引用，供 onMounted 中 edge 判断逻辑使用（无实际重定义冲突）

// ===== 状态 =====
const isOpen = ref(false)
const isRunning = ref(false)
const speedMode = ref<SpeedMode>(SpeedMode.NORMAL)
const playbackRate = ref(1.5)
const wakeLockOn = ref(true)
const antiDetectionOn = ref(true)
const mutedOn = ref(true)
const themeMode = ref<ThemeMode>('auto')
const statusText = ref('等待开始...')
const currentAction = ref('')

const stats = reactive({
  total: 0,
  current: 0,
  percentage: 0,
  itemsDone: 0,
  elapsedTime: '' // 本次刷课时间显示，如 "12分30秒"
})

const logs = reactive<Array<{ time: string, text: string }>>([])

// 定时器
let pageTimer: number | null = null
let refreshTimer: number | null = null
let videoCheckTimer: number | null = null
let timeTimer: number | null = null // 刷新"本次刷课时间"显示

// ===== 视频卡住兜底 =====
// 记录最近一次检测到视频"正在播放"的时间；超过 idleTimeoutMs 无播放进展则强制跳转，
// 避免平台锁死 play() 导致脚本永远卡在视频页。
let videoProgressAt = 0
const VIDEO_IDLE_TIMEOUT_MS = 90 * 1000 // 视频卡住 90 秒视为异常

// ===== 选项 =====
const speedModeOptions = [
  { value: SpeedMode.NORMAL, label: '🐢 正常' },
  { value: SpeedMode.FAST, label: '🚀 快速' },
  { value: SpeedMode.STEALTH, label: '🥷 低调' }
]
const playbackRateOptions = [1, 1.5, 2, 3]
const themeOptions: Array<{ value: ThemeMode, label: string }> = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

// ===== 工具 =====
const MAX_LOG_LINES = 50

function log(text: string): void {
  const d = new Date()
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  // 长时间刷课会累积上千条日志，只保留最近若干条
  if (logs.length >= MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES + 1)
  logs.push({ time: t, text })
  console.log('[刷课脚本]', text)
}

// 从 session 中读取 startTime 并刷新时间显示
function refreshElapsedTime(): void {
  const session = settingsStoreService.sessionGet()
  if (session.startTime > 0) {
    stats.elapsedTime = formatDuration(Date.now() - session.startTime)
  } else {
    stats.elapsedTime = ''
  }
}

function startElapsedTimer(): void {
  stopElapsedTimer()
  refreshElapsedTime()
  timeTimer = window.setInterval(() => {
    refreshElapsedTime()
  }, 1000)
}

function stopElapsedTimer(): void {
  if (timeTimer !== null) {
    clearInterval(timeTimer)
    timeTimer = null
  }
}

function clearAllTimers(): void {
  if (pageTimer !== null) {
    clearTimeout(pageTimer)
    pageTimer = null
  }
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (videoCheckTimer !== null) {
    clearInterval(videoCheckTimer)
    videoCheckTimer = null
  }
  stopElapsedTimer()
}

// ===== 进度刷新 =====
function refreshStats(): void {
  try {
    const items = sidebarNavigatorService.getAllItems()
    const curIndex = sidebarNavigatorService.findCurrentIndex(items)

    stats.total = items.length
    stats.current = curIndex >= 0 ? curIndex + 1 : 0
    stats.percentage = items.length > 0 ? Math.round((stats.current / items.length) * 100) : 0
  } catch (e) {
    console.warn('[刷课脚本] 进度刷新失败', e)
  }
}

// ===== 点击行为 =====
function onBtnClick(): void {
  // 只在非拖拽的纯点击行为下切换面板
  if (!didDragMove()) {
    isOpen.value = !isOpen.value
  }
  resetDragMove()
}

// ===== 设置切换 =====
function changeSpeedMode(mode: SpeedMode): void {
  speedMode.value = mode
  settingsStoreService.setSpeedMode(mode)
  const config = settingsStoreService.get()
  log(`切换速度模式: ${mode} (页面等待 ${config.pageWaitTime}ms)`)

  // 如果视频存在，应用播放速率
  if (speedMode.value === SpeedMode.FAST) {
    const v = videoManagerService.find()
    if (v) {
      videoManagerService.setPlaybackRate(playbackRate.value)
      log(`应用播放速率: ${playbackRate.value}x`)
    }
  }
}

function changePlaybackRate(rate: number): void {
  playbackRate.value = rate
  settingsStoreService.save({ videoPlaybackRate: rate })
  log(`设置播放速率: ${rate}x`)

  const v = videoManagerService.find()
  if (v) {
    videoManagerService.setPlaybackRate(rate)
  }
}

function onToggleWakeLock(): void {
  settingsStoreService.save({ wakeLock: wakeLockOn.value })
  if (wakeLockOn.value) {
    wakeLockService.acquire(false).then(() => {
      log('防息屏已开启')
    }).catch(() => {
      log('防息屏开启失败（继续使用兼容模式）')
    })
  } else {
    wakeLockService.release()
    log('防息屏已关闭')
  }
}

function onToggleAntiDetection(): void {
  settingsStoreService.save({ antiDetection: antiDetectionOn.value })
  if (antiDetectionOn.value) {
    antiDetectionService.start()
    log('防检测已开启')
  } else {
    antiDetectionService.stop()
    log('防检测已关闭')
  }
}

function onToggleMuted(): void {
  settingsStoreService.save({ muted: mutedOn.value })
  log(mutedOn.value ? '静音刷课已开启' : '静音刷课已关闭')
  // 同步静音偏好到视频服务，后续自动播放不再强制静音
  videoManagerService.setMutedPreference(mutedOn.value)
  if (isRunning.value) {
    const v = videoManagerService.find()
    if (v) {
      v.muted = mutedOn.value
    }
  }
}

/** 切换主题：settingsStore.save 内部会调用 applyTheme，写入 <html data-ouch-theme> */
function changeTheme(mode: ThemeMode): void {
  themeMode.value = mode
  settingsStoreService.save({ theme: mode })
  log(`面板主题：${themeOptions.find(o => o.value === mode)?.label ?? mode}`)
}

function onToggleRunning(): void {
  if (isRunning.value) {
    stopBrushing()
  } else {
    startBrushing()
  }
}

// ===== 核心刷课逻辑 =====
function startBrushing(opts?: { resetSession?: boolean }): void {
  if (isRunning.value) return

  const shouldReset = opts && typeof opts.resetSession === 'boolean' ? opts.resetSession : true

  isRunning.value = true
  settingsStoreService.setEnabled(true)
  statusText.value = '脚本运行中...'
  currentAction.value = '初始化'

  if (shouldReset) {
    // 手动点击"开始"时认为是全新会话，重置计数
    settingsStoreService.sessionReset()
    resetQuizSkipGuard()
    stats.itemsDone = 0
  } else {
    // 自动恢复时，使用已存在的 session 继续计数
    const session = settingsStoreService.sessionGet()
    stats.itemsDone = session.itemsDone
  }

  log('=== 开始刷课 ===')

  // 初始化课程进度共享状态
  // mod 页 URL 的 id 是模块 ID，必须从页面内容解析课程 ID，否则进度无法记录
  const courseId = getCourseIdFromPage()
  const courseName = document.title.replace(/\s*[-_].*$/, '').trim() || '未知课程'
  const items = sidebarNavigatorService.getAllItems()
  if (courseId) {
    courseProgressStore.startBrushing(courseId, courseName, items.length)
  }

  // 启动辅助功能
  if (wakeLockOn.value) {
    wakeLockService.acquire(false).catch(() => {})
  }
  if (antiDetectionOn.value) {
    antiDetectionService.start()
  }

  refreshStats()

  // 启动"本次刷课时间"定时器
  startElapsedTimer()

  // 定期刷新进度
  refreshTimer = window.setInterval(() => {
    refreshStats()
  }, 5000)

  // 开始处理当前页面
  processCurrentPage()
}

function stopBrushing(): void {
  isRunning.value = false
  settingsStoreService.setEnabled(false)
  statusText.value = '脚本已停止'
  currentAction.value = ''
  clearAllTimers()
  videoManagerService.cleanup()
  antiDetectionService.stop()
  wakeLockService.release()
  // 停止刷课时清空 session（下次"开始"重新计数）
  settingsStoreService.sessionClear()
  stats.elapsedTime = ''

  // 停止课程进度共享状态
  courseProgressStore.stopBrushing()

  log('=== 停止刷课 ===')
}

function processCurrentPage(): void {
  if (!isRunning.value) return

  try {
    const url = window.location.href
    log(`处理页面: ${url.substring(0, 60)}...`)

    // 测验/答题页：刷课模式下跳过（提示后自动进入下一项）
    if (isQuizPage()) {
      // 防死循环：记录本次测验跳过
      const quizModuleId = getModuleIdFromUrl(url)
      if (recordQuizSkip(quizModuleId)) {
        log('→ 检测到连续跳过同一测验多次，可能陷入死循环，停止刷课')
        currentAction.value = '连续测验疑似死循环，已停止'
        showUserNotice(
          '连续多次跳转后仍未离开测验，疑似定位异常。已自动停止刷课，请检查课程内容。',
          { type: 'error', duration: 6000 }
        )
        stopBrushing()
        return
      }

      currentAction.value = '检测到测验，将跳过'
      const skipWaitMs = 4500
      log(`→ 检测到测验/答题页，刷课模式下 ${skipWaitMs}ms 后自动跳过`)
      showUserNotice(
        '检测到刷课模式正在运行，如需正常做题请先停止刷课。当前测验将自动跳过，继续下一个项目。',
        { type: 'warn', duration: skipWaitMs }
      )
      pageTimer = window.setTimeout(() => {
        if (isRunning.value) {
          log('→ 测验跳过，跳转到下一个项目')
          goToNextItem()
        }
      }, skipWaitMs)
      return
    }

    // 获取当前活动信息并更新进度
    const items = sidebarNavigatorService.getAllItems()
    const curIndex = sidebarNavigatorService.findCurrentIndex(items)
    if (curIndex >= 0 && items[curIndex]) {
      const currentItem = items[curIndex]
      const currentItemName = currentItem.textContent?.trim() || '(未命名)'
      const curItemId = getModuleIdFromUrl(currentItem.href) || currentItem.href
      courseProgressStore.updateCurrentActivity(curItemId, currentItemName, currentItem.href)
    }

    // 课程主页 / 目录页
    if (url.indexOf('/course/view.php') !== -1 || url.indexOf('/course/index') !== -1) {
      currentAction.value = '读取课程目录'
      log('→ 检测到课程主页，查找学习项目...')

      const coursePageItems = sidebarNavigatorService.getItemsFromCoursePage()
      if (coursePageItems && coursePageItems.length > 0) {
        log(`→ 找到 ${coursePageItems.length} 个项目，跳转到第一个`)
        stats.itemsDone = 0
        setTimeout(() => {
          if (isRunning.value) {
            window.location.href = coursePageItems[0].href
          }
        }, 1000)
        return
      }

      // 尝试从侧边栏找
      const sidebar = sidebarNavigatorService.findSidebar()
      if (sidebar) {
        const sidebarItems = sidebarNavigatorService.getItems(sidebar)
        if (sidebarItems.length > 0) {
          log(`→ 从侧边栏找到 ${sidebarItems.length} 个项目`)
          const firstItem = sidebarItems[0]
          if (firstItem) {
            setTimeout(() => {
              if (isRunning.value) {
                window.location.href = firstItem.href
              }
            }, 1000)
            return
          }
        }
      }

      log('→ 未找到学习项目，停止')
      stopBrushing()
      return
    }

    // 学习内容页面（视频、页面等）
    currentAction.value = '检查页面内容'

    // 尝试查找视频
    const video = videoManagerService.find()
    const settings = settingsStoreService.get()

    if (video) {
      log(`→ 检测到视频，准备播放 (duration=${Math.round(video.duration || 0)}s)`)
      currentAction.value = '播放视频'
      // 重置视频卡住跟踪：记录本次页面开始检测视频的时间
      videoProgressAt = Date.now()

      if (speedMode.value === SpeedMode.FAST) {
        videoManagerService.setPlaybackRate(playbackRate.value)
      }

      // 启动自动推进（视频播放完成后跳转）
      videoManagerService.setupAutoAdvance(() => {
        log('→ 视频播放完成，跳转到下一个')
        stats.itemsDone = settingsStoreService.sessionIncrementItems()
        goToNextItem()
      })

      // 静音刷课：直接切静音再播放；否则先按有声播放，自动播放失败再退化为静音
      const waitThenSkip = (): void => {
        pageTimer = window.setTimeout(() => {
          if (isRunning.value) {
            log('→ 等待超时，强制跳转')
            stats.itemsDone = settingsStoreService.sessionIncrementItems()
            goToNextItem()
          }
        }, settings.pageWaitTime || 5000)
      }

      if (mutedOn.value) {
        video.muted = true
      }
      video.play().then(() => {
        log(mutedOn.value ? '→ 视频以静音方式播放' : '→ 视频开始播放')
      }).catch(() => {
        try {
          // 有声播放失败：退化为静音再试一次
          if (!mutedOn.value) {
            video.muted = true
            video.play().then(() => {
              log('→ 视频以静音方式播放')
            }).catch(() => {
              log('→ 视频无法自动播放，等待后跳转')
              waitThenSkip()
            })
            return
          }
          // 静音播放仍失败：等待后跳转
          log('→ 视频无法自动播放，等待后跳转')
          waitThenSkip()
        } catch {
          log('→ 视频播放失败，跳转到下一个')
          stats.itemsDone = settingsStoreService.sessionIncrementItems()
          setTimeout(() => {
            if (isRunning.value) goToNextItem()
          }, 2000)
        }
      })

      // 定期检查视频状态，防止卡住
      videoCheckTimer = window.setInterval(() => {
        if (!isRunning.value) return
        const v = videoManagerService.find()
        if (v) {
          if (v.ended) {
            log('→ 视频已结束 (定时检测)，跳转到下一个')
            stats.itemsDone = settingsStoreService.sessionIncrementItems()
            goToNextItem()
          } else if (v.paused) {
            // 卡住兜底：若长时间没有播放进展，判定视频被平台锁死，强制跳转
            const idleMs = Date.now() - videoProgressAt
            if (idleMs > VIDEO_IDLE_TIMEOUT_MS) {
              log(`→ 视频卡住超过 ${Math.round(VIDEO_IDLE_TIMEOUT_MS / 1000)}s，强制跳转`)
              currentAction.value = '视频异常，自动跳过'
              showUserNotice(
                '检测到视频长时间无法播放，已自动跳过，继续下一个项目。',
                { type: 'warn', duration: 4000 }
              )
              stats.itemsDone = settingsStoreService.sessionIncrementItems()
              goToNextItem()
              return
            }
            v.play().catch(() => {})
          } else {
            // 视频正在播放，刷新"有进展"时间
            videoProgressAt = Date.now()
          }
        }
      }, 3000)

      return
    }

    // 非视频页面（页面、资源等）
    log('→ 非视频页面，等待后跳转')
    currentAction.value = '阅读页面'

    const waitMs = settings.pageWaitTime || 5000
    log(`→ 等待 ${waitMs}ms 后跳转`)

    pageTimer = window.setTimeout(() => {
      if (isRunning.value) {
        stats.itemsDone = settingsStoreService.sessionIncrementItems()
        goToNextItem()
      }
    }, waitMs)
  } catch (e) {
    console.warn('[刷课脚本] 页面处理失败', e)
    log('→ 处理失败，停止')
    stopBrushing()
  }
}

function goToNextItem(): void {
  if (!isRunning.value) return

  try {
    clearAllTimers()
    videoManagerService.cleanup()

    // === 策略 1：优先找"下一个活动"导航按钮 ===
    const nextLink = sidebarNavigatorService.findNextActivityLink()
    if (nextLink) {
      log(`→ 使用下一个活动导航: ${nextLink.substring(0, 60)}`)
      currentAction.value = '页面跳转中...'
      setTimeout(() => {
        if (isRunning.value) {
          window.location.href = nextLink
        }
      }, 500)
      return
    }

    // === 策略 2：从活动列表中找下一项 ===
    const items = sidebarNavigatorService.getAllItems()
    if (!items || items.length === 0) {
      // === 策略 3：当前页完全找不到列表，尝试回到课程主页 ===
      log('→ 未找到导航项，尝试回到课程主页')
      const courseHome = sidebarNavigatorService.findCourseHomeLink()
      if (courseHome) {
        currentAction.value = '返回课程主页'
        setTimeout(() => {
          if (isRunning.value) {
            window.location.href = courseHome
          }
        }, 500)
        return
      }
      log('→ 完全无法定位下一项，停止')
      stopBrushing()
      return
    }

    const curIndex = sidebarNavigatorService.findCurrentIndex(items)
    log(`→ 当前位置: ${curIndex + 1} / ${items.length}`)

    if (curIndex >= items.length - 1) {
      log('→ ✓ 所有项目已完成！')
      stopBrushing()
      return
    }

    if (curIndex >= 0) {
      const nextItem = items[curIndex + 1]
      if (nextItem) {
        // 更新课程进度：标记当前活动完成，准备下一活动（key 统一用 moduleId）
        const curItemId = getModuleIdFromUrl(items[curIndex].href) || items[curIndex].href
        courseProgressStore.markActivityCompleted(curItemId)
        const nextItemName = nextItem.textContent?.trim() || '(未命名)'
        const nextItemUrl = nextItem.href
        const nextItemId = getModuleIdFromUrl(nextItemUrl) || nextItemUrl
        courseProgressStore.updateCurrentActivity(nextItemId, nextItemName, nextItemUrl)

        log(`→ 跳转到第 ${curIndex + 2} 项: ${nextItemName.substring(0, 30)}`)
        currentAction.value = '页面跳转中...'
        setTimeout(() => {
          if (isRunning.value) {
            window.location.href = nextItem.href
          }
        }, 500)
        return
      }
    }

    // curIndex < 0 的情况：无法定位当前页，但知道还有列表
    // 优先尝试回到课程主页，重新从第一项开始
    if (items.length > 0) {
      log(`→ 无法定位当前页，找到 ${items.length} 个导航项，尝试跳第一项`)
      currentAction.value = '跳转到第一个项目'
      setTimeout(() => {
        if (isRunning.value && items[0]) {
          const firstHref = items[0].href
          // 防止跳回当前页造成死循环
          if (firstHref !== window.location.href) {
            window.location.href = firstHref
          } else {
            // 就是当前页，尝试跳到课程主页
            const courseHome = sidebarNavigatorService.findCourseHomeLink()
            if (courseHome) {
              window.location.href = courseHome
            } else {
              stopBrushing()
            }
          }
        }
      }, 800)
      return
    }

    log('→ 找不到下一项，停止')
    stopBrushing()
  } catch (e) {
    console.warn('[刷课脚本] 跳转失败', e)
    stopBrushing()
  }
}

// ===== 生命周期（位置/吸附/resize 由 composable 管理） =====

onMounted(() => {
  try {
    // 加载设置
    const settings = settingsStoreService.get()
    speedMode.value = settings.speedMode
    playbackRate.value = settings.videoPlaybackRate
    wakeLockOn.value = settings.wakeLock
    antiDetectionOn.value = settings.antiDetection
    mutedOn.value = settings.muted
    themeMode.value = settings.theme
    videoManagerService.setMutedPreference(settings.muted)

    // 从 session 恢复本次刷课计数（页面跳转后保持）
    const sessionData = settingsStoreService.sessionGet()
    if (sessionData.startTime > 0) {
      stats.itemsDone = sessionData.itemsDone
    }

    // 检查是否需要自动恢复
    if (settingsStoreService.isEnabled()) {
      log('检测到上次启用状态，自动恢复...')
      // 自动恢复时不要重置 session，保持计数继续
      setTimeout(() => startBrushing({ resetSession: false }), 1500)
    }

    refreshStats()
    log('面板已加载')
  } catch (e) {
    console.warn('[刷课脚本] 挂载失败', e)
  }
})

onUnmounted(() => {
  clearAllTimers()
})
</script>

<style>
/*
 * 仅保留布局与交互状态；配色/毛玻璃/圆角/阴影全部来自 src/styles/theme.css 的 --ouch-* 令牌。
 * 这样暗色模式只需覆盖变量，不必在每个组件里写两套样式。
 */
.ouchn-brusher {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 999999 !important;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.ouchn-brusher.snapping {
  transition: transform 0.26s var(--ouch-ease-snap);
}

.ouchn-brusher.dragging {
  cursor: grabbing;
  z-index: 999999 !important;
}

.btn-emoji {
  font-size: 28px;
  line-height: 1;
}

.panel {
  position: absolute;
  top: 0;
  right: 68px;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--ouch-text);
}

.progress-percent {
  font-size: 16px;
  font-weight: 700;
  color: var(--ouch-accent);
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  margin-bottom: 8px;
}

.progress-info {
  font-size: 12px;
  line-height: 1.5;
  color: var(--ouch-text-muted);
}

.seg-btn {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
}

.toggle-row + .toggle-row {
  border-top: 1px solid var(--ouch-line-soft);
  margin-top: 2px;
  padding-top: 10px;
}

.toggle-row span {
  font-size: 13px;
  color: var(--ouch-text);
}

.action-row {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
}

.log-line {
  word-break: break-all;
}

.theme-seg {
  width: 168px;
  flex: none;
}
</style>

