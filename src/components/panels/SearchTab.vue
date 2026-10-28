<template>
  <div class="tab-content">
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
        v-for="(result, index) in results"
        :key="index"
        class="search-result-item"
        @click="emit('goto', result)"
      >
        <span class="result-type">{{ getResultTypeLabel(result.matchType) }}</span>
        <span class="result-chapter">{{ result.chapterName }}</span>
        <span v-if="result.activityName" class="result-activity">{{ result.activityName }}</span>
        <div class="result-match">{{ result.matchedText }}</div>
      </div>

      <div v-if="results.length === 0 && searchKeyword" class="no-data">
        <p>未找到匹配结果</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 课程助手 - 搜索标签页
 * 纯展示搜索框与结果列表，由父组件管理搜索逻辑。
 */
import { ref } from 'vue'
import type { SearchResult } from '../../services/contentSearch'
import { getResultTypeLabel } from '../../utils/coursePanel'

defineProps<{
  results: SearchResult[]
}>()

const emit = defineEmits<{
  (e: 'search', keyword: string): void
  (e: 'goto', result: SearchResult): void
}>()

// 搜索框本地状态（输入由本组件持有，搜索动作上抛）
const searchKeyword = ref('')

function doSearch(): void {
  const kw = searchKeyword.value.trim()
  if (kw) emit('search', kw)
}
</script>

<style scoped>
.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.no-data p {
  margin: 4px 0;
}

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
</style>
