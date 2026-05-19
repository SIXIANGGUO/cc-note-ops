#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "用法: bash .cc-command-center/scripts/note-action.sh <action> <note-path>"
  exit 1
fi

ACTION="$1"
NOTE_REL="$2"
VAULT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NOTE_ABS="$VAULT_ROOT/$NOTE_REL"

if [ ! -f "$NOTE_ABS" ]; then
  echo "找不到当前笔记: $NOTE_REL" >&2
  exit 1
fi

BASE="$(basename "$NOTE_REL" .md)"
STAMP="$(date "+%Y%m%d-%H%M%S")"
OUT_DIR="$VAULT_ROOT/控制中心/运行结果/当前笔记"
BACKUP_DIR="$VAULT_ROOT/控制中心/备份"
mkdir -p "$OUT_DIR" "$BACKUP_DIR"

CLAUDE_BIN=""
resolve_claude() {
  if [ -n "$CLAUDE_BIN" ]; then
    return 0
  fi

  if command -v claude >/dev/null 2>&1; then
    CLAUDE_BIN="$(command -v claude)"
    return 0
  fi

  if [ -x "$HOME/.local/bin/claude" ]; then
    CLAUDE_BIN="$HOME/.local/bin/claude"
    return 0
  fi

  if [ -x "/opt/homebrew/bin/claude" ]; then
    CLAUDE_BIN="/opt/homebrew/bin/claude"
    return 0
  fi

  if [ -x "/usr/local/bin/claude" ]; then
    CLAUDE_BIN="/usr/local/bin/claude"
    return 0
  fi

  CLAUDE_BIN="$(/bin/zsh -lc 'command -v claude' 2>/dev/null || true)"
  if [ -n "$CLAUDE_BIN" ] && [ -x "$CLAUDE_BIN" ]; then
    return 0
  fi

  return 1
}

write_missing_claude() {
  local out="$1"
  cat > "$out" <<EOF
# 命令未执行

Claude Code CLI 未找到。

请先在 Obsidian 的 Terminal 插件里确认能运行：

\`\`\`bash
claude --help
\`\`\`

当前笔记：

\`\`\`text
$NOTE_REL
\`\`\`
EOF
}

run_output_action() {
  local out="$1"
  local prompt="$2"

  if ! resolve_claude; then
    write_missing_claude "$out"
    echo "OUTPUT:${out#$VAULT_ROOT/}"
    return
  fi

  (cd "$VAULT_ROOT" && "$CLAUDE_BIN" -p "$prompt") > "$out"
  echo "OUTPUT:${out#$VAULT_ROOT/}"
}

run_modify_action() {
  local prompt="$1"
  local backup="$BACKUP_DIR/$BASE-$STAMP.md"
  cp "$NOTE_ABS" "$backup"

  if ! resolve_claude; then
    cat >> "$NOTE_ABS" <<EOF

<!--
CC Command Center: Claude Code CLI 未找到，本次未修改。
备份已保存：${backup#$VAULT_ROOT/}
-->
EOF
    echo "OUTPUT:$NOTE_REL"
    return
  fi

  (cd "$VAULT_ROOT" && "$CLAUDE_BIN" -p "$prompt")
  echo "OUTPUT:$NOTE_REL"
}

case "$ACTION" in
  wechat-article)
    OUT="$OUT_DIR/$BASE-公众号文章.md"
    run_output_action "$OUT" "
请读取这篇 Obsidian 笔记：$NOTE_REL
把它改写成一篇适合中文公众号发布的文章。

要求：
1. 不要写成摘要，要写成读者没看过原文也能读懂的文章。
2. 开头要有冲突和判断，不要寒暄。
3. 结构清晰，二级标题使用中文。
4. 保留原文中有价值的观点，但补足背景和操作步骤。
5. 结尾给出可执行的下一步。
"
    ;;
  xiaohongshu-cards)
    OUT="$OUT_DIR/$BASE-小红书拆条.md"
    run_output_action "$OUT" "
请读取这篇 Obsidian 笔记：$NOTE_REL
把它拆成 5 条适合小红书、朋友圈或即刻发布的短内容。

每条包含：
1. 标题
2. 正文
3. 配图方向：说明这张图要表达什么信息，不要只写抽象风格
4. 生图提示词：写成可直接复制给 Gemini、ChatGPT、即梦、豆包等生图模型的信息图提示词
5. 画面文案：列出图片上建议出现的标题、关键短句和数据标签
6. 适合的话题标签
7. 这条适合哪个平台

生图提示词要求：
1. 默认生成中文信息图，不要生成摄影感封面。
2. 明确画幅，优先使用 3:4 竖版，小红书友好。
3. 明确视觉结构，例如标题区、三点列表、流程图、对比表、结论区。
4. 明确文字必须使用简体中文，排版清晰，避免错别字。
5. 不要要求模型复刻真实品牌 Logo、真实 UI 或名人肖像。
6. 如果原文没有数据，不要编造百分比和具体数字。

输出格式：
## 01. 标题

### 正文

### 配图方向

### 生图提示词
\`\`\`text
这里放可复制的完整提示词
\`\`\`

### 画面文案

### 话题标签

### 适合平台
"
    ;;
  topic-bank)
    OUT="$OUT_DIR/$BASE-选题池.md"
    run_output_action "$OUT" "
请读取这篇 Obsidian 笔记：$NOTE_REL
从中提炼可发布选题。

输出：
1. 10 个公众号标题
2. 5 个视频号/B站标题
3. 5 个小红书标题
4. 每个选题的核心冲突
5. 推荐优先级和原因
"
    ;;
  summary-map)
    OUT="$OUT_DIR/$BASE-摘要路标.md"
    run_output_action "$OUT" "
请读取这篇 Obsidian 笔记：$NOTE_REL
生成一份 Obsidian 路标页。

输出：
1. 300 字以内摘要
2. 关键词
3. 建议标签
4. 建议双链
5. 可复用到哪些内容场景
6. 下一步动作
"
    ;;
  polish-in-place)
    run_modify_action "
请直接修改这篇 Obsidian 笔记：$NOTE_REL
目标是润色原文，而不是另写一篇。

要求：
1. 保留原有事实和核心观点。
2. 改善中文表达、段落节奏和标题层级。
3. 不要删除重要信息。
4. 不要把笔记改成广告文。
5. 修改完成后只简要说明做了什么。
"
    ;;
  obsidian-format)
    run_modify_action "
请直接修改这篇 Obsidian 笔记：$NOTE_REL
目标是让它更像一篇可长期复用的 Obsidian 笔记。

要求：
1. 如果没有 YAML frontmatter，请补上 title、tags、created、status 字段。
2. 在正文前补一段 150 字以内摘要。
3. 补充 3-8 个合适的中文标签。
4. 在适合的位置加入少量 Obsidian 双链，使用 [[关键词]] 格式。
5. 不要编造原文没有的事实。
"
    ;;
  *)
    echo "未知动作: $ACTION" >&2
    exit 1
    ;;
esac
