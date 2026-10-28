/**
 * localStorage 存储键集中管理
 *
 * 所有脚本使用的 localStorage key 在此统一声明，便于：
 * - 一眼看清全部持久化数据的用途与当前版本
 * - 版本演进时在此处集中做迁移（key 加 _vN 后缀或新增迁移函数）
 * - 避免分散在业务代码中难以维护
 */

/** 刷课配置（结构已稳定，后缀 v2 表示当前 schema 版本） */
export const SETTINGS_KEY = 'ouchn_brusher_settings_v2'
/** 刷课模式开关（'true'/'false'） */
export const ENABLED_KEY = 'ouchn_brusher_enabled'
/** 本次刷课会话：startTime + itemsDone（跨页跳转保持） */
export const SESSION_KEY = 'ouchn_brusher_session'
/** 所有面板位置（flexible,记忆 Y 轴与边缘吸附） */
export const PANEL_POSITIONS_KEY = 'ouchn_panel_positions'
/** 课程书签 */
export const COURSE_BOOKMARKS_KEY = 'ouchn_course_bookmarks'
/** 课程刷课进度（跨面板共享） */
export const COURSE_PROGRESS_KEY = 'ouchn_course_progress'
/** 课程搜索历史 */
export const COURSE_SEARCH_HISTORY_KEY = 'ouchn_course_search_history'
/** 学习提醒 */
export const STUDY_REMINDERS_KEY = 'ouchn_study_reminders'
/** 测验跳过防死循环守卫记录 */
export const QUIZ_SKIP_GUARD_KEY = 'ouchn_quiz_skip_guard'
/** 面板类型（当前挂载的面板） */
export const PANEL_TYPE_KEY = 'ouchn_brusher_panel'