<template>
  <div
    class="course-assistant"
    :class="{ dragging: isDragging, snapping: isSnapping, expanded: isExpanded }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <!-- 悬浮按钮 -->
    <div
      class="course-btn"
      @mousedown.prevent="onDragStart"
      @click.stop="togglePanel"
    >
      <span class="btn-icon">📖</span>
      <span v-if="unfinishedChapters > 0 && activeTab === 'chapters'" class="badge">{{ unfinishedChapters }}</span>
      <span v-if="unreadNotifications > 0 && activeTab === 'reminders'" class="badge">{{ unreadNotifications }}</span>
    </div>

    <!-- 面板内容 -->
    <div v-show="isExpanded" class="course-panel" @click.stop>
      <!-- 头部 -->
      <div class="panel-header">
        <span class="panel-title">📚 {{ courseInfo?.courseName || '课程助手' }}</span>
        <button class="close-btn" @click="isExpanded = false">✕</button>
      </div>

      <!-- 标签页 -->
      <div class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- ===== 章节导航 ===== -->
      <div v-show="activeTab === 'chapters'" class="tab-content">
        <!-- 进度概览 -->
        <div class="progress-overview">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: courseInfo?.overallProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ courseInfo?.overallProgress || 0 }}% 已完成</div>
          <div class="progress-stats">
            <span class="stat-item completed">✅ {{ courseInfo?.completedChapters || 0 }}/{{ courseInfo?.totalChapters || 0 }}</span>
            <span class="stat-item pending">⬜ {{ unfinishedChapters }} 未完成</span>
          </div>

          <!-- 刷课进度（正在刷当前课程时显示） -->
          <div v-if="isBrushingCurrentCourse" class="brushing-status">
            <div class="brushing-indicator">
              <span class="brushing-icon">🎓</span>
              <span class="brushing-text">正在刷课中...</span>
            </div>
            <div v-if="currentActivityName" class="brushing-activity">
              当前: {{ currentActivityName }}
            </div>
            <div class="brushing-progress">
              <div class="brushing-bar">
                <div class="brushing-fill" :style="{ width: brushingProgress + '%' }"></div>
              </div>
              <span class="brushing-percent">{{ brushingProgress }}%</span>
            </div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="quick-actions">
          <button class="action-btn" @click="expandAll">展开全部</button>
          <button class="action-btn" @click="collapseAll">折叠全部</button>
          <button class="action-btn refresh" @click="refreshCourse">🔄 刷新</button>
        </div>

        <!-- 章节列表 -->
        <div class="chapter-list">
          <div
            v-for="(chapter, index) in courseInfo?.chapters || []"
            :key="index"
            class="chapter-item"
            :class="{ completed: chapter.status === 'completed', 'in-progress': chapter.status === 'in_progress' }"
          >
            <div class="chapter-header" @click="toggleChapter(index)">
              <span class="chapter-status">
                <span v-if="chapter.status === 'completed'" class="status-icon">✅</span>
                <span v-else-if="chapter.status === 'in_progress'" class="status-icon">🔄</span>
                <span v-else class="status-icon">⬜</span>
              </span>
              <span class="chapter-name">{{ chapter.name }}</span>
              <span class="chapter-progress">{{ chapter.progress }}%</span>
              <span class="chapter-arrow" :class="{ expanded: expandedChapters[index] }">▶</span>
            </div>

            <div v-show="expandedChapters[index]" class="chapter-activities">
              <div
                v-for="(activity, actIdx) in chapter.activities"
                :key="actIdx"
                class="activity-item"
                :class="{ completed: activity.status === 'completed' }"
                @click="goToActivity(index, actIdx)"
              >
                <span class="activity-icon">{{ getActivityIcon(activity.type) }}</span>
                <span class="activity-name">{{ activity.name }}</span>
                <span class="activity-type">{{ activity.type }}</span>
              </div>
              <div v-if="chapter.activities.length === 0" class="no-activities">
                暂无学习活动
              </div>
            </div>
          </div>

          <div v-if="!courseInfo || courseInfo.chapters.length === 0" class="no-data">
            <p>正在加载课程信息...</p>
            <p class="hint">如果长时间未加载，请点击刷新按钮</p>
          </div>
        </div>
      </div>

      <!-- ===== 书签 ===== -->
      <div v-show="activeTab === 'bookmarks'" class="tab-content">
        <div class="bookmark-actions">
          <button class="action-btn primary" @click="saveBookmark">
            🔖 保存当前位置
          </button>
          <button class="action-btn" @click="loadLastBookmark" :disabled="!lastBookmark">
            ⏪ 回到上次
          </button>
        </div>

        <div class="bookmark-list">
          <div
            v-for="bookmark in currentBookmarks"
            :key="bookmark.id"
            class="bookmark-item"
            @click="goToBookmark(bookmark)"
          >
            <div class="bookmark-info">
              <div class="bookmark-title">{{ bookmark.chapterName }}</div>
              <div v-if="bookmark.activityName" class="bookmark-activity">
                {{ bookmark.activityName }}
              </div>
              <div v-if="bookmark.note" class="bookmark-note">{{ bookmark.note }}</div>
              <div class="bookmark-time">{{ formatTime(bookmark.updatedAt) }}</div>
            </div>
            <button class="bookmark-delete" @click.stop="deleteBookmark(bookmark.id)">🗑️</button>
          </div>

          <div v-if="currentBookmarks.length === 0" class="no-data">
            <p>暂无书签</p>
            <p class="hint">点击"保存当前位置"创建书签</p>
          </div>
        </div>
      </div>

      <!-- ===== 搜索 ===== -->
      <div v-show="activeTab === 'search'" class="tab-content">
        <div class="search-box">
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            placeholder="输入关键词搜索..."
            @keyup.enter="doSearch"
          />
          <button class="search-btn" @click="doSearch">🔍</button>
        </div>

        <div class="search-results">
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="search-result-item"
            @click="goToSearchResult(result)"
          >
            <span class="result-type">{{ getResultTypeLabel(result.matchType) }}</span>
            <span class="result-chapter">{{ result.chapterName }}</span>
            <span v-if="result.activityName" class="result-activity">{{ result.activityName }}</span>
            <div class="result-match">{{ result.matchedText }}</div>
          </div>

          <div v-if="searchResults.length === 0 && searchKeyword" class="no-data">
            <p>未找到匹配结果</p>
          </div>
        </div>
      </div>

      <!-- ===== 提醒 ===== -->
      <div v-show="activeTab === 'reminders'" class="tab-content">
        <div class="reminder-actions">
          <button class="action-btn primary" @click="showAddReminder = true">
            ⏰ 添加提醒
          </button>
          <button class="action-btn" @click="clearAllNotifications">
            📋 清空通知
          </button>
        </div>

        <!-- 通知列表 -->
        <div class="notification-list">
          <div
            v-for="notif in notifications"
            :key="notif.id"
            class="notification-item"
            :class="{ unread: !notif.read }"
            @click="markNotificationRead(notif.id)"
          >
            <div class="notif-title">{{ notif.title }}</div>
            <div class="notif-message">{{ notif.message }}</div>
            <div class="notif-time">{{ formatTime(notif.timestamp) }}</div>
          </div>

          <div v-if="notifications.length === 0" class="no-data">
            <p>暂无通知</p>
          </div>
        </div>

        <!-- 提醒列表 -->
        <div class="reminder-list">
          <div class="section-title">📅 我的提醒</div>
          <div
            v-for="reminder in currentReminders"
            :key="reminder.id"
            class="reminder-item"
            :class="{ disabled: !reminder.enabled }"
          >
            <div class="reminder-info">
              <div class="reminder-title">{{ reminder.title }}</div>
              <div class="reminder-time">{{ getReminderTimeText(reminder) }}</div>
            </div>
            <div class="reminder-actions">
              <button @click.stop="toggleReminder(reminder.id)">
                {{ reminder.enabled ? '🔔' : '🔕' }}
              </button>
              <button @click.stop="deleteReminder(reminder.id)">🗑️</button>
            </div>
          </div>

          <div v-if="currentReminders.length === 0" class="no-data">
            <p>暂无提醒</p>
            <p class="hint">点击"添加提醒"创建学习提醒</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加提醒弹窗 -->
    <div v-if="showAddReminder" class="modal-overlay" @click="showAddReminder = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <span>添加提醒</span>
          <button @click="showAddReminder = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>提醒标题</label>
            <input v-model="newReminder.title" type="text" placeholder="例如：完成测验" />
          </div>
          <div class="form-group">
            <label>提醒类型</label>
            <select v-model="newReminder.type">
              <option value="daily">每日提醒</option>
              <option value="weekly">每周提醒</option>
              <option value="deadline">截止日期</option>
            </select>
          </div>
          <div v-if="newReminder.type === 'daily'" class="form-group">
            <label>提醒时间</label>
            <input v-model="newReminder.time" type="time" />
          </div>
          <div v-if="newReminder.type === 'weekly'" class="form-group">
            <label>提醒时间</label>
            <input v-model="newReminder.time" type="time" />
          </div>
          <div v-if="newReminder.type === 'weekly'" class="form-group">
            <label>星期</label>
            <select v-model="newReminder.weekday">
              <option :value="1">周一</option>
              <option :value="2">周二</option>
              <option :value="3">周三</option>
              <option :value="4">周四</option>
              <option :value="5">周五</option>
              <option :value="6">周六</option>
              <option :value="0">周日</option>
            </select>
          </div>
          <div v-if="newReminder.type === 'deadline'" class="form-group">
            <label>截止日期</label>
            <input v-model="newReminder.deadline" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>备注（可选）</label>
            <input v-model="newReminder.description" type="text" placeholder="附加说明..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAddReminder = false">取消</button>
          <button class="btn-confirm" @click="addReminder">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { courseNavigatorService } from '../services/courseNavigator'
