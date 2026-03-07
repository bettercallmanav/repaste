import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectionRepositoryError } from "../Errors.ts";

export interface ProjectionStatsRepositoryShape {
  readonly get: (key: string) => Effect.Effect<string | null, ProjectionRepositoryError>;
  readonly set: (key: string, valueJson: string) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getAll: () => Effect.Effect<
    ReadonlyArray<{ key: string; valueJson: string }>,
    ProjectionRepositoryError
  >;
}

export class ProjectionStatsRepository extends ServiceMap.Service<
  ProjectionStatsRepository,
  ProjectionStatsRepositoryShape
>()("@clipm/server/persistence/Services/ProjectionStats/ProjectionStatsRepository") {}
