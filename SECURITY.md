# Security Policy

## Supported Versions

以下版本的项目目前正在接收安全更新：

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.7.x   | :white_check_mark: |
| < 1.7   | :x:                |

## Reporting a Vulnerability

如果您发现安全漏洞，请通过以下方式报告：

### 首选方式：GitHub Security Advisory

1. 访问项目的 [Security](https://github.com/lucky845/ouchn-course-brusher-script/security) 页面
2. 点击 "Report a vulnerability"
3. 填写漏洞详情并提交

### 备用方式：邮件报告

发送邮件至：[lucky845@users.noreply.github.com](mailto:lucky845@users.noreply.github.com)

### 报告内容

请在报告中包含以下信息：
- 漏洞描述
- 影响范围
- 复现步骤
- 潜在危害
- 建议修复方案（可选）

## Response Time

我们承诺在 **48小时** 内回复您的漏洞报告，并在 **7天** 内提供初步评估结果。

## Disclosure Policy

### 协调披露流程

1. **报告确认**：收到漏洞报告后，我们会确认收到并开始评估
2. **漏洞验证**：我们会验证漏洞的真实性和严重性
3. **修复开发**：开发团队会开发并测试修复方案
4. **版本发布**：发布包含修复的新版本
5. **公开披露**：在版本发布后公开漏洞信息

### 安全公告

所有安全修复会在以下渠道发布：
- GitHub Releases
- CHANGELOG.md 文件
- 项目 README.md

## 漏洞分类标准

| 等级 | 描述 | CVSS 分数 |
| ---- | ---- | --------- |
| 严重 (Critical) | 可远程执行代码、权限提升、敏感数据泄露 | 9.0 - 10.0 |
| 高 (High) | 拒绝服务攻击、认证绕过、跨站脚本攻击 | 7.0 - 8.9 |
| 中 (Medium) | 信息泄露、配置缺陷 | 4.0 - 6.9 |
| 低 (Low) | 安全最佳实践违规、轻微信息泄露 | 0.1 - 3.9 |

## 安全最佳实践

### 脚本用户
- 仅从官方 GitHub 仓库下载脚本
- 定期更新脚本到最新版本
- 注意脚本的权限请求（@grant）

### 贡献者
- 代码提交前进行安全审查
- 避免使用不安全的第三方依赖
- 遵循安全编码规范

---

**Last updated**: 2026-06-17