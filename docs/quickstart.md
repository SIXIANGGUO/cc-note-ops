# 快速开始

这份文档假设你已经安装了 Obsidian 和 Claude Code CLI。

## 1. 下载项目

```bash
git clone https://github.com/SIXIANGGUO/cc-note-ops.git
cd cc-note-ops
```

如果你拿到的是压缩包，先解压并进入目录。

## 2. 安装到 Obsidian vault

```bash
bash scripts/install.sh "/path/to/your/ObsidianVault"
```

把路径换成你的 vault 路径，例如：

```bash
bash scripts/install.sh "$HOME/Obsidian"
```

安装脚本会做四件事：

1. 安装插件到 `.obsidian/plugins/cc-command-center/`。
2. 复制 `控制中心/`，作为用户可见入口。
3. 复制 `.cc-command-center/`，作为隐藏运行目录。
4. 保留你已有的同名笔记文件，避免覆盖旧内容。

## 3. 启用插件

在 Obsidian 中：

1. 打开 `Settings`。
2. 进入 `Community plugins`。
3. 允许社区插件。
4. 启用 `CC Command Center`。
5. 打开命令面板，运行 `打开当前笔记操作台`。

## 4. 配合 Terminal 插件

视频里那种 Claude Code 命令端，通常靠 Obsidian 社区插件 `Terminal` 实现。

建议这样设置：

1. 打开 `Settings -> Community plugins -> Browse`。
2. 搜索并安装 `Terminal`。
3. 把 Terminal 面板拖到底部。
4. 在终端里进入你的 vault 根目录。
5. 运行：

```bash
claude
```

按钮任务会后台独立运行，不占用 Terminal。Terminal 适合连续对话和人工接管。

## 5. 验证按钮

先打开任意一篇 Markdown 笔记，再打开操作台。

点击 `提炼选题`，确认生成：

```text
控制中心/运行结果/当前笔记/你的笔记名-选题池.md
```

再点击 `小红书拆条`，确认生成结果里包含：

- 标题
- 正文
- 配图方向
- 生图提示词
- 画面文案
- 话题标签
- 适合平台

## 6. 常见问题

### 提示 Claude Code CLI 未找到

先在系统终端或 Obsidian Terminal 里运行：

```bash
claude --help
```

如果系统终端能运行，但 Obsidian 里不能运行，通常是 GUI App 的 `PATH` 比终端短。当前脚本会尝试这些路径：

```text
$HOME/.local/bin/claude
/opt/homebrew/bin/claude
/usr/local/bin/claude
```

如果你的 Claude Code 安装在别的位置，可以编辑：

```text
.cc-command-center/scripts/note-action.sh
```

### 点击输出后操作台变成结果页怎么办

这是正常现象。插件会继续锁定原来的源笔记，后续按钮仍然针对源笔记运行。

### 左侧 Claude Code 没反应

按钮任务不会复用左侧或底部 Terminal 里的 Claude Code 会话。它会后台启动独立进程。

如果想让 Terminal 里的 Claude Code 接管，点击操作台里的 `复制相对路径` 或 `复制改写提示词`，再粘贴给 Terminal。

## 7. 卸载

保留生成内容：

```bash
bash scripts/uninstall.sh "/path/to/your/ObsidianVault"
```

连 `控制中心/` 一起删除：

```bash
bash scripts/uninstall.sh "/path/to/your/ObsidianVault" --remove-content
```
