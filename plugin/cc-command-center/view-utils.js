function cleanErrorMessage(message) {
  return String(message || "未知错误").replace(/\s+/g, " ").trim().slice(0, 260);
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseOutputPath(stdout) {
  const match = String(stdout || "").match(/^OUTPUT:(.+)$/m);
  return match ? match[1].trim() : null;
}

module.exports = { cleanErrorMessage, formatElapsed, parseOutputPath };
