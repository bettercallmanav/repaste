import type { ContentType, ClipMetadata } from "@clipm/contracts";

// ─── URL Detection ───────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/[^\s]+$/i;
const LOOSE_URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;

function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return URL_RE.test(trimmed) || LOOSE_URL_RE.test(trimmed);
}

// ─── Email Detection ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isEmail(text: string): boolean {
  return EMAIL_RE.test(text.trim());
}

// ─── Color Detection ─────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/;
const HSL_RE = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*[\d.]+\s*)?\)$/;

function isColor(text: string): boolean {
  const trimmed = text.trim();
  return HEX_COLOR_RE.test(trimmed) || RGB_RE.test(trimmed) || HSL_RE.test(trimmed);
}

// ─── JSON Detection ──────────────────────────────────────────────────────────

function isJson(text: string): boolean {
  const trimmed = text.trim();
  if ((!trimmed.startsWith("{") && !trimmed.startsWith("[")) || trimmed.length < 2) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

// ─── File Path Detection ─────────────────────────────────────────────────────

const UNIX_PATH_RE = /^(\/[\w.-]+)+\/?$/;
const WIN_PATH_RE = /^[a-zA-Z]:\\[\w\\.-]+$/;
const HOME_PATH_RE = /^~\/[\w./\\-]+$/;

function isFilePath(text: string): boolean {
  const trimmed = text.trim();
  return UNIX_PATH_RE.test(trimmed) || WIN_PATH_RE.test(trimmed) || HOME_PATH_RE.test(trimmed);
}

// ─── Phone Number Detection ──────────────────────────────────────────────────

const PHONE_RE = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

function isPhoneNumber(text: string): boolean {
  return PHONE_RE.test(text.trim());
}

// ─── Code Detection (Heuristic) ──────────────────────────────────────────────

const CODE_INDICATORS = [
  /^\s*(import|export|const|let|var|function|class|interface|type|enum)\s/m,
  /^\s*(def|class|import|from|return|if|elif|else|for|while)\s/m,
  /[{};]\s*$/m,
  /=>\s*[{(]/m,
  /^\s*<[a-zA-Z][^>]*\/?\s*>\s*$/m,
  /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/im,
];

function isCode(text: string): boolean {
  if (text.length < 10) return false;
  let matches = 0;
  for (const re of CODE_INDICATORS) {
    if (re.test(text)) matches++;
  }
  return matches >= 2;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function categorize(text: string): ContentType {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "text";

  if (isUrl(trimmed)) return "url";
  if (isEmail(trimmed)) return "email";
  if (isColor(trimmed)) return "color";
  if (isJson(trimmed)) return "json";
  if (isFilePath(trimmed)) return "filePath";
  if (isPhoneNumber(trimmed)) return "phone";
  if (isCode(trimmed)) return "code";

  return "text";
}

export function extractMetadata(text: string, contentType: ContentType): ClipMetadata {
  const lines = text.split("\n");
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);

  return {
    charCount: text.length as ClipMetadata["charCount"],
    wordCount: words.length as ClipMetadata["wordCount"],
    lineCount: lines.length as ClipMetadata["lineCount"],
    language: contentType === "code" ? detectLanguage(text) : null,
    url: contentType === "url" ? text.trim() : null,
  };
}

function detectLanguage(text: string): string | null {
  if (/^\s*(import|export)\s.*from\s/m.test(text)) return "javascript";
  if (/^\s*def\s+\w+.*:/m.test(text)) return "python";
  if (/^\s*func\s+\w+/m.test(text)) return "go";
  if (/^\s*fn\s+\w+/m.test(text)) return "rust";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\s/im.test(text)) return "sql";
  if (/<[a-zA-Z][^>]*>/m.test(text) && /<\/[a-zA-Z]+>/m.test(text)) return "html";
  if (/^\s*\{[\s\S]*"[\w]+":/m.test(text)) return "json";
  return null;
}
