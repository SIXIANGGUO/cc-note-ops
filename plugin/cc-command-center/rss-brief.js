const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_DAILY_SOURCES = [
  ["ai-product-updates-search", "AI 产品更新搜索", "ai-product-updates", "https://news.google.com/rss/search?q=(Claude%20OR%20Gemini%20OR%20Codex%20OR%20DeepSeek%20OR%20Qwen%20OR%20Kimi%20OR%20%E8%B1%86%E5%8C%85%20OR%20%E9%80%9A%E4%B9%89%20OR%20%E6%99%BA%E8%B0%B1)%20(%E5%8F%91%E5%B8%83%20OR%20%E6%96%B0%E5%8A%9F%E8%83%BD%20OR%20%E6%9B%B4%E6%96%B0%20OR%20launch%20OR%20release)&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"],
  ["openai-news", "OpenAI News", "ai-product-updates", "https://openai.com/news/rss.xml"],
  ["google-blog", "Google Blog", "ai-product-updates", "https://blog.google/rss/"],
  ["aws-machine-learning", "AWS Machine Learning Blog", "ai-tools-agents-llm", "https://aws.amazon.com/blogs/machine-learning/feed"],
  ["google-deepmind", "Google DeepMind Blog", "ai-tools-agents-llm", "https://deepmind.com/blog/feed/basic"],
  ["last-week-in-ai", "Last Week in AI", "ai-tools-agents-llm", "https://lastweekin.ai/feed"],
  ["36kr-hot", "36氪 - 24小时热榜", "cn-independent-blogs", "https://rss.mifaw.com/articles/5c8bb11a3c41f61efd36683e/5c91d2e23882afa09dff4901"],
  ["v2ex-programmer", "V2EX - 程序员", "cn-independent-blogs", "http://www.v2ex.com/feed/programmer.xml"],
  ["sspai", "少数派", "cn-independent-blogs", "http://sspai.me/feed"],
  ["hellogithub", "HelloGitHub 月刊", "newsletters-curated", "https://hellogithub.com/rss"],
  ["devnow", "DevNow 开发技术周刊", "newsletters-curated", "https://www.laughingzhu.cn/rss.xml"],
  ["transparent-daily", "透明日报", "newsletters-curated", "https://daily.xlab.app/atom.xml"],
  ["haogongju-weekly", "好工具周刊", "newsletters-curated", "https://bestxtools.github.io/atom.xml"],
  ["yaoxing-gofurther", "遥行 Gofurther 技术博客", "cn-ai-media-kols", "https://charlesliuyx.github.io/atom.xml"],
  ["xieyi-ai", "謝懿Shine AI博客", "cn-ai-media-kols", "https://xieyi.org/rss.xml"]
].map(([id, label, category, url]) => ({ id, label, category, url, enabled: true }));

const KEYWORDS = ["AI", "Agent", "MCP", "Claude", "Gemini", "GPT", "LLM", "Codex", "ChatGPT", "deepseek", "openai", "anthropic", "bedrock", "Qwen", "Kimi", "Doubao", "豆包", "通义", "智谱", "GLM", "MiniMax", "Veo", "Imagen", "NotebookLM", "AI Studio"];
const FIELD_LABELS = { "ai-product-updates": "AI 产品更新", "cn-ai-media-kols": "中文 AI / KOL", "ai-tools-agents-llm": "AI 工具 / Agent / LLM", "en-ai-research-labs": "海外 AI 研究", "en-engineering-blogs": "工程博客", "cn-tech-teams": "中文技术团队", "cn-independent-blogs": "中文独立博客 / 社区", "startups-indie-business": "海外产品 / 创业", "newsletters-curated": "精选 Newsletter", "media-video-youtube": "视频 / YouTube" };

const RSS_LOAD_TIMEOUT_MS = 2500;
const RSS_SOURCE_TIMEOUT_MS = 12000;
let pendingRefresh = null;
let lastGeneratedBrief = null;

