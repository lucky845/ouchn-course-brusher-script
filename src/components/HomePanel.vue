<template>
  <div
    class="home-brusher"
    :class="{ dragging: isDragging, snapping: isSnapping, expanded: isExpanded }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <div
      class="home-btn ouch-float-btn"
      role="button"
      tabindex="0"
      :aria-expanded="isExpanded"
      aria-label="学习助手"
      @mousedown.prevent="onDragStart"
      @click.stop="togglePanel"
      @keydown.enter.prevent="togglePanel"
    >
      <span class="btn-icon">🏠</span>
      <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
    </div>

    <div v-show="isExpanded" class="home-panel ouch-panel" @click.stop>
      <div class="panel-header ouch-titlebar">
        <span class="panel-title">📊 学习助手</span>
        <button class="close-btn ouch-btn-close" @click="isExpanded = false">✕</button>
      </div>

      <div class="panel-body ouch-panel-body">
        <div class="scrollable-content">
          <div class="stats-card">
            <div class="stat-item">
              <span class="stat-value">{{ completedCount }}/{{ totalCount }}</span>
              <span class="stat-label">已完成</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ pendingCount }}</span>
              <span class="stat-label">待办任务</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ overallProgress }}%</span>
              <span class="stat-label">总进度</span>
            </div>
          </div>

          <div v-for="(semester, index) in semesters" :key="semester.name" class="semester-section">
            <div class="semester-header" @click="toggleSemester(semester.name)">
              <div class="semester-header-left">
                <span class="semester-arrow" :class="{ expanded: expandedSemesters[semester.name] }">
                  ▶
                </span>
                <span class="semester-name">
                  {{ semester.name }}
                  <span v-if="index === 0" class="current-tag">本学期</span>
                </span>
              </div>
              <span class="semester-count">{{ semester.courses.length }}</span>
            </div>

            <div v-show="expandedSemesters[semester.name]" class="course-list">
              <div
                v-for="course in semester.courses"
                :key="course.name"
                class="course-item"
              >
                <div class="course-cover">
                  <img v-if="course.coverUrl" :src="course.coverUrl" :alt="course.name" />
                  <div v-else class="course-cover-placeholder">📚</div>
                </div>
                <div class="course-content">
                  <div class="course-row">
                    <div class="course-info">
                      <span class="course-name" :title="course.name">{{ course.name }}</span>
                      <span v-if="course.isCompleted" class="completed-badge">✓</span>
                    </div>
                    <div class="course-right">
                      <span class="progress-text" :class="{ completed: course.isCompleted }">
                        {{ course.progress }}%
                      </span>
                    </div>
                  </div>
                  <div class="course-progress">
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :class="{ completed: course.isCompleted }"
                        :style="{ width: course.progress + '%' }"
                      ></div>
                    </div>
                  </div>
                  <div class="course-footer">
                    <div class="course-meta">
                      <span v-if="course.credits > 0" class="meta-item">{{ course.credits }}分</span>
                      <span v-if="course.score > 0" class="meta-item">{{ course.score }}分</span>
                      <span v-if="course.hasHomework" class="meta-item homework">
                        📝 {{ course.pendingTasks }}项
                      </span>
                    </div>
                    <button class="action-btn" @click="navigateToCourse(course)">
                      {{ course.isCompleted ? '查看' : '去学习' }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="semester.courses.length === 0" class="empty-courses">
                暂无课程数据
              </div>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <button class="quick-btn" @click="refreshCourses">🔄 刷新</button>
          <button class="quick-btn" @click="goToMoodle">📖 刷课中心</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { homeNavigatorService } from '../services/homeNavigator'
import { PanelType, type CourseInfo, type SemesterInfo } from '../types'
import { useDraggablePanel } from '../composables/useDraggablePanel'
import { getPanelConfig } from '../utils/panel'

// ===== 面板尺寸（由 utils/panel 统一配置） =====
const { width: BTN_WIDTH, height: BTN_HEIGHT, margin: MARGIN, dragThreshold: DRAG_THRESHOLD } = getPanelConfig(PanelType.COURSE)

// ===== 拖拽（由 composable 统一管理） =====
const {
  position,
  isSnapping,
  isDragging,
  onDragStart,
  didDragMove,
  resetDragMove
} = useDraggablePanel(PanelType.COURSE, BTN_WIDTH, BTN_HEIGHT, MARGIN, DRAG_THRESHOLD)

// ===== 状态 =====
const isExpanded = ref(false)
const semesters = ref<SemesterInfo[]>([])
const expandedSemesters = ref<Record<string, boolean>>({})
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
const MAX_RETRIES = 10
const RETRY_INTERVAL = 400

const currentSemesterCourses = computed(() => {
  const currentSemester = semesters.value.find(s => s.isCurrent)
  return currentSemester ? currentSemester.courses : []
})

const totalCount = computed(() => currentSemesterCourses.value.length)
const completedCount = computed(() => currentSemesterCourses.value.filter(c => c.isCompleted).length)
const pendingCount = computed(() => currentSemesterCourses.value.reduce((sum, c) => sum + c.pendingTasks, 0))
const overallProgress = computed(() => {
  if (currentSemesterCourses.value.length === 0) return 0
  const total = currentSemesterCourses.value.reduce((sum, c) => sum + c.progress, 0)
  return Math.round(total / currentSemesterCourses.value.length)
})

function refreshCourses(): void {
  // 第一步：检测 DOM 是否有课程标记
  const hasCourseMarkers = (() => {
    if (typeof document === 'undefined') return false
    // 关键：必须有 .card-body-status 元素才认为数据已加载
    if (document.querySelector('.card-body-status')) return true
    if (document.querySelector('.course-title')) return true
    if (document.querySelector('.progress-bar')) return true
    if (document.querySelector('button')) {
      const buttons = document.querySelectorAll('button')
      for (let i = 0; i < buttons.length; i++) {
        const txt = buttons[i].textContent?.trim() || ''
        if (txt.includes('查看课程') || txt.includes('去学习')) return true
      }
    }
    return false
  })()

  if (!hasCourseMarkers && retryCount < MAX_RETRIES) {
    if (retryTimer) clearTimeout(retryTimer)
    retryCount += 1
    retryTimer = setTimeout(() => refreshCourses(), RETRY_INTERVAL)
    return
  }

  // 第二步：提取课程
  const result = homeNavigatorService.extractSemesters()

  // 第三步：验证数据质量 - 必须满足所有条件
  // 1. 有当前学期课程
  // 2. 至少有一门课程有真实进度（排除进度全为0的情况）
  // 3. 待办任务数总和必须合理（不能超过课程数*10）
  const currentSemester = result.find(s => s.isCurrent)
  const hasValidCourses = currentSemester && currentSemester.courses.length > 0
  const hasRealProgress = currentSemester && currentSemester.courses.some(c => c.progress > 0)
  const totalPending = currentSemester ? currentSemester.courses.reduce((sum, c) => sum + c.pendingTasks, 0) : 0
  const pendingReasonable = totalPending <= (currentSemester?.courses.length || 0) * 10
  const dataQualityOk = hasValidCourses && hasRealProgress && pendingReasonable

  if (!dataQualityOk && retryCount < MAX_RETRIES) {
    // 数据质量不达标，继续重试，不更新状态
    if (retryTimer) clearTimeout(retryTimer)
    retryCount += 1
    retryTimer = setTimeout(() => refreshCourses(), RETRY_INTERVAL)
    return  // 关键：不更新状态，避免展示不完整的数据
  }

  // 数据质量达标或已达到最大重试次数，更新状态
  semesters.value = result

  // 诊断：打印提取结果，便于定位"本学期课程统计错误"问题
  console.log('[HomePanel] 学期提取结果：', result.map(s => ({
    学期: s.name,
    isCurrent: s.isCurrent,
    课程数: s.courses.length,
    待办: s.courses.reduce((sum, c) => sum + c.pendingTasks, 0),
    已学完: s.courses.filter(c => c.isCompleted).length
  })))

  // 默认只展开本学期课程
  result.forEach((s) => {
    if (s.isCurrent) {
      expandedSemesters.value[s.name] = true
    } else {
      expandedSemesters.value[s.name] = false
    }
  })
}

function stopRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function toggleSemester(name: string): void {
  expandedSemesters.value[name] = !expandedSemesters.value[name]
}

function togglePanel(): void {
  if (!didDragMove()) {
    isExpanded.value = !isExpanded.value
    if (isExpanded.value) {
      // 展开时强制刷新一次（无视重试计数，让用户操作时能获取最新）
      retryCount = 0
      stopRetry()
      refreshCourses()
    }
  }
  resetDragMove()
}

function navigateToCourse(course: CourseInfo): void {
  homeNavigatorService.navigateToCourse(course)
}

function goToMoodle(): void {
  window.open('https://moodle.syxy.ouchn.cn/', '_blank')
}

onMounted(() => {
  refreshCourses()
})

onUnmounted(() => {
  stopRetry()
})
</script>

<style scoped>
.home-brusher {
  position: fixed;
  z-index: 999999;
  transition: none;
}

.home-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ouch-grad);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: var(--ouch-shadow-float);
  transition: transform 0.25s var(--ouch-ease), box-shadow 0.25s var(--ouch-ease), filter 0.25s var(--ouch-ease);
  position: relative;
}

