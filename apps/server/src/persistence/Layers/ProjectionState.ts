import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  GetProjectionStateInput,
  ProjectionState,
  ProjectionStateRepository,
  type ProjectionStateRepositoryShape,
} from "../Services/ProjectionState.ts";

const MinSequenceResult = Schema.Struct({
  minSeq: Schema.NullOr(Schema.Number),
});

const makeProjectionStateRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionState,
    execute: (row) =>
      sql`
        INSERT INTO projection_state (projector, last_applied_sequence, updated_at)
        VALUES (${row.projector}, ${row.lastAppliedSequence}, ${row.updatedAt})
        ON CONFLICT (projector)
        DO UPDATE SET
          last_applied_sequence = excluded.last_applied_sequence,
          updated_at = excluded.updated_at
      `,
  });

  const getByProjectorRow = SqlSchema.findOneOption({
    Request: GetProjectionStateInput,
    Result: ProjectionState,
    execute: ({ projector }) =>
      sql`
        SELECT projector, last_applied_sequence AS "lastAppliedSequence", updated_at AS "updatedAt"
        FROM projection_state WHERE projector = ${projector}
      `,
  });

  const listAllRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionState,
    execute: () =>
      sql`
        SELECT projector, last_applied_sequence AS "lastAppliedSequence", updated_at AS "updatedAt"
        FROM projection_state
      `,
  });

  const minSequenceRow = SqlSchema.findOne({
    Request: Schema.Void,
    Result: MinSequenceResult,
    execute: () =>
      sql`SELECT MIN(last_applied_sequence) AS "minSeq" FROM projection_state`,
  });

  const upsert: ProjectionStateRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(Effect.mapError(toPersistenceSqlError("ProjectionState.upsert")));

  const getByProjector: ProjectionStateRepositoryShape["getByProjector"] = (input) =>
    getByProjectorRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionState.getByProjector")),
    );

  const listAll: ProjectionStateRepositoryShape["listAll"] = () =>
    listAllRows(undefined as void).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionState.listAll")),
    );

  const minLastAppliedSequence: ProjectionStateRepositoryShape["minLastAppliedSequence"] = () =>
    minSequenceRow(undefined as void).pipe(
      Effect.map((row) => row.minSeq),
      Effect.catch(() => Effect.succeed(null)),
    );

  return {
    upsert,
    getByProjector,
    listAll,
    minLastAppliedSequence,
  } satisfies ProjectionStateRepositoryShape;
});

export const ProjectionStateRepositoryLive = Layer.effect(
  ProjectionStateRepository,
  makeProjectionStateRepository,
);
