import type { Clip } from "@clipm/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";

export interface SearchServiceShape {
  readonly search: (
    query: string,
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<Clip>, ProjectionRepositoryError>;
}

export class SearchService extends ServiceMap.Service<
  SearchService,
  SearchServiceShape
>()("@clipm/server/clipboard/Services/SearchService") {}
