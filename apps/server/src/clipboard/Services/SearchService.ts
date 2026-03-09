import type { Clip, ClipSearchFilters } from "@clipm/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";

export interface ClipSearchRequest {
  readonly query: string;
  readonly filters?: ClipSearchFilters;
  readonly limit?: number;
}

export interface SearchServiceShape {
  readonly search: (
    input: ClipSearchRequest,
  ) => Effect.Effect<ReadonlyArray<Clip>, ProjectionRepositoryError>;
}

export class SearchService extends ServiceMap.Service<
  SearchService,
  SearchServiceShape
>()("@clipm/server/clipboard/Services/SearchService") {}
