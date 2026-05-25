#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "用法: bash .cc-command-center/scripts/note-action.sh <action> <note-path>"
  exit 1
fi

ACTION="$1"
NOTE_REL="$2"
PROFILE_ID="${3:-balanced}"
VAULT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NOTE_ABS="$VAULT_ROOT/$NOTE_REL"
PROFILE_DIR="$VAULT_ROOT/.cc-command-center/profiles"
PROFILE_FILE="$PROFILE_DIR/$PROFILE_ID.md"
ACTION_DIR="$VAULT_ROOT/.cc-command-center/actions"
ACTION_FILE="$ACTION_DIR/$ACTION.md"
PROXY_FILE="$VAULT_ROOT/.cc-command-center/proxy.env"

if [ ! -f "$NOTE_ABS" ]; then
  echo "找不到当前笔记: $NOTE_REL" >&2
  exit 1
fi

BASE="$(basename "$NOTE_REL" .md)"
STAMP="$(date "+%Y%m%d-%H%M%S")"
SOURCE_SHORT="${BASE:0:24}"
OUT_DIR="$VAULT_ROOT/控制中心/运行结果/当前笔记"
BACKUP_DIR="$VAULT_ROOT/控制中心/备份"
mkdir -p "$OUT_DIR" "$BACKUP_DIR"

CLAUDE_BIN=""
load_proxy_env() {
  if [ ! -f "$PROXY_FILE" ]; then
    return
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    case "$line" in
      ""|\#*) continue ;;
    esac

    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|all_proxy|no_proxy)
        export "$key=$value"
        ;;
    esac
  done < "$PROXY_FILE"
}

read_profile() {
  if [ "$PROFILE_ID" = "__none" ]; then
    return
  fi

  if [ -f "$PROFILE_FILE" ]; then
    cat "$PROFILE_FILE"
    return
  fi

  if [ -f "$PROFILE_DIR/balanced.md" ]; then
    cat "$PROFILE_DIR/balanced.md"
    return
  fi

  echo "使用清晰、准确、克制的中文表达，保留原文事实，不编造细节。"
}

read_action_template() {
  if [ -f "$ACTION_FILE" ]; then
    cat "$ACTION_FILE"
    return
  fi

  echo "请基于当前笔记完成动作：$ACTION。"
}

profile_label() {
  case "$PROFILE_ID" in
    __none) echo "结构化" ;;
    balanced) echo "均衡清晰" ;;
    buhuaguo) echo "不滑锅观点流" ;;
    spoken-camera) echo "上镜口播" ;;
    pro-tutorial) echo "专业教程" ;;
    *) echo "$PROFILE_ID" ;;
  esac
}

output_path() {
  local action_label="$1"
  echo "$OUT_DIR/$action_label-$(profile_label)-$STAMP-$SOURCE_SHORT.md"
}

build_context() {
  cat <<EOF
当前 Obsidian 笔记：$NOTE_REL

请先完整读取原文，再执行任务。
EOF

  if [ "$PROFILE_ID" != "__none" ]; then
    cat <<EOF
当前文风模板：$PROFILE_ID

文风要求：
$(read_profile)

EOF
  fi

  cat <<EOF
长文处理要求：
1. 如果原文超过 3000 字，先在心里建立全文结构地图，再输出结果。
2. 输出时必须覆盖开头、中段、结尾的关键信息，避免只处理后半部分。
3. 如果发现原文信息量太大，请优先保留核心论点、关键步骤、案例和限制条件。
4. 不要编造原文没有的事实、数据、工具能力和用户案例。

EOF
}

build_prompt() {
  cat <<EOF
$(build_context)

任务模板：
$(read_action_template)
EOF
}

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
  load_proxy_env

  if ! resolve_claude; then
    write_missing_claude "$out"
    echo "OUTPUT:${out#$VAULT_ROOT/}"
    return
  fi

  (cd "$VAULT_ROOT" && "$CLAUDE_BIN" -p "$prompt" < /dev/null) > "$out"
  echo "OUTPUT:${out#$VAULT_ROOT/}"
}

run_modify_action() {
  local prompt="$1"
  local backup="$BACKUP_DIR/$BASE-$STAMP.md"
  cp "$NOTE_ABS" "$backup"
  load_proxy_env

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

  (cd "$VAULT_ROOT" && "$CLAUDE_BIN" -p "$prompt" < /dev/null)
  echo "OUTPUT:$NOTE_REL"
}

case "$ACTION" in
  wechat-article)
    OUT="$(output_path "公众号改写")"
    run_output_action "$OUT" "$(build_prompt)"
    ;;
  xiaohongshu-cards)
    OUT="$(output_path "小红书拆条")"
    run_output_action "$OUT" "$(build_prompt)"
    ;;
  topic-bank)
    OUT="$(output_path "提炼选题")"
    run_output_action "$OUT" "$(build_prompt)"
    ;;
  summary-map)
    OUT="$(output_path "摘要路标")"
    run_output_action "$OUT" "$(build_prompt)"
    ;;
  polish-in-place)
    run_modify_action "$(build_prompt)"
    ;;
  obsidian-format)
    run_modify_action "$(build_prompt)"
    ;;
  *)
    echo "未知动作: $ACTION" >&2
    exit 1
    ;;
esac
