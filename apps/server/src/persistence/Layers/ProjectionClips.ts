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

function toFtsMatchQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `"${token.replace(/"/g, "\"\"")}"`)
    .join(" ");
}

const makeProjectionClipRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionClipRow,
    execute: (r) =>
      sql`
        INSERT INTO projection_clips (
          id, content, content_type, preview, image_data_url,
          pinned, tags_json, category, source_app,
          paste_count, captured_at, deleted_at, metadata_json
        )
        VALUES (
          ${r.id}, ${r.content}, ${r.contentType}, ${r.preview}, ${r.imageDataUrl},
          ${r.pinned}, ${r.tagsJson}, ${r.category}, ${r.sourceApp},
          ${r.pasteCount}, ${r.capturedAt}, ${r.deletedAt}, ${r.metadataJson}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          content = excluded.content,
          content_type = excluded.content_type,
          preview = excluded.preview,
          image_data_url = excluded.image_data_url,
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

  const upsertFts = (id: string, content: string, preview: string, category: string) =>
    sql`DELETE FROM clips_fts WHERE id = ${id}`.pipe(
      Effect.flatMap(() =>
        sql`INSERT INTO clips_fts (id, content, preview, category) VALUES (${id}, ${content}, ${preview}, ${category})`,
      ),
    );

  const getByIdRow = SqlSchema.findOneOption({
    Request: IdInput,
    Result: ProjectionClipRow,
    execute: ({ id }) =>
      sql`
        SELECT id, content, content_type AS "contentType", preview,
               image_data_url AS "imageDataUrl", pinned,
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
               image_data_url AS "imageDataUrl", pinned,
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
    execute: ({ query, limit }) =>
      sql`
        SELECT c.id, c.content, c.content_type AS "contentType", c.preview,
               c.image_data_url AS "imageDataUrl", c.pinned,
               c.tags_json AS "tagsJson", c.category, c.source_app AS "sourceApp",
               c.paste_count AS "pasteCount", c.captured_at AS "capturedAt",
               c.deleted_at AS "deletedAt", c.metadata_json AS "metadataJson"
        FROM clips_fts f
        JOIN projection_clips c ON c.id = f.id
        WHERE clips_fts MATCH ${query}
          AND c.deleted_at IS NULL
        ORDER BY rank
        LIMIT ${limit}
      `,
  });

  const upsert: ProjectionClipRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.flatMap(() => upsertFts(row.id, row.content, row.preview, row.category)),
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
    if (query.length === 0) {
      return Effect.succeed([]);
    }

    return searchRows({ ...input, query }).pipe(
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
