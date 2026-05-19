const { ItemView, Notice, Plugin, setIcon } = require("obsidian");
const { execFile } = require("child_process");
const path = require("path");

const VIEW_TYPE = "cc-command-center-view";

const DEFAULT_SETTINGS = {
  actions: [
    {
      id: "wechat-article",
      label: "公众号改写",
      icon: "newspaper",
      kind: "output",
      description: "把当前笔记改写成一篇完整公众号文章。",
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "xiaohongshu-cards",
      label: "小红书拆条",
      icon: "image",
      kind: "output",
      description: "拆出 5 条短内容，并附可复制的信息图生图提示词。",
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "topic-bank",
      label: "提炼选题",
      icon: "lightbulb",
      kind: "output",
      description: "提炼选题、标题和可发布角度。",
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "summary-map",
      label: "摘要路标",
      icon: "map",
      kind: "output",
      description: "生成摘要、关键词、双链建议和后续动作。",
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "polish-in-place",
      label: "备份后润色原文",
      icon: "wand-sparkles",
      kind: "modify",
      description: "先备份当前笔记，再让 Claude Code 直接润色原文件。",
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "obsidian-format",
      label: "补标签双链",
      icon: "tags",
      kind: "modify",
      description: "先备份当前笔记，再补 Obsidian 标签、摘要和双链。",
      script: ".cc-command-center/scripts/note-action.sh"
    }
  ],
  terminalTips: [
    "安装 Obsidian Terminal 插件后，把终端固定到底部。",
    "在终端里进入 vault 根目录，然后运行 claude。",
    "本插件负责一键动作；Terminal 负责连续对话和人工接管。"
  ]
};

