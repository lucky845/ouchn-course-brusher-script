<template>
  <div
    class="quiz-panel"
    :class="{ dragging: isDragging, snapping: isSnapping }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <!-- 悬浮按钮 -->
    <div
      class="quiz-btn ouch-float-btn"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      aria-label="答题助手"
      @mousedown.prevent="onDragStart"
      @click.stop="onBtnClick"
      @keydown.enter.prevent="onBtnClick"
    >
      <span class="btn-emoji">📝</span>
    </div>

    <!-- 面板 -->
    <div v-show="isOpen" class="panel ouch-panel" @click.stop>
      <div class="panel-header ouch-titlebar">
        <span>答题助手</span>
        <button class="close-btn ouch-btn-close" @click="isOpen = false">✕</button>
      </div>

      <div class="panel-body ouch-panel-body">
        <!-- 状态 -->
        <div class="status-area ouch-status">
          <span>{{ statusText }}</span>
        </div>

        <!-- 提取按钮 -->
        <div class="btn-row">
          <button class="extract-btn smart" @click="handleExtract('smart')">
            🧠 智能提取
          </button>
          <button class="extract-btn brute" @click="handleExtract('brute')">
            💪 暴力提取
          </button>
        </div>
        <button class="extract-btn ultra" @click="handleExtract('ultra')">
          ⚡ 超强提取
        </button>

        <!-- 结果 -->
        <div v-if="result.count > 0" class="result-card">
          <div class="result-header">
            <span>✅ 找到 {{ result.count }} 道题</span>
            <button class="copy-btn" @click="copyResult">复制</button>
          </div>
          <div class="result-list">
            <div
              v-for="(q, i) in result.questions"
              :key="i"
              class="question-item"
            >
              <div class="q-no">Q{{ q.number }}</div>
              <div class="q-text">{{ q.text }}</div>
              <div v-if="q.options && q.options.length > 0" class="q-options">
                <div
                  v-for="(opt, j) in q.options"
                  :key="j"
                  class="q-option"
                >
                  <span class="opt-letter">{{ String.fromCharCode(65 + j) }}</span>
                  <span class="opt-text">{{ opt }}</span>
                </div>
              </div>
              <div class="q-type">{{ q.type }}</div>
            </div>
          </div>
        </div>

        <!-- 提示 -->
        <div class="hint">
          💡 点击上方按钮提取当前页面题目，结果会自动复制到剪贴板
        </div>

        <!-- 日志 -->
        <div v-if="logs.length > 0" class="log-area ouch-log">
          <div
            v-for="(l, i) in logs.slice(-5)"
            :key="i"
            class="log-line ouch-log-line"
          >
            [{{ l.time }}] {{ l.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { quizExtractorService } from '../services/quizExtractor'
import { PanelType, type Question } from '../types'
import { useDraggablePanel } from '../composables/useDraggablePanel'
import { getPanelConfig } from '../utils/panel'

// ===== 面板尺寸（由 utils/panel 统一配置） =====
const { width: BTN_WIDTH, height: BTN_HEIGHT, margin: MARGIN, dragThreshold: DRAG_THRESHOLD } = getPanelConfig(PanelType.QUIZ)

// ===== 拖拽（由 composable 统一管理） =====
const {
  position,
  isSnapping,
  isDragging,
  onDragStart,
  didDragMove,
  resetDragMove
} = useDraggablePanel(PanelType.QUIZ, BTN_WIDTH, BTN_HEIGHT, MARGIN, DRAG_THRESHOLD)

// ===== 状态 =====
const isOpen = ref(false)
const statusText = ref('点击按钮开始提取题目')

const result = reactive<{
  count: number
  questions: Question[]
}>({
  count: 0,
  questions: []
})

const logs = reactive<Array<{ time: string, text: string }>>([])

// ===== 工具 =====
function log(text: string): void {
  const d = new Date()
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  logs.push({ time: t, text })
  console.log('[答题助手]', text)
}

// ===== 点击行为 =====
function onBtnClick(): void {
  if (!didDragMove()) {
    isOpen.value = !isOpen.value
  }
  resetDragMove()
}

async function handleExtract(mode: 'smart' | 'brute' | 'ultra'): Promise<void> {
  try {
    statusText.value = `正在${mode === 'smart' ? '智能' : mode === 'brute' ? '暴力' : '超强'}提取中...`
    log(`开始提取 (${mode}模式)`)

    const raw = quizExtractorService.extractQuestions(mode)

    result.count = raw.questions?.length || 0
    result.questions = raw.questions || []

    if (result.count > 0) {
      statusText.value = `✅ 找到 ${result.count} 道题`
      log(`提取成功: ${result.count} 道题`)

      // 尝试复制到剪贴板
      try {
        const formatted = quizExtractorService.formatQuestions(raw.questions || [])
        const ok = await quizExtractorService.copyToClipboard(formatted)
        if (ok) {
          log('已复制到剪贴板')
        }
      } catch {
        log('复制到剪贴板失败')
      }
    } else {
      statusText.value = '❌ 未找到题目，请切换提取模式'
      log('未找到题目')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    statusText.value = `❌ 提取失败: ${msg}`
    log(`提取失败: ${msg}`)
  }
}

async function copyResult(): Promise<void> {
  try {
    const questions = result.questions.map(q => ({
      number: q.number,
      text: q.text,
      type: q.type,
      options: q.options
    }))
    const ok = await quizExtractorService.copyToClipboard(
      quizExtractorService.formatQuestions(questions)
    )
    if (ok) {
      statusText.value = '✅ 已复制到剪贴板'
      log('结果已复制到剪贴板')
    } else {
      statusText.value = '❌ 复制失败'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    statusText.value = `复制失败: ${msg}`
  }
}

onMounted(() => {
  try {
    log('答题助手已加载')
  } catch (e) {
    console.warn('[答题助手] 初始化失败', e)
  }
})
</script>

<style>
/*
 * 仅保留布局；配色/毛玻璃/圆角/阴影来自 src/styles/theme.css 的 --ouch-* 令牌。
 * 答题面板沿用同一套令牌，只是主色通过局部覆盖换成粉红，保证四个面板视觉一致。
 */
.quiz-panel {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 999999 !important;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --ouch-accent: #f5576c;
  --ouch-grad: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.quiz-panel.snapping {
  transition: transform 0.26s var(--ouch-ease-snap);
}

.quiz-panel.dragging {
  cursor: grabbing;
}

.btn-emoji {
  font-size: 28px;
  line-height: 1;
}

.quiz-panel .panel {
  position: absolute;
  top: 0;
  right: 68px;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.quiz-panel .panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quiz-panel .btn-row {
  display: flex;
  gap: 8px;
}

.quiz-panel .extract-btn {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  color: var(--ouch-on-accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s var(--ouch-ease), box-shadow 0.2s var(--ouch-ease);
}

.quiz-panel .extract-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}

.quiz-panel .extract-btn.brute {
  background: linear-gradient(135deg, #1e88e5 0%, #42a5f5 100%);
}

.quiz-panel .extract-btn.ultra {
  background: linear-gradient(135deg, #8e24aa 0%, #ab47bc 100%);
}

.quiz-panel .result-card {
  background: var(--ouch-surface);
  border: 1px solid var(--ouch-line-soft);
  border-radius: var(--ouch-radius-card);
  box-shadow: var(--ouch-shadow-card);
  overflow: hidden;
}

.quiz-panel .result-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--ouch-line);
  font-size: 13px;
  font-weight: 600;
  color: var(--ouch-text);
}

.quiz-panel .copy-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
  font-size: 11px;
  cursor: pointer;
  transition: filter 0.2s var(--ouch-ease);
}

.quiz-panel .copy-btn:hover {
  filter: brightness(1.08);
}

.quiz-panel .result-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.quiz-panel .question-item {
  padding: 8px 14px;
  border-bottom: 1px solid var(--ouch-line-soft);
}

.quiz-panel .question-item:last-child {
  border-bottom: none;
}

.quiz-panel .q-no {
  display: inline-block;
  padding: 2px 6px;
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
}

.quiz-panel .q-text {
  font-size: 12px;
  color: var(--ouch-text);
  line-height: 1.5;
  margin-bottom: 6px;
}

.quiz-panel .q-options {
  margin: 6px 0;
}

.quiz-panel .q-option {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  font-size: 11px;
  color: var(--ouch-text-muted);
  line-height: 1.4;
}

.quiz-panel .opt-letter {
  display: inline-block;
  min-width: 18px;
  padding: 0 4px;
  background: var(--ouch-surface-2);
  border-radius: 4px;
  text-align: center;
  font-weight: 600;
  color: var(--ouch-text-muted);
}

.quiz-panel .q-type {
  display: inline-block;
  padding: 2px 8px;
  background: var(--ouch-surface-2);
  border-radius: 4px;
  font-size: 10px;
  color: var(--ouch-text-muted);
  margin-top: 4px;
}

.quiz-panel .hint {
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  font-size: 11px;
  color: var(--ouch-text-muted);
  line-height: 1.5;
}

.quiz-panel .log-area {
  padding: 6px 10px;
  font-size: 10px;
  max-height: 80px;
}

.quiz-panel .log-line {
  word-break: break-all;
}
</style>
