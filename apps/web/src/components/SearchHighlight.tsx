import type { Clip } from "@clipm/contracts";

const MAX_TERMS = 8;
const SNIPPET_CONTEXT_CHARS = 80;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSearchTerms(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const token of query.trim().split(/\s+/)) {
    const normalized = token.trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(normalized);
    if (terms.length >= MAX_TERMS) {
      break;
    }
  }

  return terms;
}

function buildRegex(query: string, flags: string): RegExp | null {
  const terms = getSearchTerms(query);
  if (terms.length === 0) {
    return null;
  }

  return new RegExp(`(${terms.map(escapeRegExp).join("|")})`, flags);
}

function matchesText(text: string | null | undefined, query: string): boolean {
  if (!text || text.length === 0) {
    return false;
  }

  const regex = buildRegex(query, "i");
  return regex ? regex.test(text) : false;
}

export function getSearchSnippet(text: string, query: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }

  const regex = buildRegex(query, "i");
  if (!regex) {
    return text.slice(0, maxLength) + "\u2026";
  }

  const match = regex.exec(text);
  if (!match || match.index === undefined) {
    return text.slice(0, maxLength) + "\u2026";
  }

  const start = Math.max(0, match.index - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? "\u2026" : "";
  const suffix = end < text.length ? "\u2026" : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const regex = buildRegex(query, "gi");
  const singleMatchRegex = buildRegex(query, "i");
  if (!regex || text.length === 0) {
    return <>{text}</>;
  }

  const parts = text.split(regex);
  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        singleMatchRegex?.test(part)
          ? <mark key={`${part}-${index}`} className="ui-highlight rounded px-0.5">{part}</mark>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </>
  );
}

export function getClipSearchMatchMeta(clip: Clip, query: string): {
  readonly ocrOnlyMatch: boolean;
  readonly ocrSnippet: string | null;
  readonly matchedFields: readonly string[];
} {
  if (!query || query.trim().length === 0) {
    return { ocrOnlyMatch: false, ocrSnippet: null, matchedFields: [] };
  }

  const fields: string[] = [];
  if (matchesText(clip.content, query) || matchesText(clip.preview, query)) fields.push("content");
  if (matchesText(clip.tags.join(" "), query)) fields.push("tag");
  if (matchesText(clip.sourceApp, query)) fields.push("sourceApp");
  const hasOcrMatch = matchesText(clip.ocrText, query);
  if (hasOcrMatch) fields.push("ocrText");

  const hasVisibleTextMatch = fields.some((f) => f !== "ocrText");

  return {
    ocrOnlyMatch: hasOcrMatch && !hasVisibleTextMatch,
    ocrSnippet: hasOcrMatch && clip.ocrText
      ? getSearchSnippet(clip.ocrText, query, 160)
      : null,
    matchedFields: fields,
  };
}