.home-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.25s ease;
  border-radius: 50%;
}

.home-btn:hover {
  transform: scale(1.12);
  box-shadow: var(--ouch-shadow-float);
}

.home-btn:hover::before {
  opacity: 1;
}

.home-btn:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.btn-icon {
  font-size: 20px;
}

.badge {
  position: absolute;
  top: -10px;
  right: -10px;
  background: linear-gradient(135deg, #ff4757 0%, #ff6b7a 100%);
  color: var(--ouch-on-accent);
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  box-shadow: 0 4px 10px rgba(255, 71, 87, 0.6);
}

.home-panel {
  position: absolute;
  right: 0;
  top: 70px;
  width: 380px;
  max-height: 70vh;
  color: var(--ouch-text);
  border-radius: var(--ouch-radius-panel);
  box-shadow: var(--ouch-shadow-panel);
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
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: var(--ouch-on-accent);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.34);
}

.panel-body {
  padding: 0;
  display: flex;
  flex-direction: column;
  max-height: calc(70vh - 50px);
  overflow: hidden;
}

.scrollable-content {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.scrollable-content::-webkit-scrollbar {
  width: 6px;
}

.scrollable-content::-webkit-scrollbar-track {
  background: var(--ouch-surface-2);
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background: var(--ouch-surface-2);
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background: var(--ouch-text-faint);
}

.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--ouch-surface-2);
  border-radius: 12px;
  padding: 14px;
  margin: 12px 12px 14px 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--ouch-accent);
}

