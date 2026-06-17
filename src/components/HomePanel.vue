<template>
  <div
    class="home-brusher"
    :class="{ dragging: isDraggingFlag, snapping: isSnapping, expanded: isExpanded }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <div
      class="home-btn"
      @mousedown.prevent="onDragStart"
      @click.stop="togglePanel"
    >
      <span class="btn-icon">🏠</span>
      <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
    </div>

    <div v-show="isExpanded" class="home-panel" @click.stop>
      <div class="panel-header">
        <span class="panel-title">📊 学习助手</span>
        <button class="close-btn" @click="isExpanded = false">✕</button>
      </div>

      <div class="panel-body">
        <div class="scrollable-content">
          <div class="stats-card">
            <div class="stat-item">
              <span class="stat-value">{{ completedCount }}/{{ totalCount }}</span>
              <span class="stat-label">已完成</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ pendingCount }}</span>
              <span class="stat-label">待办</span>
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
import { homeNavigatorService, type CourseInfo, type SemesterInfo } from '../services/homeNavigator'
import { settingsStoreService } from '../services/settingsStore'
import { PanelType, PanelEdge } from '../types'

const isExpanded = ref(false)

// 加载保存的位置
const savedPosition = settingsStoreService.getPanelPosition(PanelType.COURSE)
const position = ref({ x: savedPosition.x, y: savedPosition.y })
const semesters = ref<SemesterInfo[]>([])
const expandedSemesters = ref<Record<string, boolean>>({})

let isDraggingFlag = false
let dragOffset = { x: 0, y: 0 }
let didDragMove = false
const isSnapping = ref(false)

const BTN_WIDTH = 44
const BTN_HEIGHT = 44
const MARGIN = 10
const DRAG_THRESHOLD = 5

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
  const result = homeNavigatorService.extractSemesters()
  semesters.value = result
  
  // 默认只展开本学期课程
  result.forEach(s => {
    if (s.isCurrent) {
      expandedSemesters.value[s.name] = true
    } else {
      // 过去学期的课程默认折叠
      expandedSemesters.value[s.name] = false
    }
  })
}

function toggleSemester(name: string): void {
  expandedSemesters.value[name] = !expandedSemesters.value[name]
}

function togglePanel(): void {
  if (!didDragMove) {
    isExpanded.value = !isExpanded.value
    if (isExpanded.value) {
      refreshCourses()
    }
  }
  didDragMove = false
}

function navigateToCourse(course: CourseInfo): void {
  // 直接调用 homeNavigatorService 的 navigateToCourse 方法
  // 该方法会模拟点击按钮触发 Angular 路由跳转
  homeNavigatorService.navigateToCourse(course)
}

function goToMoodle(): void {
  window.open('https://moodle.syxy.ouchn.cn/', '_blank')
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function getBounds() {
  const ww = window.innerWidth
  const wh = window.innerHeight
  return {
    minX: MARGIN,
    minY: MARGIN,
    maxX: ww - BTN_WIDTH - MARGIN,
    maxY: wh - BTN_HEIGHT - MARGIN,
  }
}

function onDragStart(e: MouseEvent): void {
  isSnapping.value = false
  dragOffset = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
  isDraggingFlag = true
  didDragMove = false
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent): void {
  if (!isDraggingFlag) return
  const rawX = e.clientX - dragOffset.x
  const rawY = e.clientY - dragOffset.y
  if (!didDragMove) {
    if (Math.abs(rawX - position.value.x) > DRAG_THRESHOLD || Math.abs(rawY - position.value.y) > DRAG_THRESHOLD) {
      didDragMove = true
    }
  }
  const bounds = getBounds()
  position.value = {
    x: clamp(rawX, bounds.minX, bounds.maxX),
    y: clamp(rawY, bounds.minY, bounds.maxY),
  }
}

function onDragEnd(): void {
  isDraggingFlag = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  if (didDragMove) {
    const ww = window.innerWidth
    const centerX = position.value.x + BTN_WIDTH / 2
    const snapLeft = centerX < ww / 2
    const snapEdge = snapLeft ? PanelEdge.LEFT : PanelEdge.RIGHT
    const bounds = getBounds()
    const targetX = snapLeft ? bounds.minX : bounds.maxX
    const targetY = clamp(position.value.y, bounds.minY, bounds.maxY)
    isSnapping.value = true
    position.value = { x: targetX, y: targetY }
    window.setTimeout(() => {
      isSnapping.value = false
      settingsStoreService.savePanelPosition(PanelType.COURSE, position.value.x, position.value.y, snapEdge)
    }, 280)
  }
}

onMounted(() => {
  refreshCourses()
  
  // 窗口大小变化时更新位置
  window.addEventListener('resize', () => {
    // 保持当前 x 位置相对于窗口边缘的关系
    const ww = window.innerWidth
    const centerX = position.value.x + BTN_WIDTH / 2
    if (centerX < ww / 2) {
      // 在左侧
      position.value = {
        x: MARGIN,
        y: position.value.y,
      }
    } else {
      // 在右侧
      position.value = {
        x: ww - BTN_WIDTH - MARGIN,
        y: position.value.y,
      }
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<style scoped>
.home-brusher {
  position: fixed;
  z-index: 999999;
  transition: none;
}

.home-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.home-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
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

.home-panel {
  position: absolute;
  right: 0;
  top: 70px;
  width: 380px;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
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
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
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
  color: #667eea;
}

.stat-label {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(0, 0, 0, 0.1);
}

.semester-section {
  margin-bottom: 12px;
  border-radius: 10px;
  background: #f8f9fa;
  margin: 0 12px 12px 12px;
}

.semester-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f8f9fa;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  position: sticky;
  top: 0;
  z-index: 10;
}

.semester-header:hover {
  background: #eef0f3;
}

.semester-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.semester-arrow {
  font-size: 10px;
  color: #666;
  transition: transform 0.2s;
  display: inline-block;
}

.semester-arrow.expanded {
  transform: rotate(90deg);
}

.semester-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.current-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 9px;
  border-radius: 4px;
  font-weight: 500;
}

.semester-count {
  background: #e0e0e0;
  color: #666;
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
  background: #ffffff;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;
}

.course-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.course-cover {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  color: white;
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
  color: #333;
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
  background: #4caf50;
  color: white;
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
  color: #667eea;
}

.progress-text.completed {
  color: #4caf50;
}

.course-progress {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
  min-width: 0;
}

.progress-fill.completed {
  background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
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
  color: #888;
}

.meta-item.homework {
  color: #ff9800;
  font-weight: 500;
}

.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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
  color: #999;
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 12px 12px 4px 12px;
  margin-top: auto;
  border-top: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.quick-btn {
  flex: 1;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-btn:hover {
  background: #e0e0e0;
}

.dragging {
  transition: none !important;
}

.snapping {
  transition: transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94);
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