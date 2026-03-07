import type { ClipboardEvent } from "@clipm/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";
import type { ClipboardEventStoreError } from "../Errors.ts";

export interface ClipboardEventStoreShape {
  readonly append: (
    event: Omit<ClipboardEvent, "sequence">,
  ) => Effect.Effect<ClipboardEvent, ClipboardEventStoreError>;

  readonly readFromSequence: (
    sequenceExclusive: number,
    limit?: number,
  ) => Stream.Stream<ClipboardEvent, ClipboardEventStoreError>;

  readonly readAll: () => Stream.Stream<ClipboardEvent, ClipboardEventStoreError>;
}

export class ClipboardEventStore extends ServiceMap.Service<
  ClipboardEventStore,
  ClipboardEventStoreShape
>()("@clipm/server/persistence/Services/ClipboardEventStore") {}
