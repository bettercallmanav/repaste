export type OcrResult =
  | { readonly status: "ok"; readonly text: string }
  | { readonly status: "empty" }
  | { readonly status: "error" };

export interface OcrProvider {
  readonly isAvailable: boolean;
  extractText(imagePath: string): Promise<OcrResult>;
}
