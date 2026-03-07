import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ClipboardCommandReceipt,
  ClipboardCommandReceiptRepository,
  GetByCommandIdInput,
  type ClipboardCommandReceiptRepositoryShape,
} from "../Services/CommandReceiptRepository.ts";

const makeCommandReceiptRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ClipboardCommandReceipt,
    execute: (r) =>
      sql`
        INSERT INTO clipboard_command_receipts (
          command_id, aggregate_kind, aggregate_id,
          accepted_at, result_sequence, status, error
        )
        VALUES (
          ${r.commandId}, ${r.aggregateKind}, ${r.aggregateId},
          ${r.acceptedAt}, ${r.resultSequence}, ${r.status}, ${r.error}
        )
        ON CONFLICT (command_id)
        DO UPDATE SET
          result_sequence = excluded.result_sequence,
          status = excluded.status,
          error = excluded.error
      `,
  });

  const getByCommandIdRow = SqlSchema.findOneOption({
    Request: GetByCommandIdInput,
    Result: ClipboardCommandReceipt,
    execute: ({ commandId }) =>
      sql`
        SELECT
          command_id AS "commandId",
          aggregate_kind AS "aggregateKind",
          aggregate_id AS "aggregateId",
          accepted_at AS "acceptedAt",
          result_sequence AS "resultSequence",
          status,
          error
        FROM clipboard_command_receipts
        WHERE command_id = ${commandId}
      `,
  });

  const upsert: ClipboardCommandReceiptRepositoryShape["upsert"] = (receipt) =>
    upsertRow(receipt).pipe(
      Effect.mapError(toPersistenceSqlError("CommandReceiptRepository.upsert")),
    );

  const getByCommandId: ClipboardCommandReceiptRepositoryShape["getByCommandId"] = (input) =>
    getByCommandIdRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("CommandReceiptRepository.getByCommandId")),
    );

  return { upsert, getByCommandId } satisfies ClipboardCommandReceiptRepositoryShape;
});

export const ClipboardCommandReceiptRepositoryLive = Layer.effect(
  ClipboardCommandReceiptRepository,
  makeCommandReceiptRepository,
);
