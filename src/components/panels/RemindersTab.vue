<template>
  <div class="tab-content">
    <div class="reminder-actions">
      <button class="action-btn primary" @click="openDialog">
        ⏰ 添加提醒
      </button>
      <button class="action-btn" @click="emit('clearNotifications')">
        📋 清空通知
      </button>
    </div>

    <!-- 通知列表 -->
    <div class="notification-list ouch-scroll">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="notification-item"
        :class="{ unread: !notif.read }"
        @click="emit('markRead', notif.id)"
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
    <div class="reminder-list ouch-scroll">
      <div class="section-title">📅 我的提醒</div>
      <div
        v-for="reminder in reminders"
        :key="reminder.id"
        class="reminder-item"
        :class="{ disabled: !reminder.enabled }"
      >
        <div class="reminder-info">
          <div class="reminder-title">{{ reminder.title }}</div>
          <div class="reminder-time">{{ getReminderTimeText(reminder) }}</div>
        </div>
        <div class="reminder-actions">
          <button @click.stop="emit('toggle', reminder.id)">
            {{ reminder.enabled ? '🔔' : '🔕' }}
          </button>
          <button @click.stop="emit('delete', reminder.id)">🗑️</button>
        </div>
      </div>

      <div v-if="reminders.length === 0" class="no-data">
        <p>暂无提醒</p>
        <p class="hint">点击"添加提醒"创建学习提醒</p>
      </div>
    </div>

    <!-- 添加提醒弹窗（原生 <dialog> + showModal） -->
    <dialog
      ref="dialogEl"
      class="reminder-dialog"
      aria-labelledby="reminder-dialog-title"
      @close="onDialogClose"
    >
      <div class="modal-header">
        <span id="reminder-dialog-title">添加提醒</span>
        <button type="button" aria-label="关闭" @click="closeDialog">✕</button>
      </div>
      <div class="modal-body ouch-scroll">
        <div class="form-group">
          <label for="reminder-title">提醒标题</label>
          <input
            id="reminder-title"
            v-model="newReminder.title"
            type="text"
            placeholder="例如：完成测验"
          />
        </div>
        <div class="form-group">
          <label for="reminder-type">提醒类型</label>
          <select id="reminder-type" v-model="newReminder.type">
            <option value="daily">每日提醒</option>
            <option value="weekly">每周提醒</option>
            <option value="deadline">截止日期</option>
          </select>
        </div>
        <div v-if="newReminder.type === 'daily'" class="form-group">
          <label for="reminder-time-daily">提醒时间</label>
          <input id="reminder-time-daily" v-model="newReminder.time" type="time" />
        </div>
        <div v-if="newReminder.type === 'weekly'" class="form-group">
          <label for="reminder-time-weekly">提醒时间</label>
          <input id="reminder-time-weekly" v-model="newReminder.time" type="time" />
        </div>
        <div v-if="newReminder.type === 'weekly'" class="form-group">
          <label for="reminder-weekday">星期</label>
          <select id="reminder-weekday" v-model="newReminder.weekday">
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
          <label for="reminder-deadline">截止日期</label>
          <input id="reminder-deadline" v-model="newReminder.deadline" type="datetime-local" />
        </div>
        <div class="form-group">
          <label for="reminder-desc">备注（可选）</label>
          <input
            id="reminder-desc"
            v-model="newReminder.description"
            type="text"
            placeholder="附加说明..."
          />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-cancel" @click="cancelDialog">取消</button>
        <button type="button" class="btn-confirm" @click="submitReminder">确定</button>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 课程助手 - 提醒标签页
 * 展示通知列表、提醒列表与添加提醒弹窗。数据由父组件下发，操作通过 emit 上抛。
 */
import { reactive, ref } from 'vue'
import type { StudyReminder } from '../../services/studyReminder'
import { formatTime, getReminderTimeText } from '../../utils/coursePanel'

defineProps<{
  notifications: Array<{ id: string, title: string, message: string, timestamp: number, read: boolean }>
  reminders: StudyReminder[]
}>()

const emit = defineEmits<{
  (e: 'addReminder', data: { title: string, type: 'daily' | 'weekly' | 'deadline', time: string, weekday: number, deadline: string, description: string }): void
  (e: 'toggle', id: string): void
  (e: 'delete', id: string): void
  (e: 'markRead', id: string): void
  (e: 'clearNotifications'): void
}>()

// ===== 弹窗状态 =====
// 用原生 <dialog>.showModal() 而不是 v-if 切一个 class="modal" 的 div：
// 浏览器免费提供顶层渲染、页面 inert、焦点圈定与归还、Esc 关闭和 ::backdrop。
const dialogEl = ref<HTMLDialogElement | null>(null)
const newReminder = reactive({
  title: '',
  type: 'daily' as 'daily' | 'weekly' | 'deadline',
  time: '20:00',
  weekday: 1,
  deadline: '',
  description: ''
})

function openDialog(): void {
  const el = dialogEl.value
  if (!el) return
  // 已经打开时再调 showModal 会抛 InvalidStateError
  if (!el.open) el.showModal()
}

/** 取消：丢弃草稿后关闭（与「确定」区分开） */
function cancelDialog(): void {
  resetDraft()
  closeDialog()
}

function closeDialog(): void {
  const el = dialogEl.value
  if (el?.open) el.close()
}

/** 把草稿恢复到默认值：取消或提交后都不应把上次的输入留给下一次 */
function resetDraft(): void {
  newReminder.title = ''
  newReminder.type = 'daily'
  newReminder.time = '20:00'
  newReminder.weekday = 1
  newReminder.deadline = ''
  newReminder.description = ''
}

