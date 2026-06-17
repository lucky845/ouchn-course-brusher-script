/**
 * 题目提取服务 - 参考 XueHua-s/ouchn-learn 设计
 * 兼容 Moodle 和 OUCHN 两种平台的 DOM 结构
 */
import type { Question, QuestionType, ExtractResult } from '../types'

const QUIZ_URL_PATTERN = '/mod/quiz/'

// ============ 选择器常量（集中管理） ============

// Moodle 平台
const MOODLE_SUBJECT_SELECTOR = '.que'
const MOODLE_OPTION_SELECTOR = '.answer .r0, .answer .r1, .answer .r2, .answer .r3'
const MOODLE_OPTION_LABEL_SELECTOR = 'label'
const MOODLE_QTEXT_SELECTOR = '.qtext'
const MOODLE_TYPE_CLASS_MAP: Array<{ className: string; type: QuestionType }> = [
  { className: 'truefalse', type: '判断题' },
  { className: 'multichoiceset', type: '多选题' },
  { className: 'multichoice', type: '单选题' },
  { className: 'shortanswer', type: '简答题' },
  { className: 'essay', type: '论述题' },
  { className: 'match', type: '匹配题' },
  { className: 'numerical', type: '数字题' },
  { className: 'calculated', type: '计算题' },
  { className: 'cloze', type: '完形填空' },
  { className: 'gapselect', type: '完形填空' },
  { className: 'ddwtos', type: '拖放填空' },
  { className: 'ordering', type: '排序题' },
]

// OUCHN 平台（参考 XueHua-s/ouchn-learn）
const OUCHN_SUBJECT_SELECTOR = '.subject'
const OUCHN_SUB_SUBJECT_SELECTOR = '.sub-subject'
const OUCHN_ANALYSIS_CLASS = 'analysis'
const OUCHN_OPTION_SELECTOR = '.option'
const OUCHN_OPTION_INDEX_SELECTOR = '.option-index'
const OUCHN_OPTION_CONTENT_SELECTOR = '.option-content'
const OUCHN_DESCRIPTION_SELECTOR = '.subject-description'
const OUCHN_SUMMARY_SELECTOR = '.summary-sub-title'

// 题型文字映射（优先级高于 class）
const TYPE_TEXT_MAP: Array<{ pattern: RegExp; type: QuestionType }> = [
  { pattern: /单选题|单选/, type: '单选题' },
  { pattern: /多选题|多选/, type: '多选题' },
  { pattern: /判断题|判断|true.*false|是非题/, type: '判断题' },
  { pattern: /简答题|简答|论述题|论述/, type: '简答题' },
  { pattern: /填空题|填空/, type: '填空题' },
  { pattern: /匹配题|匹配/, type: '匹配题' },
  { pattern: /完形填空|补全对话/, type: '完形填空' },
  { pattern: /计算题|计算/, type: '计算题' },
  { pattern: /排序题|排序/, type: '排序题' },
]

// 占位符文本（需要过滤）
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

// 系统提示关键词（需要过滤）
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

// ============ 工具函数 ============

function isPlaceholderText(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.length <= 1) return true
  if (/^[A-Za-z]$/.test(t)) return true
  if (PLACEHOLDER_TEXTS.has(t)) return true
  return false
}

function cleanText(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  // 不再过滤单字母行！因为选项可能被拆分成 "A" + 内容
  const lines = text.split('\n').map(l => l.trim()).filter(l => {
    if (!l) return false
    // 只过滤系统提示关键词，不过滤单字母
    for (const tag of SYSTEM_TAGS) {
      if (l.includes(tag)) return false
    }
    return true
  })
  return lines.join(' ').trim()  // 用空格连接，而不是换行
}

// ============ 题型检测 ============

/**
 * 检测题型 - 优先读取可见文字，再 class 兜底
 * 参考 XueHua-s/ouchn-learn 的 detectQuestionType
 */
