import type { Clip, ClipId, ContentType } from "@clipm/contracts";
import { Effect, Layer } from "effect";

import { ProjectionClipRepository } from "../../persistence/Services/ProjectionClips.ts";
import type { ProjectionClipRow } from "../../persistence/Services/ProjectionClips.ts";
import { SearchService, type SearchServiceShape } from "../Services/SearchService.ts";

function rowToClip(row: ProjectionClipRow): Clip {
  const tags: string[] = Array.isArray(row.tagsJson) ? row.tagsJson as any : [];
  const metadata = typeof row.metadataJson === "object" && row.metadataJson !== null
    ? row.metadataJson as any
    : { charCount: 0, wordCount: 0, lineCount: 0, language: null, url: null };

  return {
    id: row.id as ClipId,
    content: row.content,
    contentType: row.contentType as ContentType,
    preview: row.preview,
    imageDataUrl: row.imageDataUrl,
    imageAssetId: row.imageAssetId,
    imageAssetPath: row.imageAssetPath,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    imageMimeType: row.imageMimeType,
    ocrText: row.ocrText,
    ocrStatus: row.ocrStatus as any,
    pinned: row.pinned === 1,
    tags,
    category: row.category,
    sourceApp: row.sourceApp,
    pasteCount: row.pasteCount,
    capturedAt: row.capturedAt,
    deletedAt: row.deletedAt,
    metadata,
  };
}

const makeSearchService = Effect.gen(function* () {
  const clipRepo = yield* ProjectionClipRepository;

  const search: SearchServiceShape["search"] = ({ query, filters, limit = 50 }) =>
    clipRepo.search({ query, filters, limit }).pipe(
      Effect.map((rows) => rows.map(rowToClip)),
    );

  return { search } satisfies SearchServiceShape;
});

export const SearchServiceLive = Layer.effect(
  SearchService,
  makeSearchService,
);