import { courseProgressStore, type CourseProgressStoreData } from '../services/courseProgressStore'
import { bookmarkStore, type Bookmark } from '../services/courseBookmarkStore'
import { contentSearchService, type SearchResult } from '../services/contentSearch'
import { studyReminderService, type StudyReminder } from '../services/studyReminder'
import { PanelType } from '../types'
import { useDraggablePanel } from '../composables/useDraggablePanel'
import { getPanelConfig } from '../utils/panel'
import { getCourseId } from '../utils/url'

// ===== 面板尺寸 =====
const { width: BTN_WIDTH, height: BTN_HEIGHT, margin: MARGIN, dragThreshold: DRAG_THRESHOLD } = getPanelConfig(PanelType.COURSE)

// ===== 拖拽 =====
const {
  position,
  isSnapping,
  isDragging,
  onDragStart,
  didDragMove,
  resetDragMove,
} = useDraggablePanel(PanelType.COURSE, BTN_WIDTH, BTN_HEIGHT, MARGIN, DRAG_THRESHOLD)

// ===== 标签页 =====
const tabs = [
  { id: 'chapters', label: '章节', icon: '📚' },
  { id: 'bookmarks', label: '书签', icon: '🔖' },
  { id: 'search', label: '搜索', icon: '🔍' },
  { id: 'reminders', label: '提醒', icon: '⏰' },
]
const activeTab = ref('chapters')

