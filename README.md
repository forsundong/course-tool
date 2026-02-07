# Merton Course Path Extractor

这是一个专为内容开发人员设计的专业工具，用于快速从 Merton API 提取 KEY 值、场景名、演算板名和知识点。

## 🚀 快速开始 (本地开发)

1. **安装依赖**:
   ```bash
   npm install
   ```
2. **启动开发服务器**:
   ```bash
   npm run dev
   ```

## 🛠 命令行部署流程

如果您需要将代码同步到 GitHub：

```bash
# 添加所有更改
git add .
# 提交更改
git commit -m "update: 优化路径配置"
# 推送至 GitHub (Actions 会自动接管部署)
git push origin main
```

## 📦 自动部署说明
本项目配置了 GitHub Actions (`.github/workflows/deploy.yml`)。
每当您执行 `git push` 后，GitHub 会自动运行构建任务并在 1-2 分钟内更新您的线上工具页面。

## 功能特点
- **快速提取**：直接输入路径 ID 即可获取结构化信息。
- **本地分析**：支持上传本地 JSON 文件进行离线分析。
- **路径对比**：支持多个路径 ID 并行比对，自动标记重复 KEY。
- **一键导出**：支持导出 CSV 表格以便后续处理。
