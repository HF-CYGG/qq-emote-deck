# QQ Emote Deck（本地表情）

本项目是 QQNT 的本地表情插件，提供表情包管理、分类与快捷发送能力。

## 功能亮点
- 本地表情包管理：根目录 + 子文件夹自动分组
- 最近使用与置顶：常用表情快速触达
- 右键菜单保存：聊天图片一键保存到本地表情分类
- 悬停预览：鼠标悬停时显示大图预览
- 发送模式：表情包多发 / 图片发送 / 标准表情
- 自定义快捷键与网格列数

## 支持格式
支持图片格式：.png / .jpg / .jpeg / .gif / .webp / .apng / .bmp  
单张导入大小上限：20MB

## 使用方法
1. 将插件文件放入 QQNT 插件目录
2. 启动 QQNT，进入插件设置页面
3. 选择“本地表情目录”，即可在面板中浏览与发送
4. 点击聊天输入栏左侧的“本地表情”按钮，或使用快捷键打开面板

## 设置项说明
- 本地表情目录：表情库根目录（支持子文件夹分类）
- 调试日志：输出调试信息，便于排查问题
- 显示文件名：在卡片下方显示表情文件名
- 图片右键菜单：启用“保存到本地表情”入口
- 悬停预览：悬停时在右侧显示大图
- 发送模式：多发 / 图片发送 / 标准表情
- 打开/关闭面板快捷键：默认 Alt+E
- 网格列数：设置每行显示数量（2-12）
- 最近使用上限：历史记录最大条数
- 置顶表情上限：允许置顶的最大数量

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

## 开发与检查
```
npm run lint
npm run typecheck
```

## 许可证
MIT License

## 主文件标记

后续复制、打包或排查时，优先关注以下主文件。

| 标记 | 路径 | 作用 |
| --- | --- | --- |
| 主入口 | `manifest.json` | LiteLoaderQQNT 插件清单，声明 slug、图标和注入入口。 |
| 主文件 | `src/main.js` | 主进程逻辑，负责配置读写、表情库索引、文件导入、目录监听、IPC 和剪贴板发送兜底。 |
| 主文件 | `src/preload.js` | 隔离上下文桥接层，向 QQNT 渲染层暴露 `window.localEmote`。 |
| 主文件 | `src/renderer.js` | QQNT 渲染层注入、表情面板、设置页绑定、右键保存菜单和发送交互。 |
| 主文件 | `src/settings.html` | LiteLoader 设置页结构。 |
| 核心模块 | `src/config-utils.js` | 配置默认值、清洗、迁移和插件数据目录解析。 |
| 核心模块 | `src/library-index.js` | 本地表情库递归索引、图片类型校验、`sticker.json` 元数据和路径防护。 |
| 核心模块 | `src/send-engine.js` | `multi`、`image`、`native` 三种发送模式的策略选择和 fallback 结果规范。 |
| 核心模块 | `src/qqnt-adapter-utils.js` | QQNT peer、图片消息元素和 `sendMsg` payload 的可测试适配工具。 |
| 核心模块 | `src/renderer-qqnt-adapter.js` | 渲染层 QQNT 适配门面，集中访问 peer、图片消息发送和编辑器插入能力。 |
| 核心模块 | `src/context-save-utils.js` | 右键保存图片源识别、保存目标目录树、图片魔数和文件名安全处理。 |
| 资源 | `assets/icon.svg` | 插件图标。 |

## 运行版复制清单

复制到 LiteLoaderQQNT 插件目录时，建议最终目录名使用 `local_emotes`，与 `manifest.json` 中的 `slug` 保持一致。

只复制以下文件和目录即可运行：

```text
local_emotes/
├─ manifest.json
├─ assets/
│  └─ icon.svg
└─ src/
   ├─ main.js
   ├─ preload.js
   ├─ renderer.js
   ├─ settings.html
   ├─ config-utils.js
   ├─ library-index.js
   ├─ send-engine.js
   ├─ qqnt-adapter-utils.js
   ├─ renderer-qqnt-adapter.js
   ├─ context-save-utils.js
   └─ globals.d.ts
```

PowerShell 示例：

```powershell
$target = "你的 LiteLoaderQQNT 插件目录\local_emotes"
New-Item -ItemType Directory -Force $target | Out-Null
Copy-Item -Recurse -Force manifest.json, assets, src $target
```

不要把以下内容复制到 QQNT 插件运行目录：

- `.git/`
- `node_modules/`
- `tests/`
- `package-lock.json`
- 临时日志、调试输出、压缩包和系统缓存文件
- 用户选择的本地表情库目录

## 开发版复制清单

如果是迁移到另一台机器继续开发，需要复制完整工程文件：

```text
QQ Emote Deck/
├─ manifest.json
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ README.md
├─ assets/
├─ src/
└─ tests/
```

开发版迁移后执行：

```powershell
npm install
npm test
npm run lint
npm run typecheck
```

## 表情库目录提醒

插件代码目录和用户表情库目录不要混用：

- 插件代码目录：放 `manifest.json`、`assets/`、`src/`，交给 LiteLoaderQQNT 加载。
- 插件数据目录：由 LiteLoader 提供，优先使用 `LiteLoader.plugins.local_emotes.path.data`，用于保存配置和内部数据。
- 用户表情库目录：在设置页“本地表情目录”中选择，只作为图片内容源，不要复制进插件代码目录。

推荐表情库结构：

```text
QQNT本地表情/
├─ 常用/
│  ├─ sticker.json
│  ├─ 001.png
│  └─ 002.gif
├─ 猫猫/
│  ├─ cover.webp
│  └─ happy.webp
└─ single.png
```

`sticker.json` 示例：

```json
{
  "title": "常用",
  "icon": "001.png"
}
```

## 维护边界

- 不要把 QQNT 逆向探测逻辑直接写进 UI 事件；新增兼容逻辑应沉淀到 `src/renderer-qqnt-adapter.js` 或 `src/qqnt-adapter-utils.js`。
- 不要让渲染层临时遍历整个表情目录；应通过 `window.localEmote.getLibraryIndex()` 消费主进程索引。
- 新配置字段必须进入 `src/config-utils.js` 的默认值、清洗和合并流程，避免局部覆盖造成旧字段丢失。
- 调试能力默认关闭；新增全局 hook、定时器或 monkey patch 必须受 `debug` 配置控制。
