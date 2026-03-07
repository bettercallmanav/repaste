import type { ClipboardEvent } from "@clipm/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";

export interface ClipboardProjectionPipelineShape {
  readonly bootstrap: Effect.Effect<void, ProjectionRepositoryError>;
  readonly projectEvent: (
    event: ClipboardEvent,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ClipboardProjectionPipeline extends ServiceMap.Service<
  ClipboardProjectionPipeline,
  ClipboardProjectionPipelineShape
>()("@clipm/server/clipboard/Services/ProjectionPipeline/ClipboardProjectionPipeline") {}
