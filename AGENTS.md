# AGENTS.md

> 本文件为 AI 代理提供项目上下文和开发指南，确保代码生成符合项目规范和约定。

## 项目概述

国家开放大学实验学院自动刷课脚本（油猴脚本），基于 Vue 3 + TypeScript 重构，用于 Moodle 平台的自动化学习辅助。

**核心功能**：
- 自动刷课（视频播放控制、进度追踪、防检测）
- 课程管理（多学期展示、进度统计、快捷导航）
- 答题助手（题目提取、题型识别、一键复制）
- **课程详情页助手**（v2.2.0 新增）：章节导航、进度概览、活动管理

**版本**：v2.2.0
**构建产物**：`dist/ouchn-course-brusher-vue.user.js`

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.4.21 | Composition API + `<script setup>` |
| TypeScript | ^5.4.2 | 类型安全 |
| Vite | >=6.4.3 | 构建打包 |
| Terser | ^5.48.0 | 代码压缩 |

## 项目结构

```
src/
├── main.ts              # 入口：页面路由判断、初始化
├── bootstrap.ts         # 启动流程：面板调度、延迟初始化
├── components/          # Vue 组件
│   ├── FloatingPanel.vue    # 刷课控制面板
│   ├── HomePanel.vue        # 课程管理面板（首页）
│   ├── CoursePanel.vue       # 课程详情页面板（v2.2.0）
│   └── QuizPanel.vue        # 答题助手面板
├── composables/         # 组合式函数
│   └── useDraggablePanel.ts # 拖拽/吸附逻辑复用
├── services/            # 业务服务
│   ├── videoManager.ts      # 视频播放管理
│   ├── sidebarNavigator.ts  # 侧边栏导航
│   ├── homeNavigator.ts     # 首页课程管理导航
│   ├── courseNavigator.ts   # 课程详情页导航（v2.2.0）
│   ├── courseProgressStore.ts # 课程刷课进度共享状态（v2.2.0）
│   ├── quizExtractor.ts     # 题目提取
│   ├── settingsStore.ts     # 配置持久化
│   ├── progressStats.ts     # 进度统计
│   ├── wakeLock.ts          # 防息屏
│   ├── antiDetection.ts     # 防检测
│   └── constants.ts         # 常量定义
├── types/               # 类型定义
│   └── index.ts             # 集中管理所有类型
└── utils/               # 工具函数
    ├── url.ts               # URL 解析、页面判断
    ├── text.ts              # 文本清理、占位符判断
    ├── time.ts              # 时间格式化
    ├── math.ts              # 数学计算
    ├── clipboard.ts         # 剪贴板操作
    ├── storage.ts           # localStorage 安全读写
    └── panel.ts             # 面板配置统一管理
```

## 开发规范

本项目遵循 `.trae/rules/` 目录下的规范文件：

### 启用的规范模块

| 规范文件 | 状态 | 关键规则 |
|----------|------|----------|
| `requirements-spec.zh-CN.md` | ENABLED | 完整可运行代码、API 验证、编译保证 |
| `workflow-spec.zh-CN.md` | ENABLED | 变更日志、版本管理、文档同步、错误处理 |
| `naming-conventions.zh-CN.md` | ENABLED | camelCase 变量、PascalCase 类、kebab-case 文件 |
| `security-spec.zh-CN.md` | ENABLED | 输入验证、敏感数据保护、依赖安全 |
| `error-handling-spec.zh-CN.md` | ENABLED | 错误分类、try-catch 最佳实践、全局处理 |

### 规范引用方式

在 AI 对话中引用规范：
```
@.trae/rules/requirements-spec.zh-CN.md
@.trae/rules/workflow-spec.zh-CN.md
@.trae/rules/naming-conventions.zh-CN.md
```

## 约束与约定

### 硬约束（必须遵守）

1. **悬浮窗位置记忆**：只存储 Y 轴位置和边缘（left/right），不存储 X 轴具体数值
2. **课程提取**：默认只提取当前学期课程，使用 `startsWith` 判断学期（不用 `includes`）
3. **进度显示**：必须准确反映课程完成状态，数据质量验证（至少一门课程 progress > 0 或 pendingTasks > 0）

### 工程约定

1. **工具函数提取**：URL 解析、文本处理、时间格式化、剪贴板操作必须抽离到 `src/utils/`
2. **类型集中管理**：所有共享类型定义放在 `src/types/index.ts`
3. **面板配置统一**：尺寸、间距、拖拽阈值集中在 `src/utils/panel.ts`
4. **状态去重**：session 状态统一使用 `settingsStoreService`，不重复定义

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 变量 | camelCase | `currentCourse`, `isPlaying` |
| 函数 | camelCase + 动词 | `extractCourses()`, `handleClick()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` |
| 类/类型 | PascalCase | `CourseInfo`, `SemesterInfo` |
| 文件 | kebab-case | `video-manager.ts`, `home-navigator.ts` |
| Vue 组件 | PascalCase | `FloatingPanel.vue`, `HomePanel.vue` |

