export type RuleMatchType = "contains" | "regex" | "exact";

export function commentMatchesRule(
  message: string,
  matchType: RuleMatchType,
  pattern: string,
  caseSensitive: boolean,
): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFC")
      .replace(/\u200b/g, "")
      .trim();
  const cs = caseSensitive === true;
  const msg = norm(message);
  const pat = norm(pattern);
  const kind = String(matchType).trim().toLowerCase();
  switch (kind) {
    case "exact": {
      if (cs) return msg === pat;
      return msg.toLowerCase() === pat.toLowerCase();
    }
    case "contains":
      // Không dùng toLowerCase cả chuỗi — tránh lệch ký tự tiếng Việt (đ/à).
      return msg.includes(pat);
    case "regex": {
      try {
        const flags = cs ? "" : "i";
        return new RegExp(pat, flags).test(msg);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export function pickReplyTemplate(
  templates: string[],
  seed: string,
): string | null {
  if (templates.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i)) % templates.length;
  }
  return templates[hash] ?? templates[0];
}
