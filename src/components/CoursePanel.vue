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
      <span v-if="unfinishedChapters > 0" class="badge">{{ unfinishedChapters }}</span>
    </div>

    <!-- 面板内容 -->
    <div v-show="isExpanded" class="course-panel" @click.stop>
      <!-- 头部 -->
      <div class="panel-header">
        <span class="panel-title">📚 {{ courseInfo?.courseName || '课程助手' }}</span>
        <button class="close-btn" @click="isExpanded = false">✕</button>
      </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { courseNavigatorService } from '../services/courseNavigator'
import { courseProgressStore, type CourseProgressStoreData } from '../services/courseProgressStore'
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

// ===== 状态 =====
const isExpanded = ref(false)
const courseInfo = ref(courseNavigatorService.getCourseInfo())
const expandedChapters = ref<Record<number, boolean>>({})
const progressData = ref<CourseProgressStoreData>(courseProgressStore.getData())

// ===== 计算属性 =====
const unfinishedChapters = computed(() => {
  if (!courseInfo.value) return 0
  return courseInfo.value.chapters.filter(c => c.status !== 'completed').length
})

// 当前课程的刷课进度
const currentCourseProgress = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return null
  return progressData.value.courses[courseId] || null
})

// 是否正在刷当前课程
const isBrushingCurrentCourse = computed(() => {
  return currentCourseProgress.value?.isBrushing || false
})

// 刷课完成百分比
const brushingProgress = computed(() => {
  const courseId = getCourseId()
  if (!courseId) return 0
  return courseProgressStore.getCourseCompletionPercent(courseId)
})

// 当前刷课活动名称
const currentActivityName = computed(() => {
  return currentCourseProgress.value?.lastActivityName || ''
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
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
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
  // 默认展开前3个未完成的章节
  if (courseInfo.value) {
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

onMounted(() => {
  // 初始化时尝试提取课程信息
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
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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

/* 刷课进度状态 */
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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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

/* 章节列表 */
.chapter-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chapter-list::-webkit-scrollbar {
  width: 6px;
}

.chapter-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chapter-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
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

/* 高亮效果 */
:global(.course-assistant-highlight) {
  animation: highlightPulse 0.5s ease-in-out 3;
}

@keyframes highlightPulse {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(16, 185, 129, 0.2);
  }
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
