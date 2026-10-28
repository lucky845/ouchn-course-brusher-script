/**
 * CoursePanel 拆分后的共享工具函数
 * 被父子组件共同引用的纯展示逻辑，抽离到独立工具便于复用与测试。
 */

/**
 * 格式化时间戳为"今天/昨天/天前/日期"的相对时间
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (days === 0) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (days === 1) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

/**
 * 活动类型 → 图标 emoji
 */
const ACTIVITY_ICONS: Record<string, string> = {
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
  '未知': '📌'
}

export function getActivityIcon(type: string): string {
  return ACTIVITY_ICONS[type] || '📌'
}

/**
 * 提醒条目相对时间描述
 */
export function getReminderTimeText(reminder: { type: string, time?: string, weekday?: number, deadline?: number | string }): string {
  switch (reminder.type) {
    case 'daily':
      return `每日 ${reminder.time}`
    case 'weekly': {
      const weekdays = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
      return `${weekdays[reminder.weekday || 0]} ${reminder.time}`
    }
    case 'deadline':
      if (reminder.deadline) {
        const ts = typeof reminder.deadline === 'number' ? reminder.deadline : Date.parse(reminder.deadline)
        return ts ? new Date(ts).toLocaleString() : ''
      }
      return ''
    default:
      return ''
  }
}

/**
 * 搜索结果类型标签（带 emoji）
 */
const RESULT_TYPE_LABELS: Record<string, string> = {
  chapter: '📚 章节',
  activity: '📌 活动',
  content: '📝 内容'
}

export function getResultTypeLabel(type: string): string {
  return RESULT_TYPE_LABELS[type] || type
}
