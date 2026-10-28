# 🎓 OUCHN Course Brusher Script

国家开放大学实验学院自动刷课脚本（油猴脚本）

基于 Vue 3 + TypeScript 重构的 Moodle 平台自动化学习辅助脚本，支持视频自动播放、进度追踪、答题提取、课程管理等功能。

[![GitHub release](https://img.shields.io/github/v/release/lucky845/ouchn-course-brusher-script?include_prereleases&label=Latest%20Release)](https://github.com/lucky845/ouchn-course-brusher-script/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/lucky845/ouchn-course-brusher-script)](https://github.com/lucky845/ouchn-course-brusher-script/commits/main)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/lucky845/ouchn-course-brusher-script/blob/main/LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.4+-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

> **当前版本**：v2.2.5

---

## ✨ 功能特点

### 🎬 刷课功能
| 功能 | 说明 |
|------|------|
| 自动识别学习项目 | 自动检测课程页面中的视频、文档等学习项目 |
| 实时进度显示 | 显示当前学习位置和已刷数量 |
| 本次刷课计时 | 记录本次刷课持续时间 |
| 速度控制 | 支持正常 / 快速 / 低调三种模式 |
| 防息屏 | 防止电脑/手机息屏，方便挂机刷课 |
| 防检测机制 | 模拟真人行为，随机滚动页面 |
| 会话持久化 | 刷新页面后保留刷课统计和已刷数量 |
| 边缘吸附 | 悬浮窗拖拽后可自动吸附到屏幕左/右侧 |

### 📚 课程管理
| 功能 | 说明 |
|------|------|
| 多学期课程展示 | 支持展示所有学期课程，当前学期默认展开 |
| 学期统计卡片 | 显示已完成 / 待办任务 / 总进度等统计信息 |
| 粘性标题 | 滚动时学期标题自动吸顶，方便快速定位 |
| 课程刷新 | 一键刷新课程列表 |
| 快捷导航 | 快速跳转到刷课中心 |

### 📝 答题助手
| 功能 | 说明 |
|------|------|
| 题目提取 | 一键提取答题页面所有题目（单选 / 多选 / 判断 / 完形填空等） |
| 题型智能检测 | 优先识别题型文字，降级 class 匹配 |
| 选项完整提取 | 兼容 OUCHN 和 Moodle 两种 DOM 结构，支持拆分多行选项 |
| 多小题自动拆分 | 综合题 / 应用题自动拆分为独立子题 |
| 一键复制 | 提取的题目自动格式化并复制到剪贴板 |

### 📖 课程详情页面板（v2.2.0 新增）
- **章节导航**：清晰展示课程章节结构，支持折叠 / 展开
- **进度概览**：实时显示课程完成进度和刷课状态
- **书签功能**：保存当前学习位置，方便下次继续
- **内容搜索**：快速搜索课程内的活动项
- **学习提醒**：支持每日 / 每周 / 截止日期提醒
- **跨面板联动**：刷课时自动同步进度到课程详情页面板

### 🛡️ 平台适配（v2.2.3 新增）
- **反调试绕过**：绕过平台对 DevTools 的拦截，保证面板正常显示
- **提前注入时机**：`document-start` 注入，避免被平台重渲染清理
- **悬浮窗自动重建**：SPA 路由监听 + DOM 观察 + 轮询，面板被清理后自动恢复
- **Shadow DOM 隔离**：面板移入 Shadow DOM，防止平台直接清理样式与节点

---

## 🛠 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Vue 3 | Composition API + `<script setup>` | ^3.4 |
| TypeScript | 类型安全 | ^5.4 |
| Vite | 构建打包 | >=6.4 |
| Tampermonkey | 用户脚本运行环境 | — |

---

## 📦 安装方法

### 第一步：安装浏览器扩展
安装 [Tampermonkey（油猴）](https://www.tampermonkey.net/) 浏览器扩展。

### 第二步：安装脚本
点击下方链接直接安装最新版：

[👉 安装最新版脚本](https://github.com/lucky845/ouchn-course-brusher-script/releases/latest/download/ouchn-course-brusher-vue.user.js)

或前往 [Releases 页面](https://github.com/lucky845/ouchn-course-brusher-script/releases) 查看所有历史版本。

---

## 🚀 使用方法

### 刷课
1. 登录国家开放大学实验学院 Moodle 平台
2. 进入课程页面
3. 点击悬浮的 🎓 按钮打开控制面板
4. 选择速度模式（正常 / 快速 / 低调）
5. 点击「开始」按钮启动自动刷课

### 课程管理
1. 进入学习中心页面
2. 点击悬浮的 📊 按钮打开课程管理面板
3. 查看各学期课程列表和统计信息
4. 点击「去学习」按钮跳转到课程页面
5. 点击「刷新」按钮更新课程列表

### 提取题目
1. 进入答题页面
2. 点击悬浮的 📝 按钮
3. 题目自动提取并复制到剪贴板

---

## 🖥 控制面板说明

### 刷课面板

| 功能 | 说明 |
|------|------|
| 本次 N 个 | 本次会话已完成的课程数（跨页面保持） |
| 本次时间 | 本次刷课持续时长 |
| 速度模式 | 正常 / 快速 / 低调三种速度可选 |
| 视频倍速 | 仅快速模式下生效，支持 1x / 1.5x / 2x / 3x |
| 防息屏 | 开启后防止息屏 |
| 防检测 | 开启后模拟真人行为 |

### 课程管理面板

| 功能 | 说明 |
|------|------|
| 已完成 | 当前学期已完成的课程数 |
| 待办任务 | 当前学期待完成的测验 / 作业任务总数 |
| 总进度 | 当前学期总体完成百分比 |
| 学期列表 | 所有学期课程，可折叠展开 |
| 刷新 | 刷新课程列表 |
| 刷课中心 | 跳转到刷课中心页面 |

### 答题面板

| 功能 | 说明 |
|------|------|
| 智能提取 | 兼容 OUCHN 和 Moodle DOM 结构 |
| 暴力提取 | 扩大搜索范围，提高提取成功率 |
| 超强提取 | 激进策略，适合复杂页面 |

---

## 📁 项目结构

```text
course-brushing-script/
├── src/
│   ├── main.ts                      # 入口：页面路由判断、初始化
│   ├── bootstrap.ts                 # 启动流程：面板调度、延迟初始化
│   ├── components/
│   │   ├── FloatingPanel.vue        # 刷课控制面板
│   │   ├── HomePanel.vue            # 课程管理面板（首页）
│   │   ├── CoursePanel.vue          # 课程详情页面板（v2.2.0）
│   │   └── QuizPanel.vue            # 答题助手面板
│   ├── composables/
│   │   └── useDraggablePanel.ts     # 拖拽 / 吸附逻辑复用
│   ├── services/
│   │   ├── videoManager.ts          # 视频播放管理
│   │   ├── sidebarNavigator.ts      # 侧边栏导航
│   │   ├── sidebarStatusInjector.ts # 侧边栏状态注入（v2.2.1）
│   │   ├── homeNavigator.ts         # 课程管理导航
│   │   ├── courseNavigator.ts       # 课程详情页导航（v2.2.0）
│   │   ├── courseProgressStore.ts   # 课程刷课进度共享状态（v2.2.0）
│   │   ├── courseBookmarkStore.ts   # 课程书签存储（v2.2.0）
│   │   ├── contentSearch.ts         # 内容搜索服务（v2.2.0）
│   │   ├── studyReminder.ts         # 学习提醒服务（v2.2.0）
│   │   ├── quizExtractor.ts         # 题目提取
│   │   ├── settingsStore.ts         # 配置持久化
│   │   ├── progressStats.ts         # 进度统计
│   │   ├── wakeLock.ts              # 防息屏
│   │   ├── antiDetection.ts         # 防检测
│   │   └── constants.ts             # 常量定义
│   ├── types/
│   │   └── index.ts                 # 集中管理所有类型
│   └── utils/
│       ├── url.ts                   # URL 解析、页面判断
│       ├── text.ts                  # 文本清理、占位符判断
│       ├── time.ts                  # 时间格式化
│       ├── math.ts                  # 数学计算
│       ├── clipboard.ts             # 剪贴板操作
│       ├── storage.ts               # localStorage 安全读写
│       ├── panel.ts                 # 面板配置统一管理
│       └── logger.ts                # 日志统一管理
├── .github/workflows/
│   └── build-release.yml            # GitHub Actions 构建发布
├── AGENTS.md                        # AI 代理开发指南
├── CHANGELOG.md                     # 更新日志
├── LICENSE                          # MIT 许可证
├── README.md                        # 项目说明
└── dist/ouchn-course-brusher-vue.user.js  # 构建产物
```

---

## 📝 更新日志

完整更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。

---

## ⚠️ 注意事项

- 本脚本仅供个人学习使用
- 请遵守平台使用规则
- 建议开启防检测模式以降低风险

---

## 🤝 如何贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支：`git checkout -b feature/xxx`
3. 提交你的更改：`git commit -m 'feat: xxx'`
4. 推送到分支：`git push origin feature/xxx`
5. 开启一个 Pull Request

请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 提交信息规范。

详细的开发规范、命名约定与提交流程请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)，参与本项目请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

---

## 🔒 安全性

如发现安全漏洞，请按照 [SECURITY.md](SECURITY.md) 中的说明负责任地披露。

---

## 📄 开源协议

[MIT License](LICENSE)

---

## 👤 作者

[lucky845](https://github.com/lucky845)

---

如果这个项目对你有帮助，欢迎给个 ⭐️ Star！