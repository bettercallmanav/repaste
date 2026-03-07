import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";
import { SnippetId } from "@clipm/contracts";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ProjectionSnippetRepository,
  ProjectionSnippetRow,
  type ProjectionSnippetRepositoryShape,
} from "../Services/ProjectionSnippets.ts";

const IdInput = Schema.Struct({ id: SnippetId });
const SoftDeleteInput = Schema.Struct({ id: SnippetId, deletedAt: Schema.String });

const makeProjectionSnippetRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionSnippetRow,
    execute: (r) =>
      sql`
        INSERT INTO projection_snippets (
          id, title, content, shortcut, usage_count,
          created_at, updated_at, deleted_at
        )
        VALUES (
          ${r.id}, ${r.title}, ${r.content}, ${r.shortcut}, ${r.usageCount},
          ${r.createdAt}, ${r.updatedAt}, ${r.deletedAt}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          shortcut = excluded.shortcut,
          usage_count = excluded.usage_count,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
  });

  const getByIdRow = SqlSchema.findOneOption({
    Request: IdInput,
    Result: ProjectionSnippetRow,
    execute: ({ id }) =>
      sql`
        SELECT id, title, content, shortcut,
               usage_count AS "usageCount",
               created_at AS "createdAt",
               updated_at AS "updatedAt",
               deleted_at AS "deletedAt"
        FROM projection_snippets WHERE id = ${id}
      `,
  });

  const listAllRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionSnippetRow,
    execute: () =>
      sql`
        SELECT id, title, content, shortcut,
               usage_count AS "usageCount",
               created_at AS "createdAt",
               updated_at AS "updatedAt",
               deleted_at AS "deletedAt"
        FROM projection_snippets
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `,
  });

  const upsert: ProjectionSnippetRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(Effect.mapError(toPersistenceSqlError("ProjectionSnippets.upsert")));

  const getById: ProjectionSnippetRepositoryShape["getById"] = (id) =>
    getByIdRow({ id }).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionSnippets.getById")),
    );

  const listAll: ProjectionSnippetRepositoryShape["listAll"] = () =>
    listAllRows(undefined as void).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionSnippets.listAll")),
    );

  const softDelete: ProjectionSnippetRepositoryShape["softDelete"] = (id, deletedAt) =>
    SqlSchema.void({
      Request: SoftDeleteInput,
      execute: (r) =>
        sql`UPDATE projection_snippets SET deleted_at = ${r.deletedAt} WHERE id = ${r.id}`,
    })({ id, deletedAt }).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionSnippets.softDelete")),
    );

  return { upsert, getById, listAll, softDelete } satisfies ProjectionSnippetRepositoryShape;
});

export const ProjectionSnippetRepositoryLive = Layer.effect(
  ProjectionSnippetRepository,
  makeProjectionSnippetRepository,
);
