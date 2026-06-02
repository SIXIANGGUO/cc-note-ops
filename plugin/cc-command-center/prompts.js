function buildManualPrompt(note, profile, profileText) {
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

function buildRssPrompt(brief) {
  const candidate = brief.xCandidate || {};
  return `请基于今天工作台生成的 RSS Markdown 日报，生成一条可直接发布的不滑锅中文 X 推文。

日报文件：${brief.filePath}
候选标题：${candidate.title || ""}
原文链接：${candidate.url || ""}
选择理由：${candidate.reason || ""}

要求：
1. 不是摘要导流，要写成原创判断。
2. 优先突出工具、入口、工作流、资源或可马上尝试的价值。
3. 读者看完能收藏或转发。
4. 不要编造 RSS 日报里没有的事实。`;
}

module.exports = { buildManualPrompt, buildRssPrompt };
