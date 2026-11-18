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

    <div class="search-results ouch-scroll">
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
  color: var(--ouch-text-muted);
}

.no-data p {
  margin: 4px 0;
}

.search-box {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ouch-line);
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--ouch-line);
  border-radius: 6px;
  font-size: 13px;
  /* 表单控件不继承字体和配色，暗色下必须显式给 */
  font-family: inherit;
  background: var(--ouch-surface);
  color: var(--ouch-text);
}

.search-input::placeholder {
  color: var(--ouch-text-faint);
}

.search-input:focus {
  outline: none;
  border-color: var(--ouch-accent);
  box-shadow: 0 0 0 3px var(--ouch-hover);
}

.search-btn {
  padding: 8px 12px;
  background: var(--ouch-grad);
  border: none;
  border-radius: 6px;
  color: var(--ouch-on-accent);
  cursor: pointer;
}

.search-results {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.search-result-item {
  padding: 10px 12px;
  background: var(--ouch-surface-2);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-result-item:hover {
  background: var(--ouch-surface);
}

.result-type {
  font-size: 10px;
  color: var(--ouch-accent);
  margin-right: 8px;
}

.result-chapter {
  font-size: 12px;
  font-weight: 600;
  color: var(--ouch-text);
}

.result-activity {
  font-size: 11px;
  color: var(--ouch-text-muted);
  margin-left: 8px;
}

.result-match {
  font-size: 11px;
  color: var(--ouch-text-faint);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