class RssBriefService {
  constructor(settings, defaults, runtime) {
    this.settings = settings || {};
    this.defaults = defaults || {};
    this.runtime = runtime || {};
  }

  async load() {
    if (this.settings.enabled === false) {
      return this.empty("RSS 未启用", "RSS 信息源已在插件配置中关闭。");
    }

    if (this.getExternalBriefsDir()) {
      return this.loadExternalBrief();
    }

    const cached = this.loadCache();
    if (cached && !this.shouldRefresh(cached)) {
      return cached;
    }
    const generated = this.loadGeneratedBrief();
    if (generated) {
      return generated;
    }
    return this.refreshWithTimeout();
  }

  async refreshWithTimeout() {
    if (!pendingRefresh) {
      pendingRefresh = this.refresh()
        .then((brief) => {
          lastGeneratedBrief = brief;
          return brief;
        })
        .finally(() => {
          pendingRefresh = null;
        });
    }
    return Promise.race([
      pendingRefresh,
      delay(RSS_LOAD_TIMEOUT_MS).then(() => lastGeneratedBrief || this.empty("正在生成日报", "RSS 日报正在后台生成。稍后点击刷新即可看到当天 Markdown 日报。"))
    ]);
  }

  async refresh() {
    if (this.getExternalDailyScript()) {
      await this.runExternalDailyScript();
      return this.loadExternalBrief();
    }

    const sources = this.getSources();
    if (!sources.length) {
      return this.empty("未配置 RSS", `请先编辑 ${this.getSourcesPath()}，添加自己的 RSS 源。`);
    }

    const fetched = await Promise.all(sources.map((source) => this.fetchSource(source)));
    const items = fetched.flatMap((result) => result.items).sort((a, b) => b.timestamp - a.timestamp);
    if (!items.length) {
      const failed = fetched.filter((result) => result.error).map((result) => `${result.label}: ${result.error}`).join("；");
      return this.empty("暂无内容", failed || "RSS 源已读取，但没有解析出可展示的条目。");
    }

    const brief = this.buildBrief(items, fetched);
    this.saveCache(brief);
    return brief;
  }

  async fetchSource(source) {
    const label = source.label || source.url;
    try {
      const text = await this.fetchText(source.url);
      return { label, items: parseFeed(text, source), error: "" };
    } catch (error) {
      return { label, items: [], error: cleanText(error.message || String(error)) };
    }
  }

  async fetchText(url) {
    if (!url) {
      throw new Error("RSS 地址为空");
    }
    if (this.runtime.requestUrl) {
      const response = await withTimeout(this.runtime.requestUrl({ url, method: "GET" }), RSS_SOURCE_TIMEOUT_MS, "RSS 源请求超时");
      if (response.status && response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text || "";
    }
    const response = await withTimeout(fetch(url), RSS_SOURCE_TIMEOUT_MS, "RSS 源请求超时");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  }

  buildBrief(items, fetched) {
    const dateLabel = this.formatLocalDate(new Date());
    const sourceCount = fetched.length;
    const failedCount = fetched.filter((result) => result.error).length;
    const dailyPath = this.getDailyBriefPath();
    const articles = matchedDailyArticles(items);
    const markdown = renderDailyMarkdown(articles, dailyPath, { failedCount, sourceCount });
    fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
    fs.writeFileSync(dailyPath, markdown, "utf8");
    const brief = parseMarkdownBrief(markdown, dailyPath, this.getMaxQuickItems());

    const updatedAt = new Date();
    return Object.assign({}, brief, {
      mode: "rss-daily",
      schemaVersion: 2,
      updatedAt: updatedAt.toLocaleString("zh-CN", { hour12: false }),
      updatedAtIso: updatedAt.toISOString(),
      sourceCount,
      failedCount
    });
  }

  loadExternalBrief() {
    const filePath = this.findLatestExternalBrief();
    if (!filePath) {
      return this.empty("未找到日报", `没有在 ${this.getExternalBriefsDir()} 找到 *-daily-brief.md。`);
    }

    try {
      const text = fs.readFileSync(filePath, "utf8");
      return parseMarkdownBrief(text, filePath, this.getMaxQuickItems());
    } catch (error) {
      return this.empty("读取失败", `日报文件读取失败：${error.message || String(error)}`);
    }
  }

  loadGeneratedBrief() {
    const filePath = this.getDailyBriefPath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const brief = parseMarkdownBrief(text, filePath, this.getMaxQuickItems());
      return Object.assign({}, brief, { mode: "rss-daily", schemaVersion: 2 });
    } catch {
      return null;
    }
  }

