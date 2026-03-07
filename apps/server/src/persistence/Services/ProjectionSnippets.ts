import { Schema, ServiceMap } from "effect";
import type { Effect, Option } from "effect";
import { IsoDateTime, NonNegativeInt, SnippetId } from "@clipm/contracts";
import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionSnippetRow = Schema.Struct({
  id: SnippetId,
  title: Schema.String,
  content: Schema.String,
  shortcut: Schema.NullOr(Schema.String),
  usageCount: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type ProjectionSnippetRow = typeof ProjectionSnippetRow.Type;

export interface ProjectionSnippetRepositoryShape {
  readonly upsert: (row: ProjectionSnippetRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    id: SnippetId,
  ) => Effect.Effect<Option.Option<ProjectionSnippetRow>, ProjectionRepositoryError>;
  readonly listAll: () => Effect.Effect<
    ReadonlyArray<ProjectionSnippetRow>,
    ProjectionRepositoryError
  >;
  readonly softDelete: (
    id: SnippetId,
    deletedAt: string,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionSnippetRepository extends ServiceMap.Service<
  ProjectionSnippetRepository,
  ProjectionSnippetRepositoryShape
>()("@clipm/server/persistence/Services/ProjectionSnippets/ProjectionSnippetRepository") {}
