import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ProjectionStatsRepository,
  type ProjectionStatsRepositoryShape,
} from "../Services/ProjectionStats.ts";

const KeyInput = Schema.Struct({ key: Schema.String });
const SetInput = Schema.Struct({ key: Schema.String, valueJson: Schema.String });
const StatsRow = Schema.Struct({ key: Schema.String, valueJson: Schema.String });

const makeProjectionStatsRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const get: ProjectionStatsRepositoryShape["get"] = (key) =>
    SqlSchema.findOneOption({
      Request: KeyInput,
      Result: StatsRow,
      execute: ({ key }) =>
        sql`SELECT key, value_json AS "valueJson" FROM projection_stats WHERE key = ${key}`,
    })({ key }).pipe(
      Effect.map((opt) => (opt._tag === "Some" ? opt.value.valueJson : null)),
      Effect.mapError(toPersistenceSqlError("ProjectionStats.get")),
    );

  const set: ProjectionStatsRepositoryShape["set"] = (key, valueJson) =>
    SqlSchema.void({
      Request: SetInput,
      execute: (r) =>
        sql`INSERT INTO projection_stats (key, value_json) VALUES (${r.key}, ${r.valueJson})
            ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json`,
    })({ key, valueJson }).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionStats.set")),
    );

  const getAll: ProjectionStatsRepositoryShape["getAll"] = () =>
    SqlSchema.findAll({
      Request: Schema.Void,
      Result: StatsRow,
      execute: () =>
        sql`SELECT key, value_json AS "valueJson" FROM projection_stats`,
    })(undefined as void).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionStats.getAll")),
    );

  return { get, set, getAll } satisfies ProjectionStatsRepositoryShape;
});

export const ProjectionStatsRepositoryLive = Layer.effect(
  ProjectionStatsRepository,
  makeProjectionStatsRepository,
);
