#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: bash scripts/install.sh \"/path/to/ObsidianVault\""
  exit 1
fi

VAULT_ROOT="$1"
KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$VAULT_ROOT" ]; then
  echo "Vault 不存在: $VAULT_ROOT"
  exit 1
fi

PLUGIN_DIR="$VAULT_ROOT/.obsidian/plugins/cc-command-center"
mkdir -p "$PLUGIN_DIR"

cp "$KIT_ROOT/plugin/cc-command-center/manifest.json" "$PLUGIN_DIR/manifest.json"
cp "$KIT_ROOT/plugin/cc-command-center/main.js" "$PLUGIN_DIR/main.js"
cp "$KIT_ROOT/plugin/cc-command-center/styles.css" "$PLUGIN_DIR/styles.css"
if [ -f "$PLUGIN_DIR/data.json" ]; then
  cp "$PLUGIN_DIR/data.json" "$PLUGIN_DIR/data.backup.$(date +%Y%m%d%H%M%S).json"
fi
cp "$KIT_ROOT/plugin/cc-command-center/data.json" "$PLUGIN_DIR/data.json"

copy_if_missing() {
  local src="$1"
  local dst="$2"
  if [ ! -e "$dst" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "created $dst"
  else
    echo "kept existing $dst"
  fi
}

find "$KIT_ROOT/vault" -type f | while read -r src; do
  rel="${src#$KIT_ROOT/vault/}"
  copy_if_missing "$src" "$VAULT_ROOT/$rel"
done

chmod +x "$VAULT_ROOT"/.cc-command-center/scripts/*.sh 2>/dev/null || true

echo
echo "安装完成。"
echo "下一步：重启 Obsidian，在 Community plugins 里启用 CC Command Center。"
echo "文件区只需要关注：控制中心/"
echo "运行脚本已放入隐藏目录：.cc-command-center/"