.stat-label {
  font-size: 10px;
  color: var(--ouch-text-muted);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: var(--ouch-line);
}

.semester-section {
  margin-bottom: 12px;
  border-radius: 10px;
  background: var(--ouch-surface-2);
  margin: 0 12px 12px 12px;
}

.semester-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--ouch-surface-2);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  position: sticky;
  top: 0;
  z-index: 10;
}

.semester-header:hover {
  background: var(--ouch-surface-2);
}

.semester-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.semester-arrow {
  font-size: 10px;
  color: var(--ouch-text-muted);
  transition: transform 0.2s;
  display: inline-block;
}

.semester-arrow.expanded {
  transform: rotate(90deg);
}

.semester-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ouch-text);
}

.current-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
  font-size: 9px;
  border-radius: 4px;
  font-weight: 500;
}

.semester-count {
  background: var(--ouch-surface-2);
  color: var(--ouch-text-muted);
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.course-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.course-item {
  background: var(--ouch-surface);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  gap: 12px;
  box-shadow: var(--ouch-shadow-card);
  transition: box-shadow 0.2s;
}

.course-item:hover {
  box-shadow: var(--ouch-shadow-panel);
}

.course-cover {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--ouch-grad);
  display: flex;
  align-items: center;
  justify-content: center;
}

.course-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.course-cover-placeholder {
  font-size: 22px;
  color: var(--ouch-on-accent);
}

.course-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.course-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.course-info {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.course-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ouch-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: var(--ouch-ok);
  color: var(--ouch-on-accent);
  font-size: 10px;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}

.course-right {
  flex-shrink: 0;
}

.progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--ouch-accent);
}

.progress-text.completed {
  color: var(--ouch-ok);
}

.course-progress {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--ouch-surface-2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--ouch-grad);
  border-radius: 2px;
  transition: width 0.3s ease;
  min-width: 0;
}

.progress-fill.completed {
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
}

.course-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.course-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.meta-item {
  font-size: 10px;
  color: var(--ouch-text-faint);
}

.meta-item.homework {
  color: var(--ouch-warn);
  font-weight: 500;
}

.action-btn {
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
  width: 40%;
  max-width: 40%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn:hover {
  opacity: 0.9;
}

.empty-courses {
  text-align: center;
  padding: 12px;
  font-size: 11px;
  color: var(--ouch-text-faint);
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 12px 12px 4px 12px;
  margin-top: auto;
  border-top: 1px solid var(--ouch-line);
  flex-shrink: 0;
}

.quick-btn {
  flex: 1;
  background: var(--ouch-surface-2);
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-btn:hover {
  background: var(--ouch-surface-2);
}

.dragging {
  transition: none !important;
}

.snapping {
  transition: transform 0.26s var(--ouch-ease-snap);
}

@media (max-width: 420px) {
  .home-panel {
    width: calc(100vw - 20px);
    right: 10px;
    max-height: 80vh;
  }

  .course-item {
    padding: 8px;
  }

  .course-cover {
    width: 45px;
    height: 45px;
  }
}
</style>
