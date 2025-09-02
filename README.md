# QQ Emote Deck（本地表情）

本项目是 QQNT 的本地表情插件，支持自定义表情包管理与发送。

## 功能简介
- 支持本地导入和管理表情包
- 分类管理、最近使用、置顶表情
- 一键发送表情到 QQ 聊天窗口
- 支持自定义设置页面

## 目录结构
```
assets/         # 插件资源文件（如图标）
manifest.json   # 插件元数据
src/            # 插件主代码
  main.js       # 主进程逻辑
  preload.js    # 预加载脚本
  renderer.js   # 前端渲染逻辑
  settings.html # 设置页面
```

## 使用方法
1. 将插件文件放入 QQNT 插件目录
2. 启动 QQNT，进入插件设置页面进行配置

## 许可证
MIT License