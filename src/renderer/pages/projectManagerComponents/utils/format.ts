// ── Format helpers ────────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function fileIcon(name: string): string {
  if (name === "agents.md") return "🤖";
  if (name === "tasks.md") return "✅";
  if (name === "memory.md") return "🧠";
  if (name === "README.md") return "📋";
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".json")) return "🔧";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "⚡";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "🟨";
  if (name.endsWith(".css") || name.endsWith(".scss")) return "🎨";
  if (name.endsWith(".py")) return "🐍";
  if (name.endsWith(".sh")) return "🖥️";
  if (name.endsWith(".env") || name.startsWith(".env")) return "🔐";
  return "📄";
}