// ===== 状态 =====
const isExpanded = ref(false)
const courseInfo = ref(courseNavigatorService.getCourseInfo())
const expandedChapters = ref<Record<number, boolean>>({})
const progressData = ref<CourseProgressStoreData>(courseProgressStore.getData())
const bookmarks = ref<Bookmark[]>(bookmarkStore.getAll())
const notifications = ref(studyReminderService.getNotifications())
const reminders = ref<StudyReminder[]>(studyReminderService.getAll())

// ===== 搜索状态 =====
const searchKeyword = ref('')
const searchResults = ref<SearchResult[]>([])

// ===== 提醒弹窗状态 =====
const showAddReminder = ref(false)
const newReminder = ref({
  title: '',
  type: 'daily' as 'daily' | 'weekly' | 'deadline',
  time: '20:00',
  weekday: 1,
  deadline: '',
  description: '',
})

// ===== 计算属性 =====
const unfinishedChapters = computed(() => {
  if (!courseInfo.value) return 0
  return courseInfo.value.chapters.filter(c => c.status !== 'completed').length
})

const currentCourseProgress = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return null
  return progressData.value.courses[courseId] || null
})

const isBrushingCurrentCourse = computed(() => {
  return currentCourseProgress.value?.isBrushing || false
})

const brushingProgress = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return 0
  return courseProgressStore.getCourseCompletionPercent(courseId)
})

