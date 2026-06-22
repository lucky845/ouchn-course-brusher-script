---
trigger: manual
---

# 规范索引 v1.0

## 全局配置
GLOBAL:
  DEFAULT_PROFILE: Web
  ENABLE_MODULES:
    requirements-spec.zh-CN.md: ENABLED
    workflow-spec.zh-CN.md: ENABLED
    naming-conventions.zh-CN.md: ENABLED

## 启用的模块

### requirements-spec.zh-CN.md
- 13 条通用编码规则
- 关注点：完整性、复用、最小依赖、正确性、编译/运行

### workflow-spec.zh-CN.md
- 6 条工作流规则
- 关注点：变更日志、版本管理、文档同步、破坏性变更、依赖更新、错误处理

### naming-conventions.zh-CN.md
- 6 条命名约定
- 关注点：变量、函数、类、常量、文件、环境变量命名

## 项目配置

### 代码压缩配置
- 打包配置：必须使用 Terser 压缩，配置 max_line_len: 800 并正则保护 ==UserScript== 注释，严禁产出单行超长代码。

PROFILE: Web
  REQUIREMENTS: [1, 2, 3, 5, 6, 7, 10, 11, 12, 13]
  WORKFLOW: [1, 2, 6, 9, 10, 12]
  NAMING: [1, 2, 3, 4, 5, 9]
