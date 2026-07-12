export function normalizeApiKey(raw: string): string {
  let key = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  return key.replace(/\s+/g, "");
}

export function maskApiKey(raw: string): string | null {
  const key = normalizeApiKey(raw);
  if (!key) return null;
  if (key.length <= 8) return "xai-••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function validateApiKeyFormat(raw: string): string | null {
  const key = normalizeApiKey(raw);
  if (!key) return "API key is empty. Paste your key and click Save.";
  if (!key.startsWith("xai-")) {
    return "This does not look like an xAI API key (expected xai-…). Create one at console.x.ai → API Keys — not your Grok login password.";
  }
  if (key.length < 24) {
    return "API key seems too short. Copy the full key from console.x.ai.";
  }
  return null;
}