class CommandCenterView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentFile = null;
    this.currentText = "";
    this.previewPre = null;
    this.previewMeta = null;
    this.scrollUnsubscribers = [];
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "当前笔记操作台";
  }

  getIcon() {
    return "bot";
  }

  async onOpen() {
    await this.render();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.render()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.bindSourceScroll()));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (this.currentFile && file.path === this.currentFile.path) {
        this.render();
      }
    }));
  }

  async onClose() {
    this.clearSourceScrollListeners();
  }

  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("cc-os");

    const note = await this.getCurrentNote();
    this.renderTopbar(container, note);
    this.renderNotePanel(container, note);
    this.renderTerminalBridge(container, note);
    this.renderActions(container, note);
    this.renderTerminalPanel(container);
    this.renderResultPanel(container);
  }

  renderTopbar(container, note) {
    const topbar = container.createDiv("cc-os__topbar cc-note-topbar");
    const brand = topbar.createDiv("cc-brand");
    const pulse = brand.createDiv("cc-brand__pulse");
    this.setIcon(pulse, "bot");
    const title = brand.createDiv("cc-brand__copy");
    title.createDiv({ cls: "cc-brand__title", text: "NOTE OPS" });
    title.createDiv({ cls: "cc-brand__sub", text: "Obsidian x Claude Code" });

    const actions = topbar.createDiv("cc-top-actions");
    actions.createSpan({ cls: note ? "cc-live" : "cc-live is-off", text: note ? "已连接笔记" : "未选择笔记" });
    this.createIconButton(actions, "refresh-cw", "刷新", () => this.render());
  }

  renderNotePanel(container, note) {
    const panel = container.createDiv("cc-panel cc-current-note");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "源笔记" });
    head.createDiv({ cls: "cc-panel__hint", text: note ? `已锁定：${note.path}` : "请先打开一个 Markdown 文件" });

    if (!note) {
      const empty = panel.createDiv("cc-empty-state");
      this.setIcon(empty.createDiv("cc-empty-state__icon"), "file-question");
      empty.createDiv({ cls: "cc-empty-state__title", text: "还没有可操作的笔记" });
      empty.createDiv({ cls: "cc-empty-state__text", text: "在 Obsidian 中打开一篇 Markdown 笔记，然后回到这里点击刷新。" });
      return;
    }

    const grid = panel.createDiv("cc-note-stats");
    this.renderStat(grid, "文件名", note.name, "file-text");
    this.renderStat(grid, "字数", `${note.words}`, "pilcrow");
    this.renderStat(grid, "行数", `${note.lines}`, "list");
    this.renderStat(grid, "修改时间", note.mtime, "clock-3");

    const preview = panel.createDiv("cc-note-preview");
    const previewHead = preview.createDiv("cc-note-preview__head");
    previewHead.createDiv({ cls: "cc-note-preview__label", text: "内容预览" });
    this.previewMeta = previewHead.createDiv({ cls: "cc-note-preview__meta", text: note.previewMeta });
    this.previewPre = preview.createEl("pre", { text: note.preview || "这篇笔记暂时没有内容。" });
    this.bindSourceScroll();
  }

  renderStat(parent, label, value, iconName) {
    const card = parent.createDiv("cc-note-stat");
    const icon = card.createDiv("cc-note-stat__icon");
    this.setIcon(icon, iconName);
    const copy = card.createDiv("cc-note-stat__copy");
    copy.createDiv({ cls: "cc-note-stat__label", text: label });
    copy.createDiv({ cls: "cc-note-stat__value", text: value });
  }

  renderActions(container, note) {
    const panel = container.createDiv("cc-panel");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "一键操作" });
    head.createDiv({ cls: "cc-panel__hint", text: "后台独立调用 Claude Code，不占用底部 Terminal 会话" });

    const deck = panel.createDiv("cc-action-grid");
    for (const action of this.plugin.settings.actions) {
      const button = deck.createEl("button", {
        cls: `cc-action-card ${action.kind === "modify" ? "is-modify" : ""}`,
        attr: { type: "button" }
      });
      button.disabled = !note;
      const top = button.createDiv("cc-action-card__top");
      const icon = top.createDiv("cc-action-card__icon");
      this.setIcon(icon, action.icon || "sparkles");
      top.createDiv({ cls: "cc-action-card__label", text: action.label });
      const copy = button.createDiv("cc-action-card__copy");
      copy.createDiv({ cls: "cc-action-card__desc", text: action.description });
      button.addEventListener("click", () => this.runAction(action, note));
    }
  }

  renderTerminalBridge(container, note) {
    const panel = container.createDiv("cc-panel cc-copy-bridge");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "给左侧 Claude" });
    head.createDiv({ cls: "cc-panel__hint", text: "复制后粘到 Terminal 里的 Claude Code" });

    const grid = panel.createDiv("cc-copy-grid");
    this.createCopyCard(grid, "复制相对路径", "file-input", "最适合 Claude Code 在 vault 根目录下使用。", note, () => note.path);
    this.createCopyCard(grid, "复制完整路径", "copy", "适合跨目录定位或排查路径问题。", note, () => this.plugin.getAbsoluteNotePath(note.path));
    this.createCopyCard(grid, "复制改写提示词", "message-square-text", "把当前笔记交给左侧 Claude 做手动修改。", note, () => this.buildManualPrompt(note));
  }

  createCopyCard(parent, label, iconName, description, note, getText) {
    const button = parent.createEl("button", { cls: "cc-copy-card", attr: { type: "button" } });
    button.disabled = !note;
    const icon = button.createDiv("cc-copy-card__icon");
    this.setIcon(icon, iconName);
    const copy = button.createDiv("cc-copy-card__copy");
    copy.createDiv({ cls: "cc-copy-card__label", text: label });
    copy.createDiv({ cls: "cc-copy-card__desc", text: description });
    button.addEventListener("click", async () => {
      if (!note) {
        new Notice("请先打开一篇 Markdown 笔记");
        return;
      }
      await navigator.clipboard.writeText(getText());
      new Notice(`${label} 已复制`);
    });
  }

  buildManualPrompt(note) {
    return `请处理这篇 Obsidian 笔记：${note.path}

先读取原文，再给我一个修改方案。不要立刻改文件。

请输出：
1. 这篇笔记当前最值得优化的问题
2. 3 个可选修改方向
3. 你推荐的方向和原因
4. 如果我确认，再继续修改原文件`;
  }


  renderTerminalPanel(container) {
    const panel = container.createDiv("cc-panel cc-terminal-help");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "Terminal 插件怎么配合" });
    head.createDiv({ cls: "cc-panel__hint", text: "人工接管入口" });

    panel.createDiv({
      cls: "cc-terminal-note",
      text: "一键操作会在后台启动独立的 Claude Code 进程，底部 Terminal 不会滚动或接管这个任务。需要连续追问时，再去 Terminal 里手动和 Claude Code 对话。"
    });

    const grid = panel.createDiv("cc-terminal-grid");
    for (const tip of this.plugin.settings.terminalTips || []) {
      const item = grid.createDiv("cc-terminal-tip");
      this.setIcon(item.createDiv("cc-terminal-tip__icon"), "terminal");
      item.createDiv({ cls: "cc-terminal-tip__text", text: tip });
    }
  }

  renderResultPanel(container) {
    const panel = container.createDiv("cc-panel cc-result-panel");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "输出位置" });
    head.createDiv({ cls: "cc-panel__hint", text: "控制中心/运行结果/当前笔记" });
    panel.createDiv({
      cls: "cc-result-panel__text",
      text: "非破坏性任务会生成新文件。直接修改任务会先把原文复制到「控制中心/备份/」，再调用 Claude Code 改当前笔记。"
    });
  }

  async runAction(action, note) {
    if (!note) {
      new Notice("请先打开一篇 Markdown 笔记");
      return;
    }

    new Notice(`${action.label} 正在运行...`);
    try {
      this.plugin.setSourceNotePath(note.path);
      const result = await this.plugin.runNoteAction(action, note.path);
      const outputPath = this.parseOutputPath(result.stdout) || note.path;
      new Notice(`${action.label} 已完成`);
      await this.openFile(outputPath);
    } catch (error) {
      new Notice(`${action.label} 失败：${error.message || String(error)}`);
    }
  }

  parseOutputPath(stdout) {
    const match = String(stdout || "").match(/^OUTPUT:(.+)$/m);
    return match ? match[1].trim() : null;
  }

  createIconButton(parent, iconName, label, onClick) {
    const button = parent.createEl("button", { cls: "cc-icon-button", attr: { "aria-label": label, type: "button" } });
    this.setIcon(button, iconName);
    button.addEventListener("click", onClick);
    return button;
  }

  setIcon(element, iconName) {
    if (typeof setIcon === "function") {
      setIcon(element, iconName);
    }
  }

  async getCurrentNote() {
    const activeFile = this.app.workspace.getActiveFile();
    const file = this.plugin.isSourceNote(activeFile)
      ? activeFile
      : this.app.vault.getAbstractFileByPath(this.plugin.sourceNotePath || this.plugin.lastMarkdownPath || "");
    if (!file || file.extension !== "md") {
      this.currentFile = null;
      this.currentText = "";
      return null;
    }

    const text = await this.app.vault.read(file);
    this.currentFile = file;
    this.currentText = text;
    const words = text.replace(/\s+/g, "").length;
    const noteLines = text.length ? text.split(/\r?\n/) : [];
    const lines = noteLines.length;
    const slice = this.getPreviewSlice(noteLines, this.plugin.getScrollRatio(file.path));
    const mtime = new Date(file.stat.mtime).toLocaleString("zh-CN", { hour12: false });

    return {
      path: file.path,
      name: file.basename,
      words,
      lines,
      preview: slice.text,
      previewMeta: slice.meta,
      mtime
    };
  }

  getPreviewSlice(lines, ratio) {
    if (!lines.length) {
      return { text: "", meta: "空笔记" };
    }
    const windowSize = 14;
    const maxStart = Math.max(0, lines.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, Math.floor(maxStart * ratio)));
    const end = Math.min(lines.length, start + windowSize);
    return {
      text: lines.slice(start, end).join("\n").trim(),
      meta: `第 ${start + 1}-${end} 行 / 共 ${lines.length} 行`
    };
  }

  updatePreviewFromScroll(ratio) {
    if (!this.previewPre || !this.currentText) {
      return;
    }
    const lines = this.currentText.split(/\r?\n/);
    const slice = this.getPreviewSlice(lines, ratio);
    this.previewPre.setText(slice.text || "这篇笔记暂时没有内容。");
    if (this.previewMeta) {
      this.previewMeta.setText(slice.meta);
    }
  }

  bindSourceScroll() {
    this.clearSourceScrollListeners();
    if (!this.currentFile) {
      return;
    }

    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      if (!leaf.view || !leaf.view.file || leaf.view.file.path !== this.currentFile.path) {
        continue;
      }

      const scrollEl = this.getScrollableElement(leaf.view);
      if (!scrollEl) {
        continue;
      }

      const onScroll = () => {
        const maxScroll = Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
        const ratio = Math.max(0, Math.min(1, scrollEl.scrollTop / maxScroll));
        this.plugin.setScrollRatio(this.currentFile.path, ratio);
        this.updatePreviewFromScroll(ratio);
      };

      scrollEl.addEventListener("scroll", onScroll, { passive: true });
      this.scrollUnsubscribers.push(() => scrollEl.removeEventListener("scroll", onScroll));
      onScroll();
    }
  }

  clearSourceScrollListeners() {
    for (const unsubscribe of this.scrollUnsubscribers) {
      unsubscribe();
    }
    this.scrollUnsubscribers = [];
  }

  getScrollableElement(view) {
    const candidates = [
      view.contentEl && view.contentEl.querySelector(".cm-scroller"),
      view.contentEl && view.contentEl.querySelector(".markdown-reading-view"),
      view.contentEl && view.contentEl.querySelector(".markdown-preview-view"),
      view.contentEl
    ];
    return candidates.find((element) => element && element.scrollHeight > element.clientHeight) || null;
  }

  async openFile(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) {
      new Notice(`文件不存在：${filePath}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
}

module.exports = class CommandCenterPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.trackLastMarkdownFile();
    this.registerView(VIEW_TYPE, (leaf) => new CommandCenterView(leaf, this));
    this.addRibbonIcon("bot", "打开当前笔记操作台", () => this.activateView());
    this.addCommand({
      id: "open-note-ops",
      name: "打开当前笔记操作台",
      callback: () => this.activateView()
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded || {});
    this.settings.actions = Array.isArray(this.settings.actions) ? this.settings.actions : DEFAULT_SETTINGS.actions;
    this.settings.terminalTips = Array.isArray(this.settings.terminalTips) ? this.settings.terminalTips : DEFAULT_SETTINGS.terminalTips;
  }

  trackLastMarkdownFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (this.isSourceNote(activeFile)) {
      this.setSourceNotePath(activeFile.path);
    }
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (this.isSourceNote(file)) {
        this.setSourceNotePath(file.path);
      }
    }));
  }

  async activateView() {
    const activeFile = this.app.workspace.getActiveFile();
    if (this.isSourceNote(activeFile)) {
      this.setSourceNotePath(activeFile.path);
    }
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  runNoteAction(action, notePath) {
    const vaultRoot = this.getVaultRoot();
    const scriptPath = path.join(vaultRoot, action.script);

    return new Promise((resolve, reject) => {
      execFile("bash", [scriptPath, action.id, notePath], { cwd: vaultRoot, timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  getAbsoluteNotePath(notePath) {
    return path.join(this.getVaultRoot(), notePath);
  }

  getScrollRatio(notePath) {
    this.scrollRatios = this.scrollRatios || {};
    return this.scrollRatios[notePath] || 0;
  }

  setScrollRatio(notePath, ratio) {
    this.scrollRatios = this.scrollRatios || {};
    this.scrollRatios[notePath] = ratio;
  }

  setSourceNotePath(notePath) {
    this.sourceNotePath = notePath;
    this.lastMarkdownPath = notePath;
  }

  isSourceNote(file) {
    if (!file || file.extension !== "md") {
      return false;
    }
    return !this.isGeneratedPath(file.path);
  }

  isGeneratedPath(filePath) {
    return filePath.startsWith("控制中心/运行结果/") || filePath.startsWith("控制中心/备份/");
  }

  getVaultRoot() {
    const adapter = this.app.vault.adapter;
    if (adapter && adapter.basePath) {
      return adapter.basePath;
    }
    return path.dirname(this.app.vault.configDir || ".");
  }
};
