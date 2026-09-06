# 随身书架

iPhone / iPad 可用的 EPUB 阅读器(网页应用),支持高亮标记与 DeepSeek AI 问答。

## 特性

- 📖 导入 EPUB,封面/标题/作者自动解析,阅读进度自动记忆
- 🖍 长按选中文字 → 高亮(持久化,跨章节/改字号/重开不丢)
- ✦ 选中文字或点击高亮 → 一键问 DeepSeek(自动带上原文+章节,流式回答,按书保存对话)
- 🎨 字号 4 档、浅色/护眼/夜间主题、章节目录
- 💾 一键备份/恢复(高亮、对话、设置)

## 使用

1. 把本仓库部署到 GitHub Pages(或任何静态托管)
2. iPhone / iPad 用 Safari 打开网址 → 分享 → 「添加到主屏幕」
3. 在「设置」填入 DeepSeek API 密钥(platform.deepseek.com)
4. 导入 .epub 开始阅读

## 本地开发

```
powershell -File tools\serve.ps1     # 打开 http://localhost:8000/
```

纯静态站点,无构建步骤。所有依赖本地化在 vendor/(epub.js 0.3.93 + JSZip 3.10.1)。

## 结构

- `js/main.js` 入口与路由
- `js/shelf/` 书架与导入
- `js/reader/` 阅读器与高亮(CFI 持久化)
- `js/ai/` DeepSeek 调用、聊天面板、对话历史
- `js/storage/` IndexedDB 与设置
- `js/utils/` 备份与 CFI 辅助
- `tools/` 开发工具(本地服务器、图标生成、测试书生成)
