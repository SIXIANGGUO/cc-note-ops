# CC Note Ops

把 Obsidian 当前笔记变成 Claude Code 可直接操作的内容工作台。

CC Note Ops 不是一个只好看的仪表盘。它会识别你当前打开的 Markdown 笔记，展示源笔记信息，提供一键内容操作，并把结果写回 Obsidian vault。你也可以把源笔记路径或改写提示词复制给 Obsidian 底部的 Claude Code 终端，继续人工接管。

我会在 X 持续分享 CC Note Ops、Claude Code、Obsidian 内容工作流和 AI 创作自动化的实战更新：[@buhuaguo1](https://x.com/buhuaguo1)。

## 功能

- 源笔记识别：锁定当前 Markdown 笔记，避免生成结果页抢走操作目标。
- 跟随预览：操作台里的内容预览会跟随源笔记滚动位置变化。
- 运行状态：点击按钮后显示正在运行、已耗时、完成或失败原因。
- 一键输出：公众号改写、小红书拆条、选题池、摘要路标。
- 一键修改：润色原文、补标签和双链，修改前自动备份。
- 文风模板：表达型按钮会读取当前选择的模板，支持沉淀自己的账号文风。
- RSS 日报：打开工作台时按内置源池生成中文 Markdown AI 早报，展示重点、快讯和 X 创作候选。
- Claude Code 集成：通过本机 `claude -p` 后台执行任务。
- Terminal 配合：保留 Obsidian Terminal 插件里的连续 Claude Code 会话。
- 本土化内容流：默认面向公众号、小红书、朋友圈、即刻等中文内容场景。

## 适合谁

- 用 Obsidian 管理素材、笔记和选题的创作者。
- 已经安装 Claude Code，希望让 AI 直接处理当前笔记的人。
- 想把一篇笔记快速变成公众号文章、小红书内容、选题池或知识库路标的人。

## 预览

当前版本主打可用性，既支持主题切换，也把常用内容动作集中到一个工作台里：

![CC Note Ops 主工作台](docs/assets/screenshots/workbench-main-functions.png)

主题可以在工作台内直接切换：

![主题切换演示](docs/assets/screenshots/theme-switching.gif)

![一键操作和 Claude Code 接管入口](docs/assets/screenshots/workbench-actions-bridge.png)

![RSS 日报和 X 创作候选](docs/assets/screenshots/workbench-rss-daily.png)

- 顶部显示当前连接状态。
- 中部显示源笔记信息和跟随滚动的内容预览。
- 下方提供一键操作卡片。
- 底部提供 RSS 日报入口，方便从中文早报进入选题、链接复制和 X 创作提示词。
- 额外保留“给 Claude”复制入口，方便在任意 Terminal 面板里手动接管。

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

如果你下载的是 GitHub Release 压缩包，解压后同样进入目录运行上面的安装命令即可。仓库内置插件模块、默认 RSS 源池和 vault 模板，安装脚本会一次性复制到你的 Obsidian vault。

把 `"/path/to/your/ObsidianVault"` 换成你的 Obsidian 笔记库路径。

用户下载或克隆仓库并运行上面这条安装命令，就可以得到和项目维护者本机一致的工作台、默认 RSS 日报源池、Markdown 日报目录和按钮模板。不需要额外配置 RSS 源。

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

点击后，工作台会出现“运行状态”区域。Claude Code 正在处理时，请等状态变成完成或失败；本地 Ollama 慢模型可能需要十几分钟。

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

### 文风模板

操作台内置 4 套文风模板：

- 均衡清晰
- 不滑锅观点流
- 上镜口播
- 专业教程

模板文件在：

```text
.cc-command-center/profiles/
```

你可以直接编辑这些 Markdown 文件，保存自己的公众号文风、小红书文风或口播风格。

文风只作用于表达型任务：

| 会读取文风 | 不读取文风 |
|------------|------------|
| 公众号改写、小红书拆条、备份后润色原文 | 提炼选题、摘要路标、补标签双链 |

结构化任务不会跟文风联动，因为它们更像整理、归档和知识库维护动作。

### RSS 日报

工作台底部会自动生成一份中文 Markdown 日报。安装脚本会把默认源池写入当前 vault：

```text
.cc-command-center/rss-sources.json
```

日报输出位置：

```text
控制中心/资料入口/RSS日报/YYYY-MM-DD-daily-brief.md
```

默认源池来自当前 RSS 自动化日报的精选分类，不是普通英文 feed 列表：

| 分类 | 示例来源 |
|------|----------|
| AI 产品更新 | AI 产品更新搜索、OpenAI News、Google Blog |
| AI 工具 / Agent / LLM | AWS Machine Learning、Google DeepMind、Last Week in AI |
| 中文独立博客 / 社区 | 36氪、V2EX 程序员、少数派 |
| 精选 Newsletter | HelloGitHub、DevNow、透明日报、好工具周刊 |
| 中文 AI / KOL | 遥行 Gofurther、謝懿Shine AI博客 |

生成出的 Markdown 结构沿用当前自动化日报：

```text
# AI 早报 · YYYY-MM-DD
## 今日最重要的 3 件事
## 快讯
## 跟踪清单
## X 创作候选
```

你也可以继续编辑 `rss-sources.json`，替换或增删自己的信息源。配置格式：

```json
{
  "sources": [
    {
      "id": "v2ex-programmer",
      "label": "V2EX - 程序员",
      "category": "cn-independent-blogs",
      "url": "http://www.v2ex.com/feed/programmer.xml",
      "enabled": true
    }
  ]
}
```

工作台打开时会按配置抓取 RSS 或 Atom，先渲染成 Markdown 日报，再把摘要缓存到：

```text
.cc-command-center/rss-cache/YYYY-MM-DD-rss-brief.json
```

默认展示：

| 区域 | 用途 |
|------|------|
| 今日最重要 | 快速判断今天最值得追的 3 个素材 |
| 快讯速览 | 按自动化日报分类浏览产品、工具、社区和海外动态 |
| X 创作候选 | 直接生成可发布的 X 推文和配图提示词 |

点击“刷新信息源”会立即重新拉取已启用的 RSS 源，并重写当天 Markdown 日报。默认会使用 6 小时缓存，避免每次打开工作台都重复请求。

如果升级前你的 `rss-sources.json` 仍是 `example.com` 占位模板，或上一版英文 starter feed，安装脚本会先备份旧文件，再替换成新的中文日报源池；如果你已经自定义过源，安装脚本会保留你的文件。

如果你已经有自己的外部日报生成器，也可以在插件 `data.json` 的 `rssFeed` 字段里配置兼容模式：

```json
{
  "rssFeed": {
    "externalBriefsDir": "/path/to/briefs",
    "externalDailyScript": "/path/to/daily_monitor.sh"
  }
}
```

配置后，插件会优先读取 `externalBriefsDir` 里的 `YYYY-MM-DD-daily-brief.md`；点击刷新时会运行 `externalDailyScript`。

### 代理环境

Obsidian 是 GUI 应用，它启动后台命令时不一定继承你系统终端里的代理环境。

如果你需要让按钮后台调用 Claude Code 时显式使用代理，可以创建：

```text
.cc-command-center/proxy.env
```

示例：

```bash
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
ALL_PROXY=socks5://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1
```

这个文件只负责把标准 proxy 环境变量传给后台 `claude` 命令。它不会保证账号安全，也不会替你绕过任何服务条款。请按你自己的网络环境和服务规则使用。

## 和 Terminal 插件的关系

按钮任务会在后台独立调用 Claude Code：

```bash
claude -p "..."
```

所以底部 Terminal 不会跟着滚动，也不会显示按钮任务过程。

默认最长等待时间是 45 分钟。使用本地 Ollama 或长文输入时，如果仍然不够，可以修改：

```text
.obsidian/plugins/cc-command-center/data.json
```

把 `actionTimeoutMinutes` 调大。

Terminal 插件更适合连续对话。建议在 Terminal 里进入 vault 根目录，然后运行：

```bash
claude
```

如果你想让 Terminal 里的 Claude Code 手动处理某篇笔记，可以在操作台点击：

- 复制相对路径
- 复制完整路径
- 复制改写提示词

再粘贴到 Terminal 里的 Claude Code 会话。

## 自定义按钮

默认按钮配置在：

```text
plugin/cc-command-center/data.json
```

每个按钮的提示词模板在：

```text
vault/.cc-command-center/actions/
```

每个按钮会调用隐藏脚本：

```text
vault/.cc-command-center/scripts/note-action.sh
```

安装到 vault 后，对应路径是：

```text
.obsidian/plugins/cc-command-center/data.json
.cc-command-center/actions/
.cc-command-center/scripts/note-action.sh
```

多数情况下，只需要改 `.cc-command-center/actions/` 里的 Markdown 模板，不需要改脚本。

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
- 可选代理只读取 `.cc-command-center/proxy.env` 里的标准 proxy 变量，不会执行任意 shell 代码。

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
│       ├── prompts.js
│       ├── rss-brief.js
│       ├── settings.js
│       ├── manifest.json
│       ├── styles.css
│       └── view-utils.js
├── scripts/
│   ├── package.sh
│   ├── install.sh
│   └── uninstall.sh
└── vault/
    ├── .cc-command-center/
    │   ├── rss-sources.json
    │   ├── actions/
    │   ├── profiles/
    │   ├── proxy.env.example
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