### 错误处理约定

- 业务错误：INFO/WARN 级别日志
- 系统错误：ERROR 级别日志 + 重新抛出
- 不允许空 catch 块
- 不在错误消息中暴露敏感信息

## 常见任务指南

### 添加新功能

1. 确定功能归属（组件/服务/工具）
2. 在 `src/types/index.ts` 定义类型
3. 实现功能，复用现有工具函数
4. 更新 `CHANGELOG.md`
5. 运行 `npm run build` 验证

### 修改现有功能

1. 先阅读相关代码，理解上下文
2. 只修改请求的内容，不做额外重构
3. 保持与现有代码风格一致
4. 更新相关注释和文档

### 调试问题

1. 检查 DOM 就绪状态和数据质量
2. 使用 `console.log` 输出中间状态
3. 验证边界情况处理
4. 检查 localStorage 数据格式

## 构建与验证

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npx vue-tsc --noEmit
```

构建产物位于 `dist/ouchn-course-brusher-vue.user.js`。

## 关键文件说明

### [src/types/index.ts](src/types/index.ts)

集中管理的类型：
- `SpeedMode`, `PanelEdge`, `PanelType` - 枚举
- `CourseInfo`, `SemesterInfo` - 首页课程/学期信息
- `ChapterStatus`, `ChapterItem`, `ActivityItem` - 课程详情页章节/活动（v2.2.0）
- `CourseDetailInfo`, `CoursePageState` - 课程详情页状态（v2.2.0）
- `Settings`, `SessionStats`, `ProgressStats` - 状态类型
- `Question`, `QuestionType` - 答题相关

### [src/utils/panel.ts](src/utils/panel.ts)

面板配置：
```typescript
PANEL_CONFIG_MAP: {
  floating: { width: 56, height: 56, margin: 10, dragThreshold: 5 },
  quiz: { width: 56, height: 56, margin: 10, dragThreshold: 5 },
  course: { width: 44, height: 44, margin: 10, dragThreshold: 5 },
}
```

### [src/utils/url.ts](src/utils/url.ts)

URL 工具函数：
- `isCoursePage()` - 判断是否为课程详情页（`/course/view.php`）
- `getCourseId()` - 获取课程 ID
- `getCourseName()` - 获取课程名称

### [src/composables/useDraggablePanel.ts](src/composables/useDraggablePanel.ts)

拖拽逻辑复用：
- `handleMouseDown` - 开始拖拽
- `handleMouseMove` - 拖拽中
- `handleMouseUp` - 结束拖拽，边缘吸附
- `loadPosition` - 加载保存的位置
- `savePosition` - 保存位置（只存 Y 和 edge）

### [src/bootstrap.ts](src/bootstrap.ts)

启动流程：
- 多级延迟初始化（300ms, 800ms, DOMContentLoaded + 500ms）
- 面板类型调度（刷课页/首页/答题页/课程详情页）
- 位置恢复

### [src/services/courseNavigator.ts](src/services/courseNavigator.ts)（v2.2.0）

课程详情页导航服务：
- `extractCourseInfo()` - 提取课程信息
- `extractChapters()` - 提取章节列表
- `scrollToChapter()` - 滚动到指定章节
- `scrollToActivity()` - 滚动到指定活动

### [src/services/courseProgressStore.ts](src/services/courseProgressStore.ts)（v2.2.0）

课程刷课进度共享状态服务：
- `startBrushing()` - 开始刷课，初始化课程进度
- `updateCurrentActivity()` - 更新当前活动
- `markActivityCompleted()` - 标记活动完成
- `stopBrushing()` - 停止刷课
- `syncFromCourseInfo()` - 从课程详情页同步进度
- `subscribe()` - 订阅进度变化通知
- 使用 localStorage 持久化，支持跨面板共享刷课状态

### [src/components/CoursePanel.vue](src/components/CoursePanel.vue)（v2.2.0）

课程详情页助手面板：
- 进度概览（已完成/未完成章节统计）
- 章节导航（可折叠展开）
- 活动列表（点击跳转）
- 快捷操作（展开/折叠/刷新）
- **刷课进度显示**：订阅刷课面板的进度，实时显示当前刷课状态
- **跨面板联动**：刷课时自动同步进度到课程详情页面板

## 已知问题与解决方案

### 悬浮窗角标显示错误数字

**原因**：课程卡片未完全渲染时提取数据，导致非课程元素被误识别

**解决方案**：
1. DOM 就绪检测（`.course-title`、`.progress-bar`、按钮文字）
2. 数据质量验证（至少一门课程有真实进度）
3. 多级重试机制（最多 3 次，间隔 500ms）

### 学期判断误识别

**原因**：使用 `includes('本学期')` 匹配到非课程卡片

**解决方案**：改用 `startsWith('本学期')` 或 `startsWith('当前学期')`

## 版本历史

详见 [CHANGELOG.md](CHANGELOG.md)。

---

**最后更新**：2026-06-18