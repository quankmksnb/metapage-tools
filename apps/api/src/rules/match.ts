export type RuleMatchType = "contains" | "regex" | "exact";

export function commentMatchesRule(
  message: string,
  matchType: RuleMatchType,
  pattern: string,
  caseSensitive: boolean,
): boolean {
  const text = caseSensitive ? message : message.toLowerCase();
  const pat = caseSensitive ? pattern : pattern.toLowerCase();
  switch (matchType) {
    case "exact":
      return text === pat;
    case "contains":
      return text.includes(pat);
    case "regex": {
      try {
        const flags = caseSensitive ? "" : "i";
        return new RegExp(pattern, flags).test(message);
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
