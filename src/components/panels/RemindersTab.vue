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
    <div class="notification-list">
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
    <div class="reminder-list">
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

    <!-- 添加提醒弹窗 -->
    <teleport to="body">
      <div v-if="showAddReminder" class="modal-overlay" @click="closeDialog">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <span>添加提醒</span>
            <button @click="closeDialog">✕</button>
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
            <button class="btn-cancel" @click="closeDialog">取消</button>
            <button class="btn-confirm" @click="submitReminder">确定</button>
          </div>
        </div>
      </div>
    </teleport>
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
const showAddReminder = ref(false)
const newReminder = reactive({
  title: '',
  type: 'daily' as 'daily' | 'weekly' | 'deadline',
  time: '20:00',
  weekday: 1,
  deadline: '',
  description: ''
})

function openDialog(): void {
  showAddReminder.value = true
}

function closeDialog(): void {
  showAddReminder.value = false
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
  newReminder.title = ''
  newReminder.type = 'daily'
  newReminder.time = '20:00'
  newReminder.weekday = 1
  newReminder.deadline = ''
  newReminder.description = ''
  closeDialog()
}
</script>

<style scoped>
.action-btn {
  flex: 1;
  padding: 6px 8px;
  background: #e5e7eb;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: #d1d5db;
  color: #111827;
}

.action-btn.primary {
  background: #10b981;
  color: white;
}

.action-btn.primary:hover {
  background: #059669;
}

.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.no-data p {
  margin: 4px 0;
}

.no-data .hint {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
}

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

.modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999999;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  animation: modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
  border-radius: 16px 16px 0 0;
}

.modal-header button {
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.15s;
}

.modal-header button:hover {
  background: #ef4444;
  color: white;
}

.modal-body {
  padding: 22px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 6px;
  font-weight: 600;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.15s;
  background: #fafafa;
  color: #1f2937;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #10b981;
  background: white;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 22px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 0 0 16px 16px;
}

.modal-footer button {
  flex: 1;
  padding: 11px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-cancel:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.btn-confirm {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-confirm:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  transform: translateY(-1px);
}
</style>