  findLatestExternalBrief() {
    const briefsDir = this.getExternalBriefsDir();
    if (!fs.existsSync(briefsDir)) {
      return "";
    }
    const todayFile = path.join(briefsDir, `${this.formatLocalDate(new Date())}-daily-brief.md`);
    if (fs.existsSync(todayFile)) {
      return todayFile;
    }
    const files = fs.readdirSync(briefsDir).filter((name) => /^\d{4}-\d{2}-\d{2}-daily-brief\.md$/.test(name)).sort();
    const latest = files[files.length - 1];
    return latest ? path.join(briefsDir, latest) : "";
  }

  runExternalDailyScript() {
    const scriptPath = this.getExternalDailyScript();
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      return Promise.reject(new Error("RSS 外部刷新脚本不存在"));
    }
    return new Promise((resolve, reject) => {
      execFile("bash", [scriptPath], { cwd: path.dirname(path.dirname(scriptPath)), timeout: 20 * 60 * 1000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  canRefresh() {
    return Boolean(this.getExternalDailyScript() || this.getSources().length);
  }

  getSources() {
    const fromFile = this.readSourcesFile();
    const configured = this.settings.sources || this.defaults.sources || [];
    const sources = fromFile.length ? fromFile : (configured.length ? configured : DEFAULT_DAILY_SOURCES);
    return sources.filter((source) => source && source.enabled !== false && source.url);
  }

  readSourcesFile() {
    const sourcePath = this.getSourcesPath();
    if (!fs.existsSync(sourcePath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      return Array.isArray(parsed.sources) ? parsed.sources : [];
    } catch {
      return [];
    }
  }

  loadCache() {
    const cachePath = this.getCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    } catch {
      return null;
    }
  }

  saveCache(brief) {
    fs.mkdirSync(this.getCacheDir(), { recursive: true });
    fs.writeFileSync(this.getCachePath(), JSON.stringify(brief, null, 2));
  }

  shouldRefresh(cached) {
    if (cached.schemaVersion !== 2) {
      return true;
    }
    if (this.settings.refreshOnOpen === false) {
      return false;
    }
    const ttlMs = Math.max(1, Number(this.settings.cacheHours || this.defaults.cacheHours || 6)) * 60 * 60 * 1000;
    const updatedAt = Date.parse(cached.updatedAtIso || cached.updatedAt);
    return !updatedAt || Date.now() - updatedAt > ttlMs;
  }

  empty(hint, message) {
    return { ok: false, hint, message, filePath: this.getSourcesPath(), sourceCount: this.getSources().length };
  }

  getSourcesPath() {
    return path.join(this.runtime.vaultRoot || "", ".cc-command-center", "rss-sources.json");
  }

  getCacheDir() {
    return path.join(this.runtime.vaultRoot || "", ".cc-command-center", "rss-cache");
  }

  getCachePath() {
    return path.join(this.getCacheDir(), `${this.formatLocalDate(new Date())}-rss-brief.json`);
  }

  getDailyBriefDir() {
    return path.join(this.runtime.vaultRoot || "", "控制中心", "资料入口", "RSS日报");
  }

  getDailyBriefPath() {
    return path.join(this.getDailyBriefDir(), `${this.formatLocalDate(new Date())}-daily-brief.md`);
  }

  getExternalBriefsDir() {
    return this.settings.externalBriefsDir || this.settings.briefsDir || "";
  }

  getExternalDailyScript() {
    return this.settings.externalDailyScript || this.settings.dailyScript || "";
  }

  getMaxQuickItems() {
    return Math.max(1, Number(this.settings.maxQuickItems || this.defaults.maxQuickItems || 8));
  }

  getMaxImportantItems() {
    return Math.max(1, Number(this.settings.maxImportantItems || this.defaults.maxImportantItems || 3));
  }

  formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

function parseFeed(text, source) {
  const blocks = matchBlocks(text, "item").length ? matchBlocks(text, "item") : matchBlocks(text, "entry");
  return blocks.map((block) => {
    const title = cleanText(readTag(block, "title"));
    const summary = cleanText(readTag(block, "description") || readTag(block, "summary") || readTag(block, "content:encoded") || readTag(block, "content"));
    const url = cleanText(readTag(block, "link") || readAtomLink(block) || readTag(block, "guid"));
    const publishedAt = cleanText(readTag(block, "pubDate") || readTag(block, "updated") || readTag(block, "published"));
    const timestamp = Date.parse(publishedAt) || Date.now();
    return {
      id: 0,
      title: title || "未命名条目",
      summary,
      url,
      feedTitle: source.label || "未知来源",
      category: source.category || source.label || "RSS",
      timestamp,
      publishedAt: timestamp ? new Date(timestamp).toLocaleString("zh-CN", { hour12: false }) : "",
      keywordHits: keywordHits(`${title}\n${summary}\n${source.label || ""}`)
    };
  }).filter((item) => (item.title || item.url) && item.keywordHits.length);
}

function matchedDailyArticles(items) {
  const sorted = items.map((item, index) => Object.assign({}, item, {
    id: index + 1,
    score: dailyScore(item)
  })).sort((a, b) => (b.score - a.score) || (b.timestamp - a.timestamp));

  const seen = new Set();
  const unique = [];
  for (const item of sorted) {
    const key = normalizedKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function renderDailyMarkdown(articles, outputPath, meta) {
  const dateLabel = formatLocalDate(new Date());
  const lines = [
    `# AI 早报 · ${dateLabel}`,
    "",
    `> 数据来源：CC Note Ops 内置 RSS 日报源；关键词：${KEYWORDS.join(", ")}。`,
    `> 本次读取：${meta.sourceCount} 个源；失败：${meta.failedCount} 个；输出：${outputPath}。`,
    "",
    "---",
    ""
  ];
  lines.push(...renderBigItems(articles));
  lines.push("---", "");
  lines.push(...renderFlash(articles.slice(3)));
  lines.push("---", "");
  lines.push(...renderWatchlist(articles));
  lines.push("---", "");
  lines.push(...renderShareSummary(articles));
  return lines.join("\n");
}

function renderBigItems(articles) {
  const lines = ["## 今日最重要的 3 件事", ""];
  if (!articles.length) {
    lines.push("今天的增量文章里没有命中监控关键词的内容。", "");
    return lines;
  }
  for (const [index, article] of articles.slice(0, 3).entries()) {
    const title = displayTitle(article);
    lines.push(`### ${index + 1}. ${title}`);
    if (isEnglishTitle(article.title)) {
      lines.push(`- 原标题：${cleanText(article.title, 96)}`);
    }
    lines.push(
      `- 一句话结论：${cleanText(title, 80)}`,
      `- 背景：${readableBackground(article)}`,
      `- 影响：${briefImpact(article)}`,
      `- 原链接：[${article.feedTitle}](${article.url})`,
      ""
    );
  }
  return lines;
}

function renderFlash(articles) {
  const lines = ["## 快讯", ""];
  if (!articles.length) {
    lines.push("暂无命中快讯。", "");
    return lines;
  }
  const grouped = new Map();
  for (const article of articles) {
    const key = fieldName(article.category);
    grouped.set(key, (grouped.get(key) || []).concat(article));
  }
  for (const name of Array.from(grouped.keys()).sort()) {
    lines.push(`### ${name}`, "");
    for (const article of grouped.get(name).slice(0, 8)) {
      const title = cleanText(displayTitle(article), 64);
      const summary = flashSummary(article);
      const source = isEnglishTitle(article.title) ? `（英文源：${article.feedTitle}）` : "";
      lines.push(`- [${title}](${article.url}) - ${summary}${source}`);
    }
    lines.push("");
  }
  return lines;
}

function renderWatchlist(articles) {
  const lines = ["## 跟踪清单", ""];
  if (!articles.length) {
    lines.push("1. 明天继续观察 AI / Agent / MCP / 模型平台相关增量。", "");
    return lines;
  }
  for (const [index, article] of articles.slice(0, 5).entries()) {
    lines.push(`${index + 1}. **${cleanText(displayTitle(article), 36)}** - 继续看后续更新、社区反馈和可落地影响。`);
  }
  lines.push("");
  return lines;
}

function renderShareSummary(articles) {
  const lines = ["## X 创作候选", ""];
  if (!articles.length) {
    lines.push("今天没有找到适合做 X 推文二创的候选文章。", "");
    return lines;
  }
  const candidate = articles.slice(0, 80).sort((a, b) => candidateRank(b) - candidateRank(a))[0];
  const score = creationScore(candidate);
  const tweet = buildTweet(candidate);
  const imagePrompt = buildImagePrompt(candidate);
  lines.push(
    `- 文章 ID：${candidate.id}`,
    `- 标题：${displayTitle(candidate)}`,
    `- 来源：${candidate.feedTitle}`,
    `- 原文：${candidate.url}`,
    `- 不滑锅创作评分：${scoreLabel(score)}（实用性 ${score.practical} / 工具属性 ${score.toolish} / 传播点 ${score.shareable}）`,
    `- 干货评分：${actionableScore(candidate)} / 转粉传播评分：${xConversionScore(candidate)} / 宏观叙事惩罚：${macroPenalty(candidate)}`,
    `- 选题桶：${topicBucket(candidate)}`,
    "- 选择理由：优先选择工具发现、产品拆解、开发者资源、书单/工具清单/下载入口、Prompt 或知识管理类内容；这类素材更适合收藏、转发和粉丝转化。",
    "",
    "### 可直接发布的 X 推文",
    "",
    "```text",
    tweet,
    "```",
    "",
    "### 配图提示词",
    "",
    "```text",
    imagePrompt,
    "```",
    ""
  );
  return lines;
}

function parseMarkdownBrief(text, filePath, maxQuickItems) {
  const stats = fs.statSync(filePath);
  const title = firstMatch(text, /^#\s+(.+)$/m) || "AI 早报";
  const dateLabel = firstMatch(title, /(\d{4}-\d{2}-\d{2})/) || path.basename(filePath, "-daily-brief.md");
  const importantText = extractMarkdownSection(text, "今日最重要的 3 件事");
  const quickText = extractMarkdownSection(text, "快讯");
  const candidateText = extractMarkdownSection(text, "X 创作候选");
  return {
    ok: true,
    mode: "external-brief",
    title,
    dateLabel,
    filePath,
    updatedAt: new Date(stats.mtime).toLocaleString("zh-CN", { hour12: false }),
    importantItems: parseImportantItems(importantText),
    quickItems: parseQuickItems(quickText).slice(0, maxQuickItems),
    xCandidate: parseXCandidate(candidateText)
  };
}

function parseImportantItems(sectionText) {
  const blocks = sectionText.split(/^###\s+\d+\.\s+/m).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const title = lines.shift() || "未命名重点";
    return {
      title,
      url: firstMarkdownLinkUrl(block),
      summary: firstMatch(block, /^-\s+背景：(.+)$/m) || firstMatch(block, /^-\s+一句话结论：(.+)$/m),
      category: "重点"
    };
  }).slice(0, 3);
}

function parseQuickItems(sectionText) {
  const items = [];
  let category = "快讯";
  for (const line of sectionText.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      category = heading[1].trim();
      continue;
    }
    const item = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*(.+))?$/);
    if (item) {
      items.push({ title: item[1].trim(), url: item[2].trim(), summary: (item[3] || "").trim(), category });
    }
  }
  return items;
}

function parseXCandidate(sectionText) {
  if (!sectionText.trim()) {
    return null;
  }
  const fields = {};
  for (const line of sectionText.split(/\r?\n/)) {
    const match = line.match(/^-\s+([^：:]+)[：:]\s*(.+)$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }
  return {
    title: fields["标题"] || "",
    source: fields["来源"] || "",
    url: fields["原文"] || "",
    reason: fields["选择理由"] || "",
    tweet: extractFencedBlock(sectionText, "可直接发布的 X 推文"),
    imagePrompt: extractFencedBlock(sectionText, "配图提示词")
  };
}

function buildTweet(article) {
  const title = displayTitle(article);
  const point = cleanText(article.summary || title, 72);
  if (topicBucket(article) === "x_growth_resources") {
    return `看到一个很适合收藏的 AI 工具/资源线索：${title}\n\n它真正有价值的不是“又出了一个新东西”，而是能帮你少走一步：更快找到入口、更快判断成本、更快放进自己的工作流。\n\n我的建议：先别急着追热点，先看它能不能解决你每天重复遇到的那个小痛点。\n\n原文：${article.url}`;
  }
  return `${title}\n\n我觉得这类消息最值得看的地方，不是参数又多了多少，而是它会不会改变普通人的使用路径。\n\n一句话背景：${point}\n\n如果它能降低使用门槛、缩短工作流，才是真正值得写进知识库的更新。\n\n原文：${article.url}`;
}

function buildImagePrompt(article) {
  return `生成一张 16:9 中文信息图，主题是「${cleanText(displayTitle(article), 34)}」。风格：深色科技感、清晰信息层级、适合 X 配图。画面结构：顶部大标题，中间 3 个模块「发生了什么」「为什么值得看」「可以怎么用」，底部放一句结论「把热点变成可执行入口」。只使用简体中文，不要真实 Logo，不要虚构数据，不要人物肖像。`;
}

function keywordHits(text) {
  return KEYWORDS.filter((word) => new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(word)}([^A-Za-z0-9]|$)`, "i").test(text));
}

function displayTitle(article) {
  if (!isEnglishTitle(article.title)) {
    return article.title;
  }
  return inferChineseTopic(article);
}

function inferChineseTopic(article) {
  const text = `${article.title}\n${article.summary}\n${article.feedTitle}`.toLowerCase();
  if (text.includes("openai") && text.includes("codex")) {
    return "OpenAI / Codex 的产品与开发者工作流更新";
  }
  if (text.includes("claude") || text.includes("anthropic")) {
    return text.includes("security") || text.includes("vulnerab")
      ? "Claude / Anthropic 在 AI 安全方向继续推进"
      : "Claude / Anthropic 的产品与商业化更新";
  }
  if (text.includes("gemini") || text.includes("google")) {
    return "Google / Gemini 发布新的 AI 产品能力";
  }
  if (text.includes("agent") || text.includes("mcp")) {
    return "AI Agent / MCP 工作流出现新的工具与实践";
  }
  if (text.includes("prompt")) {
    return "Prompt 与 AI 使用技巧出现新资源";
  }
  if (text.includes("github") || text.includes("open source")) {
    return "开源社区出现新的 AI 工具资源";
  }
  if (text.includes("tool") || text.includes("workflow")) {
    return "AI 工具与工作流有新的可用素材";
  }
  return `${fieldName(article.category)}里的 AI 新动态`;
}

function readableBackground(article) {
  if (!article.summary) {
    return `来自 ${article.feedTitle || fieldName(article.category)}，命中 ${article.keywordHits.join("、")}。`;
  }
  if (!isEnglishTitle(article.summary)) {
    return cleanText(article.summary, 120);
  }
  return `${article.feedTitle} 的新增内容命中 ${article.keywordHits.slice(0, 4).join("、")}，核心看点是：${inferChineseTopic(article)}。`;
}

function flashSummary(article) {
  if (isEnglishTitle(article.title) || isEnglishTitle(article.summary)) {
    return cleanText(inferChineseTopic(article), 56);
  }
  return cleanText(article.summary || article.title, 56);
}

function briefImpact(article) {
  if (article.category === "ai-product-updates") {
    return "优先判断它是否能转成普通用户可用的新功能教程、产品对比或避坑提醒。";
  }
  if (article.category.includes("research")) {
    return "关注其是否会影响模型能力、评测方法或 Agent 架构。";
  }
  if (article.category.includes("engineering") || article.category.includes("tech")) {
    return "适合评估工程实践、工具链和团队落地方式。";
  }
  if (article.category.includes("tools") || article.category.includes("agents")) {
    return "值得判断是否进入日常工作流或产品路线。";
  }
  return "建议继续观察其对开发者、内容生产和产品策略的影响。";
}

function dailyScore(article) {
  return article.keywordHits.length * 10
    + titleKeywordHits(article) * 8
    + productUpdateScore(article) * 6
    + actionableScore(article) * 5
    + xConversionScore(article) * 4
    - macroPenalty(article) * 8;
}

function candidateRank(article) {
  const score = creationScore(article);
  return xConversionScore(article) * 30
    + actionableScore(article) * 10
    + productUpdateScore(article) * 5
    + score.toolish * 4
    + score.practical * 3
    + score.shareable * 4
    + titleKeywordHits(article) * 3
    - macroPenalty(article) * 24;
}

function creationScore(article) {
  const text = `${article.title}\n${article.summary}`.toLowerCase();
  const practical = countTerms(text, ["实战", "指南", "教程", "技巧", "部署", "迁移", "本地", "guide", "tutorial", "how to", "新功能", "发布", "上线", "升级", "更新", "launch", "release"]);
  const toolish = article.keywordHits.filter((word) => ["Codex", "Agent", "Claude", "Gemini", "OpenAI", "ChatGPT", "MCP", "GPT", "LLM", "deepseek", "Qwen", "Kimi", "Doubao", "豆包", "通义", "智谱", "GLM", "MiniMax"].includes(word)).length;
  const shareable = countTerms(text, ["踩坑", "复盘", "避坑", "成本", "安全", "对比", "mistake", "security"]);
  return { practical, toolish, shareable };
}

function scoreLabel(score) { const total = score.practical * 2 + score.toolish * 2 + score.shareable; return total >= 8 ? "高" : (total >= 4 ? "中" : "低"); }

function productUpdateScore(article) {
  const text = `${article.title}\n${article.summary}\n${article.feedTitle}`.toLowerCase();
  const productHits = countTerms(text, ["claude", "anthropic", "gemini", "google ai", "deepmind", "openai", "chatgpt", "codex", "deepseek", "qwen", "kimi", "doubao", "豆包", "通义", "智谱", "glm", "minimax", "veo", "imagen", "notebooklm", "ai studio"]);
  const updateHits = countTerms(text, ["发布", "推出", "上线", "升级", "更新", "新增", "新功能", "模型", "launch", "release", "introduce", "update", "new feature", "rollout"]);
  return (article.category === "ai-product-updates" ? 2 : 0) + Math.min(productHits, 3) + Math.min(updateHits, 3);
}

function actionableScore(article) {
  return Math.min(countTerms(`${article.title}\n${article.summary}\n${article.feedTitle}`.toLowerCase(), [
    "教程", "指南", "实战", "实践", "踩坑", "避坑", "工作流", "自动化", "插件", "扩展", "api", "mcp", "cli", "github", "vercel", "chrome", "本地", "部署", "集成", "prompt", "提示词", "how to", "guide", "tutorial", "workflow", "plugin", "extension", "release"
  ]), 8);
}

function xConversionScore(article) {
  const text = `${article.title}\n${article.summary}\n${article.feedTitle}`.toLowerCase();
  let hits = countTerms(text, ["工具发现", "工具清单", "产品拆解", "开发者资源", "资源入口", "下载", "书单", "清单", "合集", "模板", "prompt", "提示词", "知识管理", "收藏", "速查", "awesome", "tool list", "resource", "template", "prompt library", "knowledge management"]);
  hits += countTerms(text, ["token", "额度", "用量", "成本", "限额", "丢上下文", "一行命令", "零安装", "实测", "踩坑", "避坑"]);
  if (text.includes("github") || text.includes("开源") || text.includes("下载") || text.includes("入口")) {
    hits += 2;
  }
  return Math.max(0, Math.min(hits, 10));
}

function macroPenalty(article) {
  const text = `${article.title}\n${article.summary}\n${article.feedTitle}`.toLowerCase();
  let penalty = countTerms(text, ["上市", "融资", "估值", "ceo", "营收", "利润", "资本", "商业化", "股价", "裁员", "就业", "行业", "巨头"]);
  if (article.feedTitle === "36氪 - 24小时热榜" || article.feedTitle === "AI 产品更新搜索") {
    penalty += 1;
  }
  if (actionableScore(article) >= 4) {
    penalty = Math.max(0, penalty - 2);
  }
  return Math.min(penalty, 8);
}

function topicBucket(article) {
  const text = `${article.title}\n${article.summary}`.toLowerCase();
  if (xConversionScore(article) >= 4) return "x_growth_resources";
  if (article.category === "ai-product-updates" || productUpdateScore(article) >= 3) return "ai_product_updates";
  if (text.includes("prompt") || text.includes("提示词") || text.includes("llm")) return "ai_usage_tutorial";
  if (text.includes("知识库") || text.includes("obsidian") || text.includes("notebooklm")) return "ai_content_knowledge";
  if (text.includes("token") || text.includes("安全") || text.includes("成本")) return "agent_risk_cost_security";
  if (text.includes("部署") || text.includes("workflow") || text.includes("工作流")) return "ai_engineering_workflow";
  if (text.includes("agent") || text.includes("智能体") || text.includes("mcp")) return "agent_tools";
  return "general_ai";
}

function titleKeywordHits(article) { return keywordHits(article.title).length; }

function fieldName(category) { return FIELD_LABELS[category] || String(category || "RSS").replace(/-/g, " "); }

function normalizedKey(article) { return article.url ? article.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : article.title.toLowerCase().replace(/\W+/g, ""); }

function isEnglishTitle(value) { return !/[\u4e00-\u9fff]/.test(value || "") && ((value || "").match(/[A-Za-z]/g) || []).length >= 8; }

function countTerms(text, terms) { return terms.filter((term) => text.includes(term.toLowerCase())).length; }

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeRegex(text) { return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function withTimeout(promise, ms, message) { return Promise.race([promise, delay(ms).then(() => { throw new Error(message); })]); }

function matchBlocks(text, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return Array.from(String(text || "").matchAll(pattern), (match) => match[1]);
}

function readTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = String(block || "").match(pattern);
  return match ? decodeXml(stripCdata(match[1])) : "";
}

function readAtomLink(block) { const match = String(block || "").match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i); return match ? decodeXml(match[1]) : ""; }

function cleanText(text, limit) {
  const cleaned = decodeXml(String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const maxLength = Number(limit || 500);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function stripCdata(text) {
  return String(text || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractMarkdownSection(text, heading) {
  const lines = String(text || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) {
    return "";
  }
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) {
      break;
    }
    body.push(line);
  }
  return body.join("\n").trim();
}

function extractFencedBlock(text, heading) {
  const match = String(text || "").match(new RegExp(`### ${escapeRegex(heading)}[\\s\\S]*?\`\`\`text\\n([\\s\\S]*?)\\n\`\`\``));
  return match ? match[1].trim() : "";
}

function firstMatch(text, pattern) { const match = String(text || "").match(pattern); return match ? match[1].trim() : ""; }

function firstMarkdownLinkUrl(text) { return firstMatch(text, /\[[^\]]+\]\(([^)]+)\)/); }

module.exports = { RssBriefService };
