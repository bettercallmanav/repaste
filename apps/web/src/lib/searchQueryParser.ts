import type { ClipSearchFilters, ContentType } from "@clipm/contracts";

const VALID_CONTENT_TYPES = new Set<string>([
  "text", "image", "richText", "filePath", "url",
  "code", "email", "color", "json", "phone",
]);

type MutableFilters = {
  -readonly [K in keyof ClipSearchFilters]?: ClipSearchFilters[K];
};

export interface ParsedSearchQuery {
  readonly text: string;
  readonly filters: Partial<ClipSearchFilters>;
}

/**
 * Parses a search query string with optional prefix syntax into
 * a free-text portion and structured filters.
 *
 * Supported prefixes:
 *   type:image        — filter by content type
 *   tag:design        — filter by tag (supports quotes: tag:"my tag")
 *   app:Chrome        — filter by source app
 *   pinned:true       — filter pinned only
 *   from:2024-01-01   — date range start
 *   to:2024-12-31     — date range end
 *
 * Unrecognized tokens pass through as free-text search terms.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const filters: MutableFilters = {};
  const textParts: string[] = [];

  const tokens = tokenize(raw);

  for (const token of tokens) {
    const colonIndex = token.indexOf(":");
    if (colonIndex <= 0) {
      textParts.push(token);
      continue;
    }

    const prefix = token.slice(0, colonIndex).toLowerCase();
    let value = token.slice(colonIndex + 1);

    // Strip surrounding quotes
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    if (value.length === 0) {
      textParts.push(token);
      continue;
    }

    switch (prefix) {
      case "type":
        if (VALID_CONTENT_TYPES.has(value)) {
          filters.contentType = value as ContentType;
        } else {
          textParts.push(token);
        }
        break;
      case "tag":
        filters.tag = value;
        break;
      case "app":
        filters.sourceApp = value;
        break;
      case "pinned":
        if (value === "true" || value === "yes" || value === "1") {
          filters.pinned = true;
        }
        break;
      case "from":
        filters.dateFrom = value;
        break;
      case "to":
        filters.dateTo = value;
        break;
      default:
        // Not a recognized prefix — treat as plain text
        textParts.push(token);
    }
  }

  return {
    text: textParts.join(" ").trim(),
    filters,
  };
}

/**
 * Tokenizes input respecting quoted values in prefix:value pairs.
 * e.g. `tag:"my tag" sunset` → ["tag:\"my tag\"", "sunset"]
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && input[i] === " ") i++;
    if (i >= len) break;

    let token = "";
    // Read until whitespace or quote after colon
    while (i < len && input[i] !== " ") {
      if (input[i] === ":" && i + 1 < len && (input[i + 1] === '"' || input[i + 1] === "'")) {
        const quote = input[i + 1];
        token += ":";
        i++; // skip ':'
        token += quote;
        i++; // skip opening quote
        while (i < len && input[i] !== quote) {
          token += input[i];
          i++;
        }
        if (i < len) {
          token += input[i]; // closing quote
          i++;
        }
      } else {
        token += input[i];
        i++;
      }
    }

    if (token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Formats active filters as human-readable labels for chip display.
 */
export function getFilterLabels(filters: Partial<ClipSearchFilters>): Array<{ key: string; label: string }> {
  const labels: Array<{ key: string; label: string }> = [];

  if (filters.contentType) labels.push({ key: "contentType", label: `type: ${filters.contentType}` });
  if (filters.pinned) labels.push({ key: "pinned", label: "pinned" });
  if (filters.tag) labels.push({ key: "tag", label: `tag: ${filters.tag}` });
  if (filters.sourceApp) labels.push({ key: "sourceApp", label: `app: ${filters.sourceApp}` });
  if (filters.dateFrom) labels.push({ key: "dateFrom", label: `from: ${filters.dateFrom}` });
  if (filters.dateTo) labels.push({ key: "dateTo", label: `to: ${filters.dateTo}` });

  return labels;
}
