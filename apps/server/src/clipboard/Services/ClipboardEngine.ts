import type { ClipboardCommand, ClipboardEvent, ClipboardReadModel } from "@clipm/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

import type { ClipboardDispatchError } from "../Errors.ts";
import type { ClipboardEventStoreError } from "../../persistence/Errors.ts";

export interface ClipboardEngineShape {
  readonly getReadModel: () => Effect.Effect<ClipboardReadModel>;
  readonly readEvents: (
    fromSequenceExclusive: number,
  ) => Stream.Stream<ClipboardEvent, ClipboardEventStoreError>;
  readonly dispatch: (
    command: ClipboardCommand,
  ) => Effect.Effect<{ sequence: number }, ClipboardDispatchError>;
  readonly streamDomainEvents: Stream.Stream<ClipboardEvent>;
}

export class ClipboardEngineService extends ServiceMap.Service<
  ClipboardEngineService,
  ClipboardEngineShape
>()("@clipm/server/clipboard/Services/ClipboardEngine/ClipboardEngineService") {}