/**
 * Esc 或浏览器返回手势关闭时也要丢草稿。
 * dialog 的 close 事件由浏览器在关闭后统一触发，所以这里是兜底路径；
 * 点「取消」「确定」两条路径会显式 resetDraft()。
 */
function onDialogClose(): void {
  resetDraft()
}

function submitReminder(): void {
  if (!newReminder.title.trim()) return
  emit('addReminder', {
    title: newReminder.title,
    type: newReminder.type,
    time: newReminder.time,
    weekday: newReminder.weekday,
    deadline: newReminder.deadline,
    description: newReminder.description
  })
  resetDraft()
  closeDialog()
}
</script>

<style scoped>
.action-btn {
  flex: 1;
  padding: 6px 8px;
  background: var(--ouch-surface-2);
  border: 1px solid var(--ouch-line-soft);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ouch-text);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--ouch-hover);
  color: var(--ouch-accent);
}

.action-btn.primary {
  background: var(--ouch-grad);
  border-color: transparent;
  color: var(--ouch-on-accent);
}

.action-btn.primary:hover {
  filter: brightness(1.08);
  color: var(--ouch-on-accent);
}

.no-data {
  padding: 40px 20px;
  text-align: center;
  color: var(--ouch-text-muted);
}

.no-data p {
  margin: 4px 0;
}

.no-data .hint {
  font-size: 11px;
  color: var(--ouch-text-faint);
  font-style: italic;
}

.reminder-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ouch-line);
}

.notification-list {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 1px solid var(--ouch-line);
}

.notification-item {
  padding: 10px 12px;
  background: var(--ouch-surface-2);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.notification-item.unread {
  background: var(--ouch-hover);
  border-left: 3px solid var(--ouch-ok);
}

.notification-item:hover {
  background: var(--ouch-surface);
}

.notif-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ouch-text);
}

.notif-message {
  font-size: 11px;
  color: var(--ouch-text-muted);
  margin-top: 2px;
}

.notif-time {
  font-size: 10px;
  color: var(--ouch-text-faint);
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
  color: var(--ouch-text-muted);
  margin-bottom: 8px;
  padding-left: 4px;
}

.reminder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--ouch-surface-2);
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
  color: var(--ouch-text);
}

.reminder-time {
  font-size: 11px;
  color: var(--ouch-text-muted);
  margin-top: 2px;
}

.reminder-actions button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
}

/*
 * 原生 <dialog>：浏览器负责顶层渲染、页面 inert、焦点圈定与归还、Esc 关闭。
 * 这里只需要处理外观和滚动穿透。
 */
.reminder-dialog {
  /* 浏览器默认 margin:auto + max-width，这里显式给出更可控的尺寸 */
  width: 400px;
  max-width: 90vw;
  max-height: 85dvh;
  padding: 0;
  border: none;
  border-radius: 16px;
  color: var(--ouch-text);
  background: var(--ouch-glass-bg-strong, #fff);
  -webkit-backdrop-filter: blur(var(--ouch-glass-blur, 18px));
  backdrop-filter: blur(var(--ouch-glass-blur, 18px));
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  /* 内容超出时由对话框自己滚，不要把滚动链传给下面的页面 */
  overscroll-behavior: contain;
  animation: modalIn 0.25s var(--ouch-ease, cubic-bezier(0.4, 0, 0.2, 1));
}

/* 未打开时必须回到 display:none，否则 dialog 会一直显示 */
.reminder-dialog:not([open]) {
  display: none;
}

/*
 * ::backdrop 默认 overflow: visible，不是滚动容器，
 * overscroll-behavior 会被忽略；必须先改成 hidden 才能拦住背景滚动。
 */
.reminder-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  overflow: hidden;
  overscroll-behavior: contain;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* 尊重系统「减少动态效果」：只用淡入，不做缩放 */
@media (prefers-reduced-motion: reduce) {
  .reminder-dialog {
    animation: none;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--ouch-line);
  font-size: 16px;
  font-weight: 700;
  color: var(--ouch-text);
  background: var(--ouch-surface-2);
  border-radius: 16px 16px 0 0;
  flex: none;
}

.modal-header button {
  background: var(--ouch-surface);
  border: 1px solid var(--ouch-line-soft);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ouch-text-muted);
  transition: background 0.15s, color 0.15s;
}

.modal-header button:hover {
  background: var(--ouch-danger);
  border-color: transparent;
  color: var(--ouch-on-accent);
}

.modal-body {
  padding: 22px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--ouch-text-muted);
  margin-bottom: 6px;
  font-weight: 600;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--ouch-line);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: var(--ouch-surface);
  /* 表单控件不会自动继承字体与配色，必须显式声明，否则暗色下是黑字深底 */
  color: var(--ouch-text);
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--ouch-ok);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 22px;
  border-top: 1px solid var(--ouch-line);
  background: var(--ouch-surface-2);
  border-radius: 0 0 16px 16px;
  flex: none;
}

.modal-footer button {
  flex: 1;
  padding: 11px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: box-shadow 0.15s, filter 0.15s;
}

.btn-cancel {
  background: var(--ouch-surface);
  border: 1px solid var(--ouch-line);
  color: var(--ouch-text-muted);
}

.btn-cancel:hover {
  background: var(--ouch-hover);
  color: var(--ouch-text);
}

.btn-confirm {
  background: var(--ouch-grad);
  color: var(--ouch-on-accent);
}

.btn-confirm:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
}
</style>
