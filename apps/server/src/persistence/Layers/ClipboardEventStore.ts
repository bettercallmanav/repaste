import {
  ClipboardAggregateKind,
  ClipboardEvent,
  ClipboardEventType,
  CommandId,
  EventId,
  IsoDateTime,
  NonNegativeInt,
} from "@clipm/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema, Stream } from "effect";

import {
  toPersistenceDecodeError,
  toPersistenceSqlError,
  type ClipboardEventStoreError,
} from "../Errors.ts";
import {
  ClipboardEventStore,
  type ClipboardEventStoreShape,
} from "../Services/ClipboardEventStore.ts";

const decodeEvent = Schema.decodeUnknownEffect(ClipboardEvent);
const UnknownFromJsonString = Schema.fromJsonString(Schema.Unknown);
const MetadataFromJsonString = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown),
);

const AppendEventRequestSchema = Schema.Struct({
  eventId: EventId,
  aggregateKind: ClipboardAggregateKind,
  streamId: Schema.String,
  type: ClipboardEventType,
  occurredAt: IsoDateTime,
  commandId: Schema.NullOr(CommandId),
  payloadJson: UnknownFromJsonString,
  metadataJson: MetadataFromJsonString,
});

const PersistedRowSchema = Schema.Struct({
  sequence: NonNegativeInt,
  eventId: EventId,
  type: ClipboardEventType,
  aggregateKind: ClipboardAggregateKind,
  aggregateId: Schema.String,
  occurredAt: IsoDateTime,
  commandId: Schema.NullOr(CommandId),
  payload: UnknownFromJsonString,
  metadata: MetadataFromJsonString,
});

const ReadFromSequenceRequestSchema = Schema.Struct({
  sequenceExclusive: NonNegativeInt,
  limit: Schema.Number,
});

const DEFAULT_LIMIT = 1_000;
const PAGE_SIZE = 500;

function toPersistenceSqlOrDecodeError(sqlOp: string, decodeOp: string) {
  return (cause: unknown): ClipboardEventStoreError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOp)(cause)
      : toPersistenceSqlError(sqlOp)(cause);
}

const makeEventStore = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const appendEventRow = SqlSchema.findOne({
    Request: AppendEventRequestSchema,
    Result: PersistedRowSchema,
    execute: (req) =>
      sql`
        INSERT INTO clipboard_events (
          event_id, aggregate_kind, stream_id, stream_version,
          event_type, occurred_at, command_id, payload_json, metadata_json
        )
        VALUES (
          ${req.eventId}, ${req.aggregateKind}, ${req.streamId},
          COALESCE(
            (SELECT stream_version + 1 FROM clipboard_events
             WHERE aggregate_kind = ${req.aggregateKind}
               AND stream_id = ${req.streamId}
             ORDER BY stream_version DESC LIMIT 1),
            0
          ),
          ${req.type}, ${req.occurredAt}, ${req.commandId},
          ${req.payloadJson}, ${req.metadataJson}
        )
        RETURNING
          sequence,
          event_id AS "eventId",
          event_type AS "type",
          aggregate_kind AS "aggregateKind",
          stream_id AS "aggregateId",
          occurred_at AS "occurredAt",
          command_id AS "commandId",
          payload_json AS "payload",
          metadata_json AS "metadata"
      `,
  });

  const readEventRows = SqlSchema.findAll({
    Request: ReadFromSequenceRequestSchema,
    Result: PersistedRowSchema,
    execute: (req) =>
      sql`
        SELECT
          sequence,
          event_id AS "eventId",
          event_type AS "type",
          aggregate_kind AS "aggregateKind",
          stream_id AS "aggregateId",
          occurred_at AS "occurredAt",
          command_id AS "commandId",
          payload_json AS "payload",
          metadata_json AS "metadata"
        FROM clipboard_events
        WHERE sequence > ${req.sequenceExclusive}
        ORDER BY sequence ASC
        LIMIT ${req.limit}
      `,
  });

  const append: ClipboardEventStoreShape["append"] = (event) =>
    appendEventRow({
      eventId: event.eventId,
      aggregateKind: event.aggregateKind,
      streamId: event.aggregateId,
      type: event.type,
      occurredAt: event.occurredAt,
      commandId: event.commandId,
      payloadJson: event.payload,
      metadataJson: event.metadata,
    }).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ClipboardEventStore.append:insert",
          "ClipboardEventStore.append:decodeRow",
        ),
      ),
      Effect.flatMap((row) =>
        decodeEvent(row).pipe(
          Effect.mapError(toPersistenceDecodeError("ClipboardEventStore.append:rowToEvent")),
        ),
      ),
    );

  const readFromSequence: ClipboardEventStoreShape["readFromSequence"] = (
    sequenceExclusive,
    limit = DEFAULT_LIMIT,
  ) => {
    const normalizedLimit = Math.max(0, Math.floor(limit));
    if (normalizedLimit === 0) return Stream.empty;

    const readPage = (
      cursor: number,
      remaining: number,
    ): Stream.Stream<ClipboardEvent, ClipboardEventStoreError> =>
      Stream.fromEffect(
        readEventRows({
          sequenceExclusive: cursor,
          limit: Math.min(remaining, PAGE_SIZE),
        }).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ClipboardEventStore.readFromSequence:query",
              "ClipboardEventStore.readFromSequence:decodeRows",
            ),
          ),
          Effect.flatMap((rows) =>
            Effect.forEach(rows, (row) =>
              decodeEvent(row).pipe(
                Effect.mapError(
                  toPersistenceDecodeError("ClipboardEventStore.readFromSequence:rowToEvent"),
                ),
              ),
            ),
          ),
        ),
      ).pipe(
        Stream.flatMap((events) => {
          if (events.length === 0) return Stream.empty;
          const nextRemaining = remaining - events.length;
          if (nextRemaining <= 0) return Stream.fromIterable(events);
          return Stream.concat(
            Stream.fromIterable(events),
            readPage(events[events.length - 1]!.sequence, nextRemaining),
          );
        }),
      );

    return readPage(sequenceExclusive, normalizedLimit);
  };

  return {
    append,
    readFromSequence,
    readAll: () => readFromSequence(0, Number.MAX_SAFE_INTEGER),
  } satisfies ClipboardEventStoreShape;
});

export const ClipboardEventStoreLive = Layer.effect(ClipboardEventStore, makeEventStore);
