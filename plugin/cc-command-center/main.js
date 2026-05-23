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
      description: "任务：生成公众号长文；文风由上方模板决定。",
      usesProfile: true,
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "xiaohongshu-cards",
      label: "小红书拆条",
      icon: "image",
      kind: "output",
      description: "任务：拆 5 条短内容；附信息图生图提示词。",
      usesProfile: true,
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "topic-bank",
      label: "提炼选题",
      icon: "lightbulb",
      kind: "output",
      description: "任务：提炼选题、标题和可发布角度。",
      usesProfile: false,
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "summary-map",
      label: "摘要路标",
      icon: "map",
      kind: "output",
      description: "任务：生成摘要、关键词、双链建议和后续动作。",
      usesProfile: false,
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "polish-in-place",
      label: "备份后润色原文",
      icon: "wand-sparkles",
      kind: "modify",
      description: "任务：先备份，再按当前文风润色原文件。",
      usesProfile: true,
      script: ".cc-command-center/scripts/note-action.sh"
    },
    {
      id: "obsidian-format",
      label: "补标签双链",
      icon: "tags",
      kind: "modify",
      description: "任务：先备份，再补标签、摘要和双链。",
      usesProfile: false,
      script: ".cc-command-center/scripts/note-action.sh"
    }
  ],
  terminalTips: [
    "安装 Obsidian Terminal 插件后，把终端固定到底部。",
    "在终端里进入 vault 根目录，然后运行 claude。",
    "本插件负责一键动作；Terminal 负责连续对话和人工接管。"
  ],
  selectedThemeId: "auto",
  themes: [
    {
      id: "auto",
      label: "跟随 Obsidian"
    },
    {
      id: "dark",
      label: "暗色橙"
    },
    {
      id: "light",
      label: "亮色白"
    },
    {
      id: "mint",
      label: "青绿"
    }
  ],
  selectedProfileId: "balanced",
  profiles: [
    {
      id: "balanced",
      label: "均衡清晰",
      description: "适合多数笔记，保留信息密度，表达更清楚。"
    },
    {
      id: "buhuaguo",
      label: "不滑锅观点流",
      description: "开头有判断，适合公众号和深度内容。"
    },
    {
      id: "spoken-camera",
      label: "上镜口播",
      description: "短句、口语、节奏强，适合录视频。"
    },
    {
      id: "pro-tutorial",
      label: "专业教程",
      description: "步骤清楚，适合工具教程和操作指南。"
    }
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
    this.applyThemeClass(container);

    const note = await this.getCurrentNote();
    this.renderTopbar(container, note);
    this.renderPreferencePanel(container);
    this.renderNotePanel(container, note);
    this.renderTerminalBridge(container, note);
    this.renderProxyPanel(container);
    this.renderActions(container, note);
    this.renderTerminalPanel(container);
    this.renderResultPanel(container);
  }

  applyThemeClass(container) {
    for (const className of Array.from(container.classList)) {
      if (className === "cc-os" || className.startsWith("cc-theme-")) {
        container.classList.remove(className);
      }
    }
    container.classList.add("cc-os", `cc-theme-${this.plugin.settings.selectedThemeId || "auto"}`);
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

  renderPreferencePanel(container) {
    const panel = container.createDiv("cc-panel cc-preference-panel");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "偏好设置" });
    head.createDiv({ cls: "cc-panel__hint", text: "主题色 / 文风模板" });

    const grid = panel.createDiv("cc-preference-grid");
    const themeBox = grid.createDiv("cc-preference-box");
    themeBox.createDiv({ cls: "cc-preference-title", text: "主题色" });
    const tabs = themeBox.createDiv("cc-theme-tabs");
    for (const theme of this.plugin.settings.themes) {
      const button = tabs.createEl("button", {
        cls: theme.id === this.plugin.settings.selectedThemeId ? "cc-theme-tab is-active" : "cc-theme-tab",
        attr: { type: "button" },
        text: theme.label
      });
      button.addEventListener("click", async () => {
        await this.plugin.setSelectedThemeId(theme.id);
        await this.render();
      });
    }

    const profileBox = grid.createDiv("cc-preference-box");
    profileBox.createDiv({ cls: "cc-preference-title", text: "文风模板" });
    const body = profileBox.createDiv("cc-profile-body");
    const select = body.createEl("select", { cls: "cc-profile-select" });
    for (const profile of this.plugin.settings.profiles) {
      const option = select.createEl("option", { text: profile.label, value: profile.id });
      option.selected = profile.id === this.plugin.settings.selectedProfileId;
    }
    const current = body.createDiv("cc-profile-current");
    this.renderProfileSummary(current, this.plugin.getSelectedProfile());

    const chips = panel.createDiv("cc-template-chips");
    chips.createSpan({ text: "文风只作用于表达型任务" });
    chips.createSpan({ text: "长文保护已启用" });
    chips.createSpan({ text: this.plugin.getProxyStatusLabel() });
    this.createPathChip(chips, "复制按钮模板目录", () => this.plugin.getTemplateDir("actions"));
    this.createPathChip(chips, "复制文风模板目录", () => this.plugin.getTemplateDir("profiles"));
    this.createPathChip(chips, "复制代理配置路径", () => this.plugin.getProxyEnvPath());

    select.addEventListener("change", async () => {
      await this.plugin.setSelectedProfileId(select.value);
      new Notice(`文风模板已切换：${this.plugin.getSelectedProfile().label}`);
      await this.render();
    });
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
    const profile = this.plugin.getSelectedProfile();
    head.createDiv({ cls: "cc-panel__hint", text: `表达型任务使用：${profile.label}` });

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
      const title = top.createDiv("cc-action-card__title");
      title.createDiv({ cls: "cc-action-card__label", text: action.label });
      title.createDiv({
        cls: action.usesProfile === false ? "cc-action-card__profile is-neutral" : "cc-action-card__profile",
        text: action.usesProfile === false ? "结构化任务" : `文风：${profile.label}`
      });
      const copy = button.createDiv("cc-action-card__copy");
      copy.createDiv({ cls: "cc-action-card__desc", text: action.description });
      button.addEventListener("click", () => this.runAction(action, note));
    }
  }

  renderTerminalBridge(container, note) {
    const panel = container.createDiv("cc-panel cc-copy-bridge");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "给 Claude" });
    head.createDiv({ cls: "cc-panel__hint", text: "复制后粘到 Terminal 里的 Claude Code" });

    const grid = panel.createDiv("cc-copy-grid");
    this.createCopyCard(grid, "复制相对路径", "file-input", "最适合 Claude Code 在 vault 根目录下使用。", note, () => note.path);
    this.createCopyCard(grid, "复制完整路径", "copy", "适合跨目录定位或排查路径问题。", note, () => this.plugin.getAbsoluteNotePath(note.path));
    this.createCopyCard(grid, "复制模板改写提示词", "message-square-text", "带上当前文风模板，交给 Terminal 里的 Claude 手动修改。", note, () => this.buildManualPrompt(note));
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
    const profile = this.plugin.getSelectedProfile();
    const profileText = this.plugin.readProfileText(profile.id);
    return `请处理这篇 Obsidian 笔记：${note.path}

当前文风模板：${profile.label}

文风模板内容：
${profileText}

请先完整读取原文，再给我一个修改方案。不要立刻改文件。

如果原文超过 3000 字，请先建立全文结构地图，确保开头、中段、结尾的关键信息都被纳入判断。

请输出：
1. 这篇笔记当前最值得优化的问题
2. 3 个可选修改方向
3. 你推荐的方向和原因
4. 如果我确认，再按上面的文风模板继续修改原文件`;
  }

  renderProfileSummary(parent, profile) {
    parent.empty();
    parent.createDiv({ cls: "cc-profile-current__title", text: profile.label });
    parent.createDiv({ cls: "cc-profile-current__desc", text: profile.description });
  }

  createPathChip(parent, label, getText) {
    const button = parent.createEl("button", { attr: { type: "button" }, text: label });
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(getText());
      new Notice(`${label}已复制`);
    });
  }

  renderProxyPanel(container) {
    const panel = container.createDiv("cc-panel cc-proxy-panel");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "网络代理" });
    head.createDiv({ cls: "cc-panel__hint", text: this.plugin.getProxyStatusLabel() });

    panel.createDiv({
      cls: "cc-proxy-note",
      text: "如果按钮连不上 Claude，或你希望后台 Claude Code 明确走本机代理，再启用这里。7890 和 7897 是常见本机代理端口；它只影响本插件按钮，不修改系统代理。"
    });

    const actions = panel.createDiv("cc-proxy-actions");
    this.createProxyButton(actions, "启用 7890", () => this.plugin.enableProxy("7890"));
    this.createProxyButton(actions, "启用 7897", () => this.plugin.enableProxy("7897"));
    this.createProxyButton(actions, "关闭代理", () => this.plugin.disableProxy(), true);
    this.createProxyButton(actions, "复制配置路径", async () => {
      await navigator.clipboard.writeText(this.plugin.getProxyEnvPath());
    });
  }

  createProxyButton(parent, label, onClick, isDanger) {
    const button = parent.createEl("button", {
      cls: `cc-proxy-button ${isDanger ? "is-danger" : ""}`,
      attr: { type: "button" },
      text: label
    });
    button.addEventListener("click", async () => {
      await onClick();
      new Notice(`${label} 已执行`);
      await this.render();
    });
  }

  renderTerminalPanel(container) {
    const panel = container.createDiv("cc-panel cc-terminal-help");
    const head = panel.createDiv("cc-panel__head");
    head.createDiv({ cls: "cc-panel__label", text: "Terminal 插件怎么配合" });
    head.createDiv({ cls: "cc-panel__hint", text: "人工接管入口" });

    panel.createDiv({
      cls: "cc-terminal-note",
      text: "一键操作会在后台启动独立的 Claude Code 进程，Terminal 不会滚动或接管这个任务。需要连续追问时，再去 Terminal 里手动和 Claude Code 对话。"
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
      const profileId = action.usesProfile === false ? "__none" : this.plugin.settings.selectedProfileId;
      const result = await this.plugin.runNoteAction(action, note.path, profileId);
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
    this.settings.themes = Array.isArray(this.settings.themes) ? this.settings.themes : DEFAULT_SETTINGS.themes;
    if (!this.getThemeById(this.settings.selectedThemeId)) {
      this.settings.selectedThemeId = DEFAULT_SETTINGS.selectedThemeId;
    }
    this.settings.profiles = Array.isArray(this.settings.profiles) ? this.settings.profiles : DEFAULT_SETTINGS.profiles;
    if (!this.getProfileById(this.settings.selectedProfileId)) {
      this.settings.selectedProfileId = DEFAULT_SETTINGS.selectedProfileId;
    }
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

  runNoteAction(action, notePath, profileId) {
    const vaultRoot = this.getVaultRoot();
    const scriptPath = path.join(vaultRoot, action.script);

    return new Promise((resolve, reject) => {
      execFile("bash", [scriptPath, action.id, notePath, profileId], { cwd: vaultRoot, timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
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

  getTemplateDir(kind) {
    return path.join(this.getVaultRoot(), ".cc-command-center", kind);
  }

  getProxyEnvPath() {
    return path.join(this.getVaultRoot(), ".cc-command-center", "proxy.env");
  }

  getProxyStatusLabel() {
    const fs = require("fs");
    const proxyPath = this.getProxyEnvPath();
    if (!fs.existsSync(proxyPath)) {
      return "代理：未配置";
    }
    const text = fs.readFileSync(proxyPath, "utf8");
    const hasProxy = text.split(/\r?\n/).some((line) => /^\s*(HTTPS?_PROXY|ALL_PROXY|https?_proxy|all_proxy)\s*=/.test(line) && !/^\s*#/.test(line));
    return hasProxy ? "代理：已配置" : "代理：未启用";
  }

  getThemeById(themeId) {
    return (this.settings.themes || []).find((theme) => theme.id === themeId);
  }

  async setSelectedThemeId(themeId) {
    this.settings.selectedThemeId = themeId;
    await this.saveData(this.settings);
  }

  async enableProxy(port) {
    const fs = require("fs");
    const proxyPath = this.getProxyEnvPath();
    const proxyUrl = `http://127.0.0.1:${port}`;
    fs.mkdirSync(path.dirname(proxyPath), { recursive: true });
    fs.writeFileSync(proxyPath, [
      "# CC Note Ops proxy env",
      "# 只影响本插件后台调用 claude 的环境变量。",
      `HTTP_PROXY=${proxyUrl}`,
      `HTTPS_PROXY=${proxyUrl}`,
      `ALL_PROXY=socks5://127.0.0.1:${port}`,
      "NO_PROXY=localhost,127.0.0.1",
      ""
    ].join("\n"));
  }

  async disableProxy() {
    const fs = require("fs");
    const proxyPath = this.getProxyEnvPath();
    fs.mkdirSync(path.dirname(proxyPath), { recursive: true });
    fs.writeFileSync(proxyPath, [
      "# CC Note Ops proxy env",
      "# 当前已关闭。取消下面注释并修改端口即可手动启用。",
      "# HTTP_PROXY=http://127.0.0.1:7890",
      "# HTTPS_PROXY=http://127.0.0.1:7890",
      "# ALL_PROXY=socks5://127.0.0.1:7890",
      "# NO_PROXY=localhost,127.0.0.1",
      ""
    ].join("\n"));
  }

  getSelectedProfile() {
    return this.getProfileById(this.settings.selectedProfileId) || DEFAULT_SETTINGS.profiles[0];
  }

  readProfileText(profileId) {
    const profilePath = path.join(this.getVaultRoot(), ".cc-command-center", "profiles", `${profileId}.md`);
    try {
      return require("fs").readFileSync(profilePath, "utf8").trim();
    } catch (error) {
      const fallbackPath = path.join(this.getVaultRoot(), ".cc-command-center", "profiles", "balanced.md");
      try {
        return require("fs").readFileSync(fallbackPath, "utf8").trim();
      } catch (fallbackError) {
        return "使用清晰、准确、克制的中文表达，保留原文事实，不编造细节。";
      }
    }
  }

  getProfileById(profileId) {
    return (this.settings.profiles || []).find((profile) => profile.id === profileId);
  }

  async setSelectedProfileId(profileId) {
    this.settings.selectedProfileId = profileId;
    await this.saveData(this.settings);
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
