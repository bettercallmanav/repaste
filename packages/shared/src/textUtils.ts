const PREVIEW_MAX_LENGTH = 200;

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function generatePreview(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  return truncate(firstLine, PREVIEW_MAX_LENGTH);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export function lineCount(text: string): number {
  return text.split("\n").length;
}

/**
 * Substitute template variables in snippet content.
 * Supported: {{date}}, {{time}}, {{datetime}}, {{clipboard}}
 */
export function substituteVariables(
  template: string,
  clipboardContent: string,
): string {
  const now = new Date();
  return template
    .replaceAll("{{date}}", now.toLocaleDateString())
    .replaceAll("{{time}}", now.toLocaleTimeString())
    .replaceAll("{{datetime}}", now.toLocaleString())
    .replaceAll("{{clipboard}}", clipboardContent);
}
