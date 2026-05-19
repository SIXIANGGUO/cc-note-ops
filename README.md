# CC Note Ops

把 Obsidian 当前笔记变成 Claude Code 可直接操作的内容工作台。

CC Note Ops 不是一个只好看的仪表盘。它会识别你当前打开的 Markdown 笔记，展示源笔记信息，提供一键内容操作，并把结果写回 Obsidian vault。你也可以把源笔记路径或改写提示词复制给 Obsidian 底部的 Claude Code 终端，继续人工接管。

## 功能

- 源笔记识别：锁定当前 Markdown 笔记，避免生成结果页抢走操作目标。
- 跟随预览：操作台里的内容预览会跟随源笔记滚动位置变化。
- 一键输出：公众号改写、小红书拆条、选题池、摘要路标。
- 一键修改：润色原文、补标签和双链，修改前自动备份。
- Claude Code 集成：通过本机 `claude -p` 后台执行任务。
- Terminal 配合：保留 Obsidian Terminal 插件里的连续 Claude Code 会话。
- 本土化内容流：默认面向公众号、小红书、朋友圈、即刻等中文内容场景。

## 适合谁

- 用 Obsidian 管理素材、笔记和选题的创作者。
- 已经安装 Claude Code，希望让 AI 直接处理当前笔记的人。
- 想把一篇笔记快速变成公众号文章、小红书内容、选题池或知识库路标的人。

## 预览

当前版本主打可用性，界面采用暗色操作台风格：

- 顶部显示当前连接状态。
- 中部显示源笔记信息和跟随滚动的内容预览。
- 下方提供一键操作卡片。
- 额外提供“给左侧 Claude”复制入口，方便手动接管。

## 准备工作

你需要先准备：

1. Obsidian
   - 下载地址：https://obsidian.md/download
2. Claude Code CLI
   - 官方文档：https://docs.anthropic.com/en/docs/claude-code
   - 安装后请确认终端里可以运行：

```bash
claude --help
```

3. Obsidian Terminal 插件
   - 在 Obsidian 的 `Settings -> Community plugins -> Browse` 里搜索 `Terminal` 安装。
   - 这个插件不是必需依赖，但强烈推荐。它让 Claude Code 终端常驻在 Obsidian 底部。

## 安装

克隆仓库：

```bash
git clone https://github.com/SIXIANGGUO/cc-note-ops.git
cd cc-note-ops
```

运行安装脚本：

```bash
bash scripts/install.sh "/path/to/your/ObsidianVault"
```

把 `"/path/to/your/ObsidianVault"` 换成你的 Obsidian 笔记库路径。

安装脚本会复制：

| 内容 | 目标位置 |
|------|----------|
| Obsidian 插件 | `.obsidian/plugins/cc-command-center/` |
| 可见工作台 | `控制中心/` |
| 隐藏运行脚本 | `.cc-command-center/` |

然后重启 Obsidian，在 `Settings -> Community plugins` 里启用 `CC Command Center`。

## 使用

1. 打开一篇 Markdown 笔记。
2. 打开命令面板，运行 `打开当前笔记操作台`。
3. 点击需要的按钮。

### 输出类按钮

输出类按钮会生成新文件，不修改原文：

| 按钮 | 输出 |
|------|------|
| 公众号改写 | 一篇完整公众号文章 |
| 小红书拆条 | 5 条短内容，包含配图方向和可复制生图提示词 |
| 提炼选题 | 公众号、视频号/B站、小红书选题池 |
| 摘要路标 | 摘要、关键词、标签、双链建议和下一步动作 |

输出位置：

```text
控制中心/运行结果/当前笔记/
```

### 修改类按钮

修改类按钮会先备份，再修改源笔记：

| 按钮 | 效果 |
|------|------|
| 备份后润色原文 | 优化表达、段落节奏和标题层级 |
| 补标签双链 | 补 frontmatter、摘要、标签和 Obsidian 双链 |

备份位置：

```text
控制中心/备份/
```

### 小红书配图提示词

“小红书拆条”会为每条内容输出一个可复制的生图提示词，默认面向中文信息图：

- 3:4 竖版
- 简体中文
- 标题区、列表区、结论区等明确结构
- 不编造数据
- 不复刻真实品牌 Logo 或名人肖像

你可以把提示词直接发给 Gemini、ChatGPT、即梦、豆包等生图模型。

## 和 Terminal 插件的关系

按钮任务会在后台独立调用 Claude Code：

```bash
claude -p "..."
```

所以底部 Terminal 不会跟着滚动，也不会显示按钮任务过程。

Terminal 插件更适合连续对话。建议在 Terminal 里进入 vault 根目录，然后运行：

```bash
claude
```

如果你想让左侧 Claude Code 手动处理某篇笔记，可以在操作台点击：

- 复制相对路径
- 复制完整路径
- 复制改写提示词

再粘贴到 Terminal 里的 Claude Code 会话。

## 自定义按钮

默认按钮配置在：

```text
plugin/cc-command-center/data.json
```

每个按钮会调用隐藏脚本：

```text
vault/.cc-command-center/scripts/note-action.sh
```

安装到 vault 后，对应路径是：

```text
.obsidian/plugins/cc-command-center/data.json
.cc-command-center/scripts/note-action.sh
```

你可以修改脚本里的 prompt，把它改成自己的内容工作流。

## 卸载

保留 `控制中心/` 里的运行结果，只删除插件和隐藏脚本：

```bash
bash scripts/uninstall.sh "/path/to/your/ObsidianVault"
```

如果确定连 `控制中心/` 一起删除：

```bash
bash scripts/uninstall.sh "/path/to/your/ObsidianVault" --remove-content
```

卸载后建议重启 Obsidian。

## 安全说明

这个项目会在你的本机执行 shell 脚本，并调用本机 Claude Code CLI。启用前请阅读：

- `plugin/cc-command-center/main.js`
- `plugin/cc-command-center/data.json`
- `vault/.cc-command-center/scripts/note-action.sh`

默认设计尽量保守：

- 输出类任务只写入 `控制中心/运行结果/当前笔记/`。
- 修改类任务会先备份原文。
- 不读取网络凭据。
- 不上传你的笔记到项目作者服务器。

但 Claude Code 本身会根据你的 Claude Code 配置工作。请确认你理解 Claude Code 的运行方式后再使用。

## 项目结构

```text
.
├── docs/
│   └── quickstart.md
├── plugin/
│   └── cc-command-center/
│       ├── data.json
│       ├── main.js
│       ├── manifest.json
│       └── styles.css
├── scripts/
│   ├── install.sh
│   └── uninstall.sh
└── vault/
    ├── .cc-command-center/
    │   └── scripts/
    │       └── note-action.sh
    └── 控制中心/
```

## 开发

本项目是一个手写 Obsidian 插件，不需要构建步骤。

修改后可以直接重新安装到测试 vault：

```bash
bash scripts/install.sh "/path/to/test-vault"
```

最小检查：

```bash
node --check plugin/cc-command-center/main.js
jq empty plugin/cc-command-center/manifest.json plugin/cc-command-center/data.json
bash -n scripts/install.sh
bash -n scripts/uninstall.sh
bash -n vault/.cc-command-center/scripts/note-action.sh
```

## License

MIT
