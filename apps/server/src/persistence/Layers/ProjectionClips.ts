import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";
import { ClipId } from "@clipm/contracts";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ProjectionClipRepository,
  ProjectionClipRow,
  SearchInput,
  type ProjectionClipRepositoryShape,
} from "../Services/ProjectionClips.ts";

const IdInput = Schema.Struct({ id: ClipId });
const PinInput = Schema.Struct({ id: ClipId, pinned: Schema.Number });
const TagsInput = Schema.Struct({ id: ClipId, tagsJson: Schema.String });
const SoftDeleteInput = Schema.Struct({ id: ClipId, deletedAt: Schema.String });
type SearchFilters = Exclude<SearchInput["filters"], undefined>;

function toFtsMatchQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `"${token.replace(/"/g, "\"\"")}"`)
    .join(" ");
}

function normalizeSearchFilters(filters: SearchInput["filters"]): SearchFilters | undefined {
  if (!filters) return undefined;

  const tag = filters.tag?.trim();
  const sourceApp = filters.sourceApp?.trim();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();
  const normalized: SearchFilters = {
    ...(filters.contentType !== undefined ? { contentType: filters.contentType } : {}),
    ...(filters.pinned !== undefined ? { pinned: filters.pinned } : {}),
    ...(tag && tag.length > 0 ? { tag } : {}),
    ...(sourceApp && sourceApp.length > 0 ? { sourceApp } : {}),
    ...(dateFrom && dateFrom.length > 0 ? { dateFrom } : {}),
    ...(dateTo && dateTo.length > 0 ? { dateTo } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function toFtsTagDocument(tagsJson: unknown): string {
  if (Array.isArray(tagsJson)) {
    return tagsJson.filter((tag): tag is string => typeof tag === "string").join(" ");
  }

  if (typeof tagsJson === "string") {
    try {
      const parsed = JSON.parse(tagsJson) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === "string").join(" ");
      }
    } catch {
      return "";
    }
  }

  return "";
}

const makeProjectionClipRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionClipRow,
    execute: (r) =>
      sql`
        INSERT INTO projection_clips (
          id, content, content_type, preview, image_data_url,
          image_asset_id, image_asset_path, image_width, image_height, image_mime_type, ocr_text,
          pinned, tags_json, category, source_app,
          paste_count, captured_at, deleted_at, metadata_json
        )
        VALUES (
          ${r.id}, ${r.content}, ${r.contentType}, ${r.preview}, ${r.imageDataUrl},
          ${r.imageAssetId}, ${r.imageAssetPath}, ${r.imageWidth}, ${r.imageHeight}, ${r.imageMimeType}, ${r.ocrText},
          ${r.pinned}, ${r.tagsJson}, ${r.category}, ${r.sourceApp},
          ${r.pasteCount}, ${r.capturedAt}, ${r.deletedAt}, ${r.metadataJson}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          content = excluded.content,
          content_type = excluded.content_type,
          preview = excluded.preview,
          image_data_url = excluded.image_data_url,
          image_asset_id = excluded.image_asset_id,
          image_asset_path = excluded.image_asset_path,
          image_width = excluded.image_width,
          image_height = excluded.image_height,
          image_mime_type = excluded.image_mime_type,
          ocr_text = excluded.ocr_text,
          pinned = excluded.pinned,
          tags_json = excluded.tags_json,
          category = excluded.category,
          source_app = excluded.source_app,
          paste_count = excluded.paste_count,
          captured_at = excluded.captured_at,
          deleted_at = excluded.deleted_at,
          metadata_json = excluded.metadata_json
      `,
  });

  const upsertFts = (
    id: string,
    content: string,
    preview: string,
    category: string,
    tagsDocument: string,
    sourceApp: string | null,
    ocrText: string | null,
  ) =>
    sql`DELETE FROM clips_fts WHERE id = ${id}`.pipe(
      Effect.flatMap(() =>
        sql`
          INSERT INTO clips_fts (id, content, preview, category, tags, source_app, ocr_text)
          VALUES (${id}, ${content}, ${preview}, ${category}, ${tagsDocument}, ${sourceApp ?? ""}, ${ocrText ?? ""})
        `,
      ),
    );

  const getByIdRow = SqlSchema.findOneOption({
    Request: IdInput,
    Result: ProjectionClipRow,
    execute: ({ id }) =>
      sql`
        SELECT id, content, content_type AS "contentType", preview,
               image_data_url AS "imageDataUrl",
               image_asset_id AS "imageAssetId",
               image_asset_path AS "imageAssetPath",
               image_width AS "imageWidth",
               image_height AS "imageHeight",
               image_mime_type AS "imageMimeType",
               ocr_text AS "ocrText",
               pinned,
               tags_json AS "tagsJson", category, source_app AS "sourceApp",
               paste_count AS "pasteCount", captured_at AS "capturedAt",
               deleted_at AS "deletedAt", metadata_json AS "metadataJson"
        FROM projection_clips WHERE id = ${id}
      `,
  });

  const listAllRows = SqlSchema.findAll({
    Request: Schema.Struct({ limit: Schema.Number }),
    Result: ProjectionClipRow,
    execute: ({ limit }) =>
      sql`
        SELECT id, content, content_type AS "contentType", preview,
               image_data_url AS "imageDataUrl",
               image_asset_id AS "imageAssetId",
               image_asset_path AS "imageAssetPath",
               image_width AS "imageWidth",
               image_height AS "imageHeight",
               image_mime_type AS "imageMimeType",
               ocr_text AS "ocrText",
               pinned,
               tags_json AS "tagsJson", category, source_app AS "sourceApp",
               paste_count AS "pasteCount", captured_at AS "capturedAt",
               deleted_at AS "deletedAt", metadata_json AS "metadataJson"
        FROM projection_clips
        WHERE deleted_at IS NULL
        ORDER BY captured_at DESC
        LIMIT ${limit}
      `,
  });

  const searchRows = SqlSchema.findAll({
    Request: SearchInput,
    Result: ProjectionClipRow,
    execute: ({ query, rawQuery, filters, limit }) => {
      const normalizedFilters = normalizeSearchFilters(filters);
      const normalizedRawQuery = rawQuery?.trim() ?? "";
      const prefixQuery = `${normalizedRawQuery}%`;
      const contentType = normalizedFilters?.contentType ?? null;
      const pinned = normalizedFilters?.pinned === undefined
        ? null
        : normalizedFilters.pinned
          ? 1
          : 0;
      const tag = normalizedFilters?.tag ?? null;
      const sourceApp = normalizedFilters?.sourceApp ?? null;
      const dateFrom = normalizedFilters?.dateFrom ?? null;
      const dateTo = normalizedFilters?.dateTo ?? null;

      return sql`
        SELECT c.id, c.content, c.content_type AS "contentType", c.preview,
               c.image_data_url AS "imageDataUrl",
               c.image_asset_id AS "imageAssetId",
               c.image_asset_path AS "imageAssetPath",
               c.image_width AS "imageWidth",
               c.image_height AS "imageHeight",
               c.image_mime_type AS "imageMimeType",
               c.ocr_text AS "ocrText",
               c.pinned,
               c.tags_json AS "tagsJson", c.category, c.source_app AS "sourceApp",
               c.paste_count AS "pasteCount", c.captured_at AS "capturedAt",
               c.deleted_at AS "deletedAt", c.metadata_json AS "metadataJson"
        FROM clips_fts f
        JOIN projection_clips c ON c.id = f.id
        WHERE clips_fts MATCH ${query}
          AND c.deleted_at IS NULL
          AND (${contentType} IS NULL OR c.content_type = ${contentType})
          AND (${pinned} IS NULL OR c.pinned = ${pinned})
          AND (${tag} IS NULL OR EXISTS (
            SELECT 1
            FROM json_each(c.tags_json) tags
            WHERE tags.value = ${tag}
          ))
          AND (${sourceApp} IS NULL OR c.source_app = ${sourceApp})
          AND (${dateFrom} IS NULL OR date(c.captured_at) >= date(${dateFrom}))
          AND (${dateTo} IS NULL OR date(c.captured_at) <= date(${dateTo}))
        ORDER BY
          CASE
            WHEN ${normalizedRawQuery} = '' THEN 4
            WHEN lower(trim(c.content)) = lower(${normalizedRawQuery}) THEN 0
            WHEN lower(COALESCE(c.source_app, '')) = lower(${normalizedRawQuery}) THEN 1
            WHEN lower(COALESCE(c.ocr_text, '')) = lower(${normalizedRawQuery}) THEN 2
            WHEN lower(c.content) LIKE lower(${prefixQuery}) THEN 3
            WHEN lower(c.preview) LIKE lower(${prefixQuery}) THEN 4
            WHEN lower(COALESCE(c.ocr_text, '')) LIKE lower(${prefixQuery}) THEN 5
            ELSE 6
          END,
          c.pinned DESC,
          rank,
          c.paste_count DESC,
          c.captured_at DESC
        LIMIT ${limit}
      `;
    },
  });

  const filteredRows = SqlSchema.findAll({
    Request: SearchInput,
    Result: ProjectionClipRow,
    execute: ({ filters, limit }) => {
      const normalizedFilters = normalizeSearchFilters(filters);
      const contentType = normalizedFilters?.contentType ?? null;
      const pinned = normalizedFilters?.pinned === undefined
        ? null
        : normalizedFilters.pinned
          ? 1
          : 0;
      const tag = normalizedFilters?.tag ?? null;
      const sourceApp = normalizedFilters?.sourceApp ?? null;
      const dateFrom = normalizedFilters?.dateFrom ?? null;
      const dateTo = normalizedFilters?.dateTo ?? null;

      return sql`
        SELECT c.id, c.content, c.content_type AS "contentType", c.preview,
               c.image_data_url AS "imageDataUrl",
               c.image_asset_id AS "imageAssetId",
               c.image_asset_path AS "imageAssetPath",
               c.image_width AS "imageWidth",
               c.image_height AS "imageHeight",
               c.image_mime_type AS "imageMimeType",
               c.ocr_text AS "ocrText",
               c.pinned,
               c.tags_json AS "tagsJson", c.category, c.source_app AS "sourceApp",
               c.paste_count AS "pasteCount", c.captured_at AS "capturedAt",
               c.deleted_at AS "deletedAt", c.metadata_json AS "metadataJson"
        FROM projection_clips c
        WHERE c.deleted_at IS NULL
          AND (${contentType} IS NULL OR c.content_type = ${contentType})
          AND (${pinned} IS NULL OR c.pinned = ${pinned})
          AND (${tag} IS NULL OR EXISTS (
            SELECT 1
            FROM json_each(c.tags_json) tags
            WHERE tags.value = ${tag}
          ))
          AND (${sourceApp} IS NULL OR c.source_app = ${sourceApp})
          AND (${dateFrom} IS NULL OR date(c.captured_at) >= date(${dateFrom}))
          AND (${dateTo} IS NULL OR date(c.captured_at) <= date(${dateTo}))
        ORDER BY c.pinned DESC, c.paste_count DESC, c.captured_at DESC
        LIMIT ${limit}
      `;
    },
  });

  const upsert: ProjectionClipRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.flatMap(() =>
        upsertFts(
          row.id,
          row.content,
          row.preview,
          row.category,
          toFtsTagDocument(row.tagsJson),
          row.sourceApp,
          row.ocrText,
        )
      ),
      Effect.mapError(toPersistenceSqlError("ProjectionClips.upsert")),
    );

  const getById: ProjectionClipRepositoryShape["getById"] = (id) =>
    getByIdRow({ id }).pipe(Effect.mapError(toPersistenceSqlError("ProjectionClips.getById")));

  const listAll: ProjectionClipRepositoryShape["listAll"] = (limit = 500) =>
    listAllRows({ limit }).pipe(Effect.mapError(toPersistenceSqlError("ProjectionClips.listAll")));

  const deleteById: ProjectionClipRepositoryShape["deleteById"] = (id) =>
    sql`DELETE FROM projection_clips WHERE id = ${id}`.pipe(
      Effect.flatMap(() => sql`DELETE FROM clips_fts WHERE id = ${id}`),
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ProjectionClips.deleteById")),
    );

  const search: ProjectionClipRepositoryShape["search"] = (input) => {
    const query = toFtsMatchQuery(input.query);
    const filters = normalizeSearchFilters(input.filters);
    const normalizedInput: SearchInput = {
      ...input,
      query,
      rawQuery: input.query.trim(),
      filters,
    };

    if (query.length === 0) {
      return filteredRows(normalizedInput).pipe(
        Effect.mapError(toPersistenceSqlError("ProjectionClips.searchFiltered")),
      );
    }

    return searchRows(normalizedInput).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionClips.search")),
    );
  };

  const updatePinned: ProjectionClipRepositoryShape["updatePinned"] = (id, pinned) =>
    SqlSchema.void({
      Request: PinInput,
      execute: (r) =>
        sql`UPDATE projection_clips SET pinned = ${r.pinned} WHERE id = ${r.id}`,
    })({ id, pinned: pinned ? 1 : 0 }).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionClips.updatePinned")),
    );

  const updateTags: ProjectionClipRepositoryShape["updateTags"] = (id, tagsJson) =>
    SqlSchema.void({
      Request: TagsInput,
      execute: (r) =>
        sql`UPDATE projection_clips SET tags_json = ${r.tagsJson} WHERE id = ${r.id}`,
    })({ id, tagsJson }).pipe(
      Effect.flatMap(() => getByIdRow({ id })),
      Effect.flatMap((row) => {
        if (row._tag === "None") {
          return sql`DELETE FROM clips_fts WHERE id = ${id}`.pipe(Effect.asVoid);
        }

        return upsertFts(
          row.value.id,
          row.value.content,
          row.value.preview,
          row.value.category,
          toFtsTagDocument(row.value.tagsJson),
          row.value.sourceApp,
          row.value.ocrText,
        );
      }),
      Effect.mapError(toPersistenceSqlError("ProjectionClips.updateTags")),
    );

  const incrementPasteCount: ProjectionClipRepositoryShape["incrementPasteCount"] = (id) =>
    sql`UPDATE projection_clips SET paste_count = paste_count + 1 WHERE id = ${id}`.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ProjectionClips.incrementPasteCount")),
    );

  const softDelete: ProjectionClipRepositoryShape["softDelete"] = (id, deletedAt) =>
    SqlSchema.void({
      Request: SoftDeleteInput,
      execute: (r) =>
        sql`UPDATE projection_clips SET deleted_at = ${r.deletedAt} WHERE id = ${r.id}`,
    })({ id, deletedAt }).pipe(
      Effect.flatMap(() => sql`DELETE FROM clips_fts WHERE id = ${id}`.pipe(Effect.asVoid)),
      Effect.mapError(toPersistenceSqlError("ProjectionClips.softDelete")),
    );

  return {
    upsert,
    getById,
    listAll,
    deleteById,
    search,
    updatePinned,
    updateTags,
    incrementPasteCount,
    softDelete,
  } satisfies ProjectionClipRepositoryShape;
});

export const ProjectionClipRepositoryLive = Layer.effect(
  ProjectionClipRepository,
  makeProjectionClipRepository,
);