function detectQuestionType(element: Element): QuestionType {
  // 策略1：读取题型可见文字（OUCHN: .summary-sub-title, Moodle: .qtype 或 info 区域）
  const summaryEl = element.querySelector(OUCHN_SUMMARY_SELECTOR)
  const typeText = summaryEl?.textContent?.trim() || ''

  // Moodle: 查找题号区域旁边的题型文字
  const qnoEl = element.querySelector('.qno')
  const infoText = qnoEl?.parentElement?.textContent?.trim() || ''

  const fullText = typeText || infoText || ''

  for (const { pattern, type } of TYPE_TEXT_MAP) {
    if (pattern.test(fullText)) {
      return type
    }
  }

  // 策略2：读取 class（Moodle 风格）
  const classStr = (element.className || '').toString()
  for (const { className, type } of MOODLE_TYPE_CLASS_MAP) {
    if (classStr.includes(className)) {
      return type
    }
  }

  // OUCHN: 检测 analysis class（综合题）
  if (classStr.includes(OUCHN_ANALYSIS_CLASS)) {
    return '综合题'
  }

  // 策略3：检测输入控件
  const hasRadio = !!element.querySelector('input[type="radio"]')
  const hasCheckbox = !!element.querySelector('input[type="checkbox"]')
  const hasSelect = !!element.querySelector('select')
  const hasTextarea = !!element.querySelector('textarea')
  const hasTextInput = !!element.querySelector('input[type="text"]')
  const hasContentEditable = !!element.querySelector('[contenteditable="true"]')

  if (hasRadio && !hasCheckbox) {
    // 判断题：只有 2 个选项
    const optionCount = element.querySelectorAll('.option, .answer input[type="radio"]').length
    if (optionCount === 2) return '判断题'
    return '单选题'
  }
  if (hasCheckbox) return '多选题'
  if (hasSelect) return '完形填空'
  if (hasTextarea) return '论述题'
  if (hasTextInput || hasContentEditable) return '填空题'

  return '未知题型'
}

// ============ 选项提取 ============

/**
 * 提取选项 - 兼容 Moodle 和 OUCHN 两种结构
 * 关键：不要过滤单字母，因为选项可能被拆分成 "A" + 内容
 */
function extractChoiceOptions(element: Element): string[] {
  const options: string[] = []
  const seen = new Set<string>()

  const tryPush = (text: string) => {
    if (!text) return
    // 只过滤真正的占位符，不过滤单字母
    const trimmed = text.trim()
    if (PLACEHOLDER_TEXTS.has(trimmed)) return
    const norm = trimmed.toLowerCase()
    if (seen.has(norm)) return
    seen.add(norm)
    options.push(trimmed)
  }

  // 策略A：OUCHN 风格 - .option .option-content
  const ouchnOptions = element.querySelectorAll(OUCHN_OPTION_SELECTOR)
  if (ouchnOptions.length > 0) {
    ouchnOptions.forEach(optEl => {
      // 优先 .option-content
      const contentEl = optEl.querySelector(OUCHN_OPTION_CONTENT_SELECTOR)
      if (contentEl) {
        const text = cleanText(contentEl.textContent || '')
        if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
          tryPush(text)
          return
        }
      }
      // 其次整个 .option（可能包含 A. + 内容）
      const text = cleanText(optEl.textContent || '')
      if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
        tryPush(text)
      }
    })
    if (options.length >= 2) return options
  }

  // 策略B：Moodle 风格 - .answer .r0/.r1/.r2/.r3
  // 关键：按顺序遍历，保持选项顺序
  const moodleRows = element.querySelectorAll('.answer .r0, .answer .r1, .answer .r2, .answer .r3, .answer .r4, .answer .r5')
  if (moodleRows.length > 0) {
    moodleRows.forEach(row => {
      // 优先 .flex-fill（Bootstrap 5）
      const flexFill = row.querySelector('.flex-fill')
      if (flexFill) {
        const text = cleanText(flexFill.textContent || '')
        if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
          tryPush(text)
          return
        }
      }
      // 其次 .d-flex
      const dFlex = row.querySelector('.d-flex')
      if (dFlex) {
        const text = cleanText(dFlex.textContent || '')
        if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
          tryPush(text)
          return
        }
      }
      // 其次 label
      const label = row.querySelector('label')
      if (label) {
        const text = cleanText(label.textContent || '')
        if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
          tryPush(text)
          return
        }
      }
      // 最后整个 row（可能包含拆分的 A + 内容）
      const text = cleanText(row.textContent || '')
      if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
        tryPush(text)
      }
    })
    if (options.length >= 2) return options
  }

  // 策略C：.answer 内的所有 label（按顺序）
  const answerLabels = element.querySelectorAll('.answer label')
  if (answerLabels.length > 0) {
    answerLabels.forEach(label => {
      const text = cleanText(label.textContent || '')
      if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
        tryPush(text)
      }
    })
    if (options.length >= 2) return options
  }

  // 策略D：.answer 内的直接子元素（按顺序）
  const answerDiv = element.querySelector('.answer')
  if (answerDiv) {
    const children = answerDiv.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const text = cleanText(child.textContent || '')
      if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
        tryPush(text)
      }
    }
    if (options.length >= 2) return options
  }

  // 策略E：全局 label 扫描（兜底）
  const allLabels = element.querySelectorAll('label')
  allLabels.forEach(label => {
    const text = cleanText(label.textContent || '')
    if (text && !PLACEHOLDER_TEXTS.has(text.trim())) {
      tryPush(text)
    }
  })

  return options
}

