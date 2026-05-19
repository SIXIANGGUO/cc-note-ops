#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: bash scripts/uninstall.sh \"/path/to/ObsidianVault\" [--remove-content]"
  exit 1
fi

VAULT_ROOT="$1"
REMOVE_CONTENT="${2:-}"

if [ ! -d "$VAULT_ROOT" ]; then
  echo "Vault 不存在: $VAULT_ROOT"
  exit 1
fi

PLUGIN_DIR="$VAULT_ROOT/.obsidian/plugins/cc-command-center"
RUNTIME_DIR="$VAULT_ROOT/.cc-command-center"
CONTENT_DIR="$VAULT_ROOT/控制中心"

remove_path() {
  local target="$1"
  if [ -e "$target" ]; then
    rm -rf "$target"
    echo "removed $target"
  else
    echo "not found $target"
  fi
}

remove_path "$PLUGIN_DIR"
remove_path "$RUNTIME_DIR"

if [ "$REMOVE_CONTENT" = "--remove-content" ]; then
  remove_path "$CONTENT_DIR"
else
  echo "kept $CONTENT_DIR"
fi

echo
echo "卸载完成。"
echo "建议重启 Obsidian，确认 Community plugins 里已经没有 CC Command Center。"