const currentActivityName = computed(() => {
  return currentCourseProgress.value?.lastActivityName || ''
})

const unreadNotifications = computed(() => {
  return studyReminderService.getUnreadCount()
})

const currentBookmarks = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return []
  return bookmarks.value.filter(b => b.courseId === courseId)
})

const lastBookmark = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return null
  return bookmarkStore.getLastBookmark(courseId)
})

const currentReminders = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return []
  return reminders.value.filter(r => r.courseId === courseId)
})

// ===== 订阅进度变化 =====
let unsubscribe: (() => void) | null = null

function subscribeProgress(): void {
  unsubscribe = courseProgressStore.subscribe((data) => {
    progressData.value = data
  })
}

onMounted(() => {
  subscribeProgress()
  bookmarkStore.subscribe((data) => {
    bookmarks.value = data.bookmarks
  })
  studyReminderService.subscribe((data) => {
    notifications.value = data.notifications.slice(0, 20)
    reminders.value = data.reminders
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

// ===== 方法 =====
function togglePanel(): void {
  if (!didDragMove()) {
    isExpanded.value = !isExpanded.value
    if (isExpanded.value) {
      refreshCourse()
    }
  }
  resetDragMove()
}

function toggleChapter(index: number): void {
  expandedChapters.value[index] = !expandedChapters.value[index]
}

function refreshCourse(): void {
  courseInfo.value = courseNavigatorService.refresh()
  if (courseInfo.value) {
    // 设置搜索服务的章节数据
    contentSearchService.setChapters(courseInfo.value.chapters)
    // 默认展开前3个未完成的章节
    courseInfo.value.chapters.forEach((chapter, index) => {
      if (chapter.status !== 'completed' && index < 3) {
        expandedChapters.value[index] = true
      }
    })
  }
}

function goToChapter(index: number): void {
  courseNavigatorService.scrollToChapter(index)
}

function goToActivity(chapterIndex: number, activityIndex: number): void {
  courseNavigatorService.scrollToActivity(chapterIndex, activityIndex)
}

function expandAll(): void {
  if (courseInfo.value) {
    courseInfo.value.chapters.forEach((_, index) => {
      expandedChapters.value[index] = true
    })
  }
}

function collapseAll(): void {
  expandedChapters.value = {}
}

function getActivityIcon(type: string): string {
  const iconMap: Record<string, string> = {
    '视频': '🎬',
    '资源': '📄',
    '页面': '📃',
    '测验': '📝',
    '作业': '📋',
    '讨论区': '💬',
    '外部链接': '🔗',
    '投票': '🗳️',
    'SCORM': '🎮',
    '互动课程': '📖',
    '协作活动': '👥',
    '文件夹': '📁',
    '标签': '🏷️',
    '未知': '📌',
  }
  return iconMap[type] || '📌'
}

// ===== 书签方法 =====
function saveBookmark(): void {
  bookmarkStore.saveCurrentPosition()
}

function loadLastBookmark(): void {
  const bookmark = lastBookmark.value
  if (bookmark) {
    goToBookmark(bookmark)
  }
}

function goToBookmark(bookmark: Bookmark): void {
  courseNavigatorService.scrollToChapter(bookmark.chapterIndex)
  if (bookmark.activityIndex !== undefined && bookmark.activityIndex >= 0) {
    setTimeout(() => {
      courseNavigatorService.scrollToActivity(bookmark.chapterIndex, bookmark.activityIndex!)
    }, 500)
  }
}

function deleteBookmark(id: string): void {
  bookmarkStore.delete(id)
}

// ===== 搜索方法 =====
function doSearch(): void {
  if (!searchKeyword.value.trim()) return
  contentSearchService.addToHistory(searchKeyword.value)
  searchResults.value = contentSearchService.search(searchKeyword.value)
}

function goToSearchResult(result: SearchResult): void {
  contentSearchService.scrollToResult(result)
}

function getResultTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    chapter: '📚 章节',
    activity: '📌 活动',
    content: '📝 内容',
  }
  return labels[type] || type
}

// ===== 提醒方法 =====
function addReminder(): void {
  if (!newReminder.value.title.trim()) return

  if (newReminder.value.type === 'deadline' && newReminder.value.deadline) {
    const deadlineTime = new Date(newReminder.value.deadline).getTime()
    studyReminderService.createDeadlineReminder(
      newReminder.value.title,
      deadlineTime,
      newReminder.value.description || undefined
    )
  } else {
    studyReminderService.createDailyReminder(
      newReminder.value.title,
      newReminder.value.time,
      newReminder.value.description || undefined
    )
  }

  // 重置表单
  newReminder.value = {
    title: '',
    type: 'daily',
    time: '20:00',
    weekday: 1,
    deadline: '',
    description: '',
  }
  showAddReminder.value = false
}

function toggleReminder(id: string): void {
  studyReminderService.toggle(id)
}

function deleteReminder(id: string): void {
  studyReminderService.delete(id)
}

function markNotificationRead(id: string): void {
  studyReminderService.markAsRead(id)
}

function clearAllNotifications(): void {
  studyReminderService.clearNotifications()
}

function getReminderTimeText(reminder: StudyReminder): string {
  switch (reminder.type) {
    case 'daily':
      return `每日 ${reminder.time}`
    case 'weekly':
      const weekdays = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
      return `${weekdays[reminder.weekday || 0]} ${reminder.time}`
    case 'deadline':
      return reminder.deadline ? new Date(reminder.deadline).toLocaleString() : ''
    default:
      return ''
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (days === 0) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (days === 1) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

onMounted(() => {
  setTimeout(() => {
    if (!courseInfo.value) {
      refreshCourse()
    }
  }, 500)
})
</script>

<style scoped>
.course-assistant {
  position: fixed;
  z-index: 999999;
  transition: none;
}

.course-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.course-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
}

.course-btn:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.btn-icon {
  font-size: 20px;
}

.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4757;
  color: white;
  font-size: 12px;
  font-weight: bold;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-shadow: 0 2px 8px rgba(255, 71, 87, 0.5);
}

/* 面板样式 */
.course-panel {
  position: absolute;
  right: 0;
  top: 70px;
  width: 360px;
  max-height: 70vh;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 标签页 */
.tab-nav {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 10px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #e8e8e8;
}

.tab-btn.active {
  border-bottom-color: #10b981;
  background: #ffffff;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  font-size: 10px;
  color: #666;
}

.tab-btn.active .tab-label {
  color: #10b981;
  font-weight: 600;
}

/* 标签内容 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.tab-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

/* 进度概览 */
.progress-overview {
  padding: 14px 18px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #059669;
}

.progress-stats {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}

.stat-item {
  font-size: 11px;
  color: #666;
}

.stat-item.completed {
  color: #059669;
}

.stat-item.pending {
  color: #f59e0b;
}

/* 刷课状态 */
.brushing-status {
  margin-top: 10px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 8px;
  color: white;
}

.brushing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.brushing-icon {
  font-size: 16px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.brushing-text {
  font-size: 12px;
  font-weight: 600;
}

.brushing-activity {
  font-size: 11px;
  opacity: 0.9;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brushing-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brushing-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.brushing-fill {
  height: 100%;
  background: white;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.brushing-percent {
  font-size: 11px;
  font-weight: 600;
  min-width: 35px;
  text-align: right;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid #e8e8e8;
}

.action-btn {
  flex: 1;
  padding: 6px 8px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #e0e0e0;
}

.action-btn.refresh {
  background: #ecfdf5;
  color: #059669;
}

.action-btn.refresh:hover {
  background: #d1fae5;
}

.action-btn.primary {
  background: #10b981;
  color: white;
}

.action-btn.primary:hover {
  background: #059669;
}

/* 章节列表 */
.chapter-list {
  flex: 1;
  padding: 8px;
}

.chapter-item {
  margin-bottom: 6px;
  border-radius: 8px;
  overflow: hidden;
}

.chapter-item.completed {
  opacity: 0.7;
}

.chapter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8f9fa;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.chapter-header:hover {
  background: #eef0f3;
}

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.chapter-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-progress {
  font-size: 11px;
  color: #666;
  flex-shrink: 0;
}

.chapter-arrow {
  font-size: 10px;
  color: #666;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chapter-arrow.expanded {
  transform: rotate(90deg);
}

/* 活动列表 */
.chapter-activities {
  background: #ffffff;
  padding: 6px 12px 6px 36px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  background: #f8f9fa;
}

.activity-item.completed {
  opacity: 0.6;
}

.activity-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.activity-name {
  flex: 1;
  font-size: 12px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-type {
  font-size: 10px;
  color: #999;
  flex-shrink: 0;
}

.no-activities {
  padding: 8px 0;
  font-size: 11px;
  color: #999;
  text-align: center;
}

.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.no-data p {
  margin: 4px 0;
}

.no-data .hint {
  font-size: 11px;
  color: #999;
}

/* 书签 */
.bookmark-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid #e8e8e8;
}

.bookmark-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.bookmark-item:hover {
  background: #eef0f3;
}

.bookmark-info {
  flex: 1;
}

.bookmark-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.bookmark-activity {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.bookmark-note {
  font-size: 11px;
  color: #999;
  font-style: italic;
  margin-top: 2px;
}

.bookmark-time {
  font-size: 10px;
  color: #999;
  margin-top: 4px;
}

.bookmark-delete {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.bookmark-delete:hover {
  opacity: 1;
}

/* 搜索 */
.search-box {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid #e8e8e8;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #10b981;
}

.search-btn {
  padding: 8px 12px;
  background: #10b981;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.search-results {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.search-result-item {
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-result-item:hover {
  background: #eef0f3;
}

.result-type {
  font-size: 10px;
  color: #10b981;
  margin-right: 8px;
}

.result-chapter {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.result-activity {
  font-size: 11px;
  color: #666;
  margin-left: 8px;
}

.result-match {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 提醒 */
.reminder-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid #e8e8e8;
}

.notification-list {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 1px solid #e8e8e8;
}

.notification-item {
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.notification-item.unread {
  background: #ecfdf5;
  border-left: 3px solid #10b981;
}

.notification-item:hover {
  background: #e8e8e8;
}

.notif-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.notif-message {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.notif-time {
  font-size: 10px;
  color: #999;
  margin-top: 4px;
}

.reminder-list {
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
  padding-left: 4px;
}

.reminder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.reminder-item.disabled {
  opacity: 0.5;
}

.reminder-info {
  flex: 1;
}

.reminder-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.reminder-time {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.reminder-actions button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 320px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
}

.modal-header button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

.modal-body {
  padding: 18px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #10b981;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid #e8e8e8;
}

.modal-footer button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel {
  background: #f0f0f0;
  color: #666;
}

.btn-confirm {
  background: #10b981;
  color: white;
}

/* 高亮效果 */
:global(.course-assistant-highlight) {
  animation: highlightPulse 0.5s ease-in-out 3;
}

@keyframes highlightPulse {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(16, 185, 129, 0.2); }
}

/* 拖拽状态 */
.dragging {
  transition: none !important;
}

.snapping {
  transition: transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@media (max-width: 420px) {
  .course-panel {
    width: calc(100vw - 20px);
    right: 10px;
    max-height: 80vh;
  }
}
</style>
