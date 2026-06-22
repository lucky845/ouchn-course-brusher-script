<template>
  <div
    class="quiz-panel"
    :class="{ dragging: isDragging, snapping: isSnapping }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    <!-- 悬浮按钮 -->
    <div
      class="quiz-btn"
      @mousedown.prevent="onDragStart"
      @click.stop="onBtnClick"
    >
      <span class="btn-emoji">📝</span>
    </div>

    <!-- 面板 -->
    <div v-show="isOpen" class="panel" @click.stop>
      <div class="panel-header">
        <span>答题助手</span>
        <button class="close-btn" @click="isOpen = false">✕</button>
      </div>

      <div class="panel-body">
        <!-- 状态 -->
        <div class="status-area">
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
        <div v-if="logs.length > 0" class="log-area">
          <div
            v-for="(l, i) in logs.slice(-5)"
            :key="i"
            class="log-line"
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
.quiz-panel {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 999999 !important;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.quiz-panel.snapping {
  transition: transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.quiz-panel.dragging {
  cursor: grabbing;
}

.quiz-btn {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 50%;
  box-shadow: 0 6px 20px rgba(240, 147, 251, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.quiz-btn::before {
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

.quiz-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 10px 30px rgba(240, 147, 251, 0.6);
}

.quiz-btn:hover::before {
  opacity: 1;
}

.btn-emoji {
  font-size: 28px;
  line-height: 1;
}

.quiz-panel .panel {
  position: absolute;
  top: 0;
  right: 68px;
  width: 340px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  cursor: default;
}

.quiz-panel .panel-header {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
}

.quiz-panel .close-btn {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quiz-panel .close-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.quiz-panel .panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8f9fb;
}

.quiz-panel .status-area {
  padding: 10px 14px;
  background: rgba(240, 147, 251, 0.08);
  border-radius: 10px;
  font-size: 12px;
  color: #555;
  text-align: center;
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
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quiz-panel .extract-btn.smart {
  background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%);
}

.quiz-panel .extract-btn.brute {
  background: linear-gradient(135deg, #1e88e5 0%, #42a5f5 100%);
}

.quiz-panel .extract-btn.ultra {
  background: linear-gradient(135deg, #8e24aa 0%, #ab47bc 100%);
}

.quiz-panel .extract-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

.quiz-panel .result-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.quiz-panel .result-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.quiz-panel .copy-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: #f093fb;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}

.quiz-panel .copy-btn:hover {
  background: #e91e63;
}

.quiz-panel .result-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.quiz-panel .question-item {
  padding: 8px 14px;
  border-bottom: 1px solid #f5f5f5;
}

.quiz-panel .question-item:last-child {
  border-bottom: none;
}

.quiz-panel .q-no {
  display: inline-block;
  padding: 2px 6px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
}

.quiz-panel .q-text {
  font-size: 12px;
  color: #333;
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
  color: #555;
  line-height: 1.4;
}

.quiz-panel .opt-letter {
  display: inline-block;
  min-width: 18px;
  padding: 0 4px;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
  font-weight: 600;
  color: #666;
}

.quiz-panel .q-type {
  display: inline-block;
  padding: 2px 8px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 10px;
  color: #666;
  margin-top: 4px;
}

.quiz-panel .hint {
  padding: 8px 12px;
  background: #fff3e0;
  border-radius: 8px;
  font-size: 11px;
  color: #795548;
  line-height: 1.5;
}

.quiz-panel .log-area {
  background: #1e1e2e;
  border-radius: 8px;
  padding: 6px 10px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 10px;
  line-height: 1.6;
  max-height: 80px;
  overflow-y: auto;
}

.quiz-panel .log-line {
  color: #a8e6cf;
  word-break: break-all;
}

.quiz-panel .log-line:last-child {
  color: #fff;
}
</style>
