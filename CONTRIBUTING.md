# 贡献指南

欢迎参与本项目的开发！请在提交贡献前阅读以下指南。

## 代码规范

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 变量 | camelCase | `currentCourse`, `isPlaying` |
| 函数 | camelCase + 动词 | `extractCourses()`, `handleClick()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` |
| 类/类型 | PascalCase | `CourseInfo`, `SemesterInfo` |
| 文件 | kebab-case | `video-manager.ts`, `home-navigator.ts` |
| Vue 组件 | PascalCase | `FloatingPanel.vue`, `HomePanel.vue` |

### TypeScript 规范

- 使用 Composition API (`<script setup>`)
- 类型导入使用 `import type`
- 枚举值导入使用普通 `import`
- 使用 `const` 代替 `let`，除非确实需要重新赋值
- 为函数和变量添加完整的类型注解

### Vue 规范

- 使用 `<script setup>` 语法
- 模板中使用 PascalCase 引用组件
- props 定义使用 `withDefaults` 提供默认值
- 事件命名使用 kebab-case

## 开发流程

### 1. Fork 仓库

首先 Fork 本仓库到你的 GitHub 账户。

### 2. 克隆仓库

```bash
git clone https://github.com/<your-username>/ouchn-course-brusher-script.git
cd ouchn-course-brusher-script
```

### 3. 创建分支

```bash
# 基于 main 分支创建新特性分支
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### 4. 开发

- 在本地进行开发
- 运行构建验证：`npm run build`
- 运行类型检查：`npx vue-tsc --noEmit`

### 5. 提交代码

```bash
# 添加修改
git add .

# 提交（使用 Conventional Commits 格式）
git commit -m "feat: 添加新功能"
# 或
git commit -m "fix: 修复某个 bug"
# 或
git commit -m "docs: 更新文档"
```

### 6. 推送分支

```bash
git push origin feat/your-feature-name
```

### 7. 创建 Pull Request

在 GitHub 上创建 Pull Request，描述你的改动：
- 改动目的
- 修改的文件
- 测试方式
- 相关 issue（如有）

## Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**常用类型：**
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行的变动）
- `refactor`: 重构（既不新增功能，也不是修复 bug）
- `test`: 测试相关
- `chore`: 构建/工具相关

## Pull Request 规范

### 标题

```
<type>: 简短描述
```

### 描述

请包含以下内容：
1. **改动目的**：为什么需要这个改动？
2. **实现方式**：如何实现的？
3. **测试验证**：如何验证改动正确？
4. **相关 issue**：关联的 issue 编号（如有）

## 代码审查

提交 PR 后，请等待维护者审查。审查通过后会合并到主分支。

## 注意事项

1. **不要提交未完成的代码**：确保你的改动可以正常构建和运行
2. **保持 PR 简洁**：每个 PR 只解决一个问题或添加一个功能
3. **更新文档**：如果改动影响了使用方式，请更新 README.md 或相关文档
4. **添加测试**：如果是新功能，请添加相应的测试用例
5. **遵守许可证**：所有贡献都必须遵循 MIT 许可证

## 问题反馈

如果在开发过程中遇到问题，欢迎在 GitHub Issues 中提出。

---

感谢你的贡献！🎉