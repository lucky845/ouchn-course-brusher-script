---
trigger: manual
---

# 命名约定规范 v1.0

## 启用的约定

### [约定 1] 变量命名
- 使用描述性、有意义的名称
- 避免单字母名称（除迭代器 i、j、k）
- 布尔变量使用 is/has/can/should 开头
- JavaScript/TypeScript：camelCase
- Python：snake_case

### [约定 2] 函数/方法命名
- 使用动词或动词短语
- 返回布尔值的函数以 is/has/can/should 开头
- 事件处理器以 handle/on 开头
- JavaScript/TypeScript：camelCase
- Python：snake_case

### [约定 3] 类命名
- 使用 PascalCase
- 使用名词或名词短语
- 避免通用名称如 Manager、Helper、Util

### [约定 4] 常量命名
- 使用 UPPER_SNAKE_CASE
- 在对象/枚举中分组相关常量

### [约定 5] 文件命名
- JavaScript/TypeScript：kebab-case
- Python：snake_case
- 测试文件使用 .test 或 .spec 后缀

### [约定 9] 环境变量命名
- 使用 UPPER_SNAKE_CASE
- 使用应用/服务名称前缀

## 语言特定摘要

JavaScript/TypeScript：
- 变量：camelCase
- 函数：camelCase
- 类：PascalCase
- 常量：UPPER_SNAKE_CASE
- 文件：kebab-case

Python：
- 变量：snake_case
- 函数：snake_case
- 类：PascalCase
- 常量：UPPER_SNAKE_CASE
- 文件：snake_case

## 项目类型配置

Web 应用：
- 启用：[1, 2, 3, 4, 5, 9]

CLI 工具：
- 启用：[1, 2, 3, 4, 5, 9]

库/SDK：
- 启用：[1, 2, 3, 4, 5, 9]
