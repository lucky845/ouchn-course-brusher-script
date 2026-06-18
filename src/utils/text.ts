/**
 * 文本处理工具
 * 统一处理文本清理、占位符识别、系统提示过滤等
 */

/** 占位符文本集合 - 这些文本应从提取结果中剔除 */
const PLACEHOLDER_TEXTS = new Set([
  '清空我的选择',
  '请选择',
  '选择一项',
  '选择答案',
  'clear my choice',
  'select one',
  '回答',
  '答题',
])

/** 系统提示关键词 - 包含这些关键词的文本应视为非题目内容 */
const SYSTEM_TAGS = [
  '请在输入框中输入您的答案',
  '请选择一个选项：',
  '请从下拉菜单中选择',
  '请将正确答案',
  '请输入你的答案',
  '说明：',
  '提示：',
  '题目',
  '拖动选项',
  '空格处',
  '标记试题',
  '试题正文',
  '还未作答',
  '满分',
]

/**
 * 判断文本是否为占位符文本（应剔除）
 */
export function isPlaceholderText (text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.length <= 1) return true
  if (/^[A-Za-z]$/.test(t)) return true
  if (PLACEHOLDER_TEXTS.has(t)) return true
  return false
}

/**
 * 清理原始文本 - 移除多余空白、系统提示行、换行规范化
 * @param raw 原始文本
 * @returns 清理后的纯文本
 */
export function cleanText (raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  const lines = text.split('\n').map(l => l.trim()).filter(l => {
    if (!l) return false
    for (const tag of SYSTEM_TAGS) {
      if (l.includes(tag)) return false
    }
    return true
  })
  return lines.join(' ').trim()
}

/**
 * 判断文本是否为占位符（基于去重时检查）
 */
export function isTextPlaceholder (text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  return PLACEHOLDER_TEXTS.has(trimmed)
}