/**
 * 提取判断题选项
 */
function extractTrueFalseOptions(element: Element): string[] {
  const options: string[] = []
  const seen = new Set<string>()

  const tryPush = (text: string) => {
    if (!text) return
    const norm = text.toLowerCase().trim()
    if (seen.has(norm)) return
    seen.add(norm)
    options.push(text.trim())
  }

  // 策略1：label[for] 关联
  element.querySelectorAll('input[type="radio"]').forEach(radio => {
    const id = (radio as HTMLInputElement).id
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label) {
        const t = cleanText(label.textContent || '')
        if (t) tryPush(t)
      }
    }
  })
  if (options.length >= 2) return options

  // 策略2：找包含"对"/"错"文字
  element.querySelectorAll('label').forEach(label => {
    const t = cleanText(label.textContent || '')
    if (t === '对' || t === '错' || t === '正确' || t === '错误' || t === 'true' || t === 'false') {
      tryPush(t)
    }
  })
  if (options.length >= 2) return options

  // 兜底
  return ['对', '错']
}

// ============ 多小题处理 ============

/**
 * 检测是否是综合题（含子题）
 * 参考 XueHua-s/ouchn-learn 的 hasAnalysisSubQuestions
 */
function hasSubSubjects(element: Element): boolean {
  const classStr = (element.className || '').toString()
  if (classStr.includes(OUCHN_ANALYSIS_CLASS)) {
    return element.querySelectorAll(OUCHN_SUB_SUBJECT_SELECTOR).length > 0
  }
  return false
}

/**
 * 提取综合题的子题
 * 参考 XueHua-s/ouchn-learn 的 extractAnalysisSubQuestions
 */
function extractSubQuestions(parentElement: Element, parentIndex: number): Question[] {
  const questions: Question[] = []

  // 获取父题描述（阅读材料）
  const parentDescEl = parentElement.querySelector(OUCHN_DESCRIPTION_SELECTOR) ||
                       parentElement.querySelector(MOODLE_QTEXT_SELECTOR)
  const parentDescription = cleanText(parentDescEl?.textContent || '')

  // 截断父材料（避免 token 过长）
  const truncatedParentDesc = parentDescription.length > 800
    ? parentDescription.substring(0, 800) + '…[材料截断]'
    : parentDescription

  const subElements = parentElement.querySelectorAll(OUCHN_SUB_SUBJECT_SELECTOR)

  subElements.forEach((subEl, idx) => {
    const subIndex = idx + 1
    const type = detectQuestionType(subEl)

    // 子题描述
    const subDescEl = subEl.querySelector(OUCHN_DESCRIPTION_SELECTOR) ||
                      subEl.querySelector(MOODLE_QTEXT_SELECTOR)
    const subDescription = cleanText(subDescEl?.textContent || '')

    // 合并父材料 + 子题描述
    const description = [truncatedParentDesc, subDescription].filter(Boolean).join('\n\n')

    // 提取选项
    let options: string[] = []
    if (type === '判断题') {
      options = extractTrueFalseOptions(subEl)
    } else {
      options = extractChoiceOptions(subEl)
    }

    questions.push({
      number: parentIndex * 1000 + subIndex, // 参考：parentIndex * SUB_INDEX_MULTIPLIER + subIndex
      text: description,
      type: options.length > 0 && type === '未知题型' ? '单选题' : type,
      options,
    })
  })

  return questions
}

// ============ 主提取逻辑 ============

