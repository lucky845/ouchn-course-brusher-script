<template>
  <div class="tab-content">
    <div class="bookmark-actions">
      <button class="action-btn primary" @click="emit('save')">
        🔖 保存当前位置
      </button>
      <button class="action-btn" :disabled="!lastBookmark" @click="emit('loadLast')">
        ⏪ 回到上次
      </button>
    </div>

    <div class="bookmark-list ouch-scroll">
      <div
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        class="bookmark-item"
        @click="emit('goto', bookmark)"
      >
        <div class="bookmark-info">
          <div class="bookmark-title">{{ bookmark.chapterName }}</div>
          <div v-if="bookmark.activityName" class="bookmark-activity">
            {{ bookmark.activityName }}
          </div>
          <div v-if="bookmark.note" class="bookmark-note">{{ bookmark.note }}</div>
          <div class="bookmark-time">{{ formatTime(bookmark.updatedAt) }}</div>
        </div>
        <button class="bookmark-delete" @click.stop="emit('delete', bookmark.id)">🗑️</button>
      </div>

      <div v-if="bookmarks.length === 0" class="no-data">
        <p>暂无书签</p>
        <p class="hint">点击"保存当前位置"创建书签</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 课程助手 - 书签标签页
 * 展示书签列表与操作按钮。所有业务状态由父组件管理，本组件为纯展示。
 */
import type { Bookmark } from '../../services/courseBookmarkStore'
import { formatTime } from '../../utils/coursePanel'

defineProps<{
  bookmarks: Bookmark[]
  lastBookmark: Bookmark | null
}>()

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'loadLast'): void
  (e: 'goto', bookmark: Bookmark): void
  (e: 'delete', id: string): void
}>()
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

.bookmark-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ouch-line);
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
  background: var(--ouch-surface-2);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.bookmark-item:hover {
  background: var(--ouch-surface);
}

.bookmark-info {
  flex: 1;
}

.bookmark-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ouch-text);
}

.bookmark-activity {
  font-size: 11px;
  color: var(--ouch-text-muted);
  margin-top: 2px;
}

.bookmark-note {
  font-size: 11px;
  color: var(--ouch-text-faint);
  font-style: italic;
  margin-top: 2px;
}

.bookmark-time {
  font-size: 10px;
  color: var(--ouch-text-faint);
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
</style>
