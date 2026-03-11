import { Schema, ServiceMap } from "effect";
import type { Effect, Option } from "effect";
import { ClipId, ClipSearchFilters, IsoDateTime, NonNegativeInt } from "@clipm/contracts";
import type { ProjectionRepositoryError } from "../Errors.ts";

const UnknownFromJsonString = Schema.fromJsonString(Schema.Unknown);

export const ProjectionClipRow = Schema.Struct({
  id: ClipId,
  content: Schema.String,
  contentType: Schema.String,
  preview: Schema.String,
  imageDataUrl: Schema.NullOr(Schema.String),
  imageAssetId: Schema.NullOr(Schema.String),
  imageAssetPath: Schema.NullOr(Schema.String),
  imageWidth: Schema.NullOr(NonNegativeInt),
  imageHeight: Schema.NullOr(NonNegativeInt),
  imageMimeType: Schema.NullOr(Schema.String),
  ocrText: Schema.NullOr(Schema.String),
  ocrStatus: Schema.NullOr(Schema.String),
  pinned: Schema.Number,
  tagsJson: UnknownFromJsonString,
  category: Schema.String,
  sourceApp: Schema.NullOr(Schema.String),
  pasteCount: NonNegativeInt,
  capturedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
  metadataJson: UnknownFromJsonString,
});
export type ProjectionClipRow = typeof ProjectionClipRow.Type;

export const SearchInput = Schema.Struct({
  query: Schema.String,
  rawQuery: Schema.optional(Schema.String),
  filters: Schema.optional(ClipSearchFilters),
  limit: Schema.Number,
});
export type SearchInput = typeof SearchInput.Type;

export interface ProjectionClipRepositoryShape {
  readonly upsert: (row: ProjectionClipRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    id: ClipId,
  ) => Effect.Effect<Option.Option<ProjectionClipRow>, ProjectionRepositoryError>;
  readonly listAll: (
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<ProjectionClipRow>, ProjectionRepositoryError>;
  readonly deleteById: (id: ClipId) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly search: (
    input: SearchInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionClipRow>, ProjectionRepositoryError>;
  readonly updatePinned: (
    id: ClipId,
    pinned: boolean,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly updateTags: (
    id: ClipId,
    tagsJson: string,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly updateOcrText: (
    id: ClipId,
    ocrText: string,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly updateOcrStatus: (
    id: ClipId,
    ocrStatus: string,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly incrementPasteCount: (id: ClipId) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly softDelete: (
    id: ClipId,
    deletedAt: string,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionClipRepository extends ServiceMap.Service<
  ProjectionClipRepository,
  ProjectionClipRepositoryShape
>()("@clipm/server/persistence/Services/ProjectionClips/ProjectionClipRepository") {}
