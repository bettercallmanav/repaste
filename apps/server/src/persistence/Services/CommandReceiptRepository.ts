import { Schema, ServiceMap } from "effect";
import type { Effect, Option } from "effect";
import { CommandId, IsoDateTime, NonNegativeInt } from "@clipm/contracts";
import type { ClipboardCommandReceiptRepositoryError } from "../Errors.ts";

export const ClipboardCommandReceipt = Schema.Struct({
  commandId: CommandId,
  aggregateKind: Schema.String,
  aggregateId: Schema.String,
  acceptedAt: IsoDateTime,
  resultSequence: NonNegativeInt,
  status: Schema.Literals(["accepted", "rejected"]),
  error: Schema.NullOr(Schema.String),
});
export type ClipboardCommandReceipt = typeof ClipboardCommandReceipt.Type;

export const GetByCommandIdInput = Schema.Struct({ commandId: CommandId });
export type GetByCommandIdInput = typeof GetByCommandIdInput.Type;

export interface ClipboardCommandReceiptRepositoryShape {
  readonly upsert: (
    receipt: ClipboardCommandReceipt,
  ) => Effect.Effect<void, ClipboardCommandReceiptRepositoryError>;

  readonly getByCommandId: (
    input: GetByCommandIdInput,
  ) => Effect.Effect<Option.Option<ClipboardCommandReceipt>, ClipboardCommandReceiptRepositoryError>;
}

export class ClipboardCommandReceiptRepository extends ServiceMap.Service<
  ClipboardCommandReceiptRepository,
  ClipboardCommandReceiptRepositoryShape
>()("@clipm/server/persistence/Services/CommandReceiptRepository/ClipboardCommandReceiptRepository") {}
