#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(awk -F'"' '/"version"/ { print $4; exit }' "$ROOT_DIR/plugin/cc-command-center/manifest.json")"

if [ -z "$VERSION" ]; then
  echo "无法从 manifest.json 读取版本号"
  exit 1
fi

DIST_DIR="$ROOT_DIR/dist"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cc-note-ops-package.XXXXXX")"
PACKAGE_NAME="cc-note-ops-$VERSION"
STAGE_DIR="$WORK_DIR/$PACKAGE_NAME"
ARTIFACT="$DIST_DIR/$PACKAGE_NAME.zip"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$DIST_DIR" "$STAGE_DIR"
cp "$ROOT_DIR/README.md" "$STAGE_DIR/README.md"
cp "$ROOT_DIR/CHANGELOG.md" "$STAGE_DIR/CHANGELOG.md"
cp "$ROOT_DIR/LICENSE" "$STAGE_DIR/LICENSE"
cp -R "$ROOT_DIR/docs" "$STAGE_DIR/docs"
cp -R "$ROOT_DIR/plugin" "$STAGE_DIR/plugin"
cp -R "$ROOT_DIR/scripts" "$STAGE_DIR/scripts"
cp -R "$ROOT_DIR/vault" "$STAGE_DIR/vault"

find "$STAGE_DIR" -name ".DS_Store" -delete
find "$STAGE_DIR" -path "*/.cc-command-center/rss-cache/*" -delete

(cd "$WORK_DIR" && zip -qr "$ARTIFACT" "$PACKAGE_NAME")
echo "已生成 $ARTIFACT"