function isRealQuestion(element: Element): boolean {
  try {
    if (!element) return false
    const classStr = (element.className || '').toString()
    // 说明类跳过
    if (classStr.includes('description')) return false
    // 只要有任何答题输入形式就算题目
    return !!(
      element.querySelector('.answer') ||
      element.querySelector('.option') ||
      element.querySelector(OUCHN_SUB_SUBJECT_SELECTOR) ||
      element.querySelector('input[type="radio"]') ||
      element.querySelector('input[type="checkbox"]') ||
      element.querySelector('input[type="text"]') ||
      element.querySelector('textarea') ||
      element.querySelector('select')
    )
  } catch {
    return false
  }
}

function buildQuestion(element: Element, index: number): Question | null {
  try {
    if (!isRealQuestion(element)) return null

    // 获取题目文本
    const qtextEl = element.querySelector(MOODLE_QTEXT_SELECTOR) ||
                    element.querySelector(OUCHN_DESCRIPTION_SELECTOR)
    const text = cleanText(qtextEl?.textContent || element.textContent || '')
    if (!text) return null

    const type = detectQuestionType(element)

    // 提取选项
    let options: string[] = []
    if (type === '判断题') {
      options = extractTrueFalseOptions(element)
    } else if (type === '单选题' || type === '多选题' || type === '未知题型') {
      options = extractChoiceOptions(element)
    }

    return {
      number: index,
      text,
      type: options.length > 0 && type === '未知题型' ? '单选题' : type,
      options,
    }
  } catch {
    return null
  }
}

export class QuizExtractorService {
  isQuizPage(): boolean {
    try {
      return !!(window?.location?.href?.includes(QUIZ_URL_PATTERN))
    } catch {
      return false
    }
  }

  extractQuestions(mode: 'smart' | 'brute' | 'ultra'): ExtractResult {
    try {
      if (typeof document === 'undefined') {
        return { success: false, count: 0, message: 'DOM 不可用', questions: [] }
      }

      // 收集题目元素（兼容 Moodle 和 OUCHN）
      let elements: Element[] = []

      if (mode === 'smart') {
        elements = Array.from(document.querySelectorAll(`${MOODLE_SUBJECT_SELECTOR}, ${OUCHN_SUBJECT_SELECTOR}`))
      } else if (mode === 'brute') {
        elements = Array.from(document.querySelectorAll(`${MOODLE_SUBJECT_SELECTOR}, ${OUCHN_SUBJECT_SELECTOR}, [class*="question"]`))
      } else {
        // ultra: 更多选择器
        const selectors = [
          MOODLE_SUBJECT_SELECTOR,
          OUCHN_SUBJECT_SELECTOR,
          '[class*="question"]',
          '[id*="question"]',
        ]
        const seenKeys = new Set<string>()
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const key = el.getAttribute('id') || el.className + (el.textContent || '').substring(0, 50)
            if (!seenKeys.has(key)) {
              seenKeys.add(key)
              elements.push(el)
            }
          })
        })
      }

      const questions: Question[] = []
      let rawIndex = 0

      elements.forEach((element) => {
        rawIndex++

        // 检测是否是综合题（含子题）
        if (hasSubSubjects(element)) {
          const subQuestions = extractSubQuestions(element, rawIndex)
          if (subQuestions.length > 0) {
            questions.push(...subQuestions)
            return
          }
        }

        const q = buildQuestion(element, questions.length + 1)
        if (q) {
          questions.push(q)
        }
      })

      return {
        success: true,
        count: questions.length,
        message: questions.length > 0
          ? `找到 ${questions.length} 道题目`
          : '未找到任何题目（请确认在答题页）',
        questions,
      }
    } catch (error) {
      return {
        success: false,
        count: 0,
        message: `提取失败: ${error instanceof Error ? error.message : String(error)}`,
        questions: [],
      }
    }
  }

  formatQuestions(questions: Question[]): string {
    try {
      if (!questions?.length) return ''
      const parts: string[] = []
      questions.forEach(q => {
        // 子题显示为 "21.1" 格式
        const displayNum = q.number >= 1000
          ? `${Math.floor(q.number / 1000)}.${q.number % 1000}`
          : String(q.number)

        parts.push(`${displayNum}. [${q.type}] ${q.text}`)
        if (q.options?.length) {
          const startCode = 'A'.charCodeAt(0)
          q.options.forEach((opt, i) => {
            parts.push(`  ${String.fromCharCode(startCode + i)}. ${opt}`)
          })
        }
        parts.push('')
      })
      return parts.join('\n').trim()
    } catch {
      return ''
    }
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (!text) return false
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export const quizExtractorService = new QuizExtractorService()
export default quizExtractorService