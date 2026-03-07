import type { ClipboardCommand, ClipboardEvent, ClipboardReadModel } from "@clipm/contracts";
import { Deferred, Effect, Layer, Option, PubSub, Queue, Schema, Stream } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { toPersistenceSqlError } from "../../persistence/Errors.ts";
import { ClipboardEventStore } from "../../persistence/Services/ClipboardEventStore.ts";
import { ClipboardCommandReceiptRepository } from "../../persistence/Services/CommandReceiptRepository.ts";
import {
  ClipboardCommandInvariantError,
  ClipboardCommandPreviouslyRejectedError,
  type ClipboardDispatchError,
} from "../Errors.ts";
import { decideClipboardCommand } from "../decider.ts";
import { createEmptyReadModel, projectEvent } from "../projector.ts";
import { ClipboardProjectionPipeline } from "../Services/ProjectionPipeline.ts";
import {
  ClipboardEngineService,
  type ClipboardEngineShape,
} from "../Services/ClipboardEngine.ts";

interface CommandEnvelope {
  command: ClipboardCommand;
  result: Deferred.Deferred<{ sequence: number }, ClipboardDispatchError>;
}

function formatDispatchError(error: ClipboardDispatchError): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return String(error);
}

const makeClipboardEngine = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const eventStore = yield* ClipboardEventStore;
  const commandReceiptRepository = yield* ClipboardCommandReceiptRepository;
  const projectionPipeline = yield* ClipboardProjectionPipeline;

  let readModel = createEmptyReadModel(new Date().toISOString());

  const commandQueue = yield* Queue.unbounded<CommandEnvelope>();
  const eventPubSub = yield* PubSub.unbounded<ClipboardEvent>();

  const processEnvelope = (envelope: CommandEnvelope): Effect.Effect<void> => {
    const dispatchStartSequence = readModel.snapshotSequence;

    // If the transaction fails, replay any events persisted concurrently
    const reconcileReadModelAfterDispatchFailure = Effect.gen(function* () {
      const persistedEvents = yield* Stream.runCollect(
        eventStore.readFromSequence(dispatchStartSequence),
      ).pipe(Effect.map((chunk): ClipboardEvent[] => Array.from(chunk)));
      if (persistedEvents.length === 0) return;

      let nextReadModel = readModel;
      for (const persistedEvent of persistedEvents) {
        nextReadModel = yield* projectEvent(nextReadModel, persistedEvent);
      }
      readModel = nextReadModel;

      for (const persistedEvent of persistedEvents) {
        yield* PubSub.publish(eventPubSub, persistedEvent);
      }
    });

    return Effect.gen(function* () {
      // Dedup: check command receipt
      const existingReceipt = yield* commandReceiptRepository.getByCommandId({
        commandId: envelope.command.commandId,
      });
      if (Option.isSome(existingReceipt)) {
        if (existingReceipt.value.status === "accepted") {
          yield* Deferred.succeed(envelope.result, {
            sequence: existingReceipt.value.resultSequence,
          });
          return;
        }
        yield* Deferred.fail(
          envelope.result,
          new ClipboardCommandPreviouslyRejectedError({
            commandId: envelope.command.commandId,
            detail: existingReceipt.value.error ?? "Previously rejected.",
          }),
        );
        return;
      }

      // Decide → persist events → project → record receipt — all in one transaction
      const eventBase = yield* decideClipboardCommand({
        command: envelope.command,
        readModel,
      });
      const eventBases = Array.isArray(eventBase) ? eventBase : [eventBase];

      const committedCommand = yield* sql
        .withTransaction(
          Effect.gen(function* () {
            const committedEvents: ClipboardEvent[] = [];
            let nextReadModel = readModel;

            for (const nextEvent of eventBases) {
              const savedEvent = yield* eventStore.append(nextEvent);
              nextReadModel = yield* projectEvent(nextReadModel, savedEvent);
              yield* projectionPipeline.projectEvent(savedEvent);
              committedEvents.push(savedEvent);
            }

            const lastSavedEvent = committedEvents.at(-1) ?? null;
            if (lastSavedEvent === null) {
              return yield* new ClipboardCommandInvariantError({
                commandType: envelope.command.type,
                detail: "Command produced no events.",
              });
            }

            yield* commandReceiptRepository.upsert({
              commandId: envelope.command.commandId,
              aggregateKind: lastSavedEvent.aggregateKind,
              aggregateId: lastSavedEvent.aggregateId,
              acceptedAt: lastSavedEvent.occurredAt,
              resultSequence: lastSavedEvent.sequence,
              status: "accepted",
              error: null,
            });

            return {
              committedEvents,
              lastSequence: lastSavedEvent.sequence,
              nextReadModel,
            } as const;
          }),
        )
        .pipe(
          Effect.catchTag("SqlError", (sqlError) =>
            Effect.fail(
              toPersistenceSqlError("ClipboardEngine.processEnvelope:transaction")(sqlError),
            ),
          ),
        );

      readModel = committedCommand.nextReadModel;
      for (const event of committedCommand.committedEvents) {
        yield* PubSub.publish(eventPubSub, event);
      }
      yield* Deferred.succeed(envelope.result, { sequence: committedCommand.lastSequence });
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* reconcileReadModelAfterDispatchFailure.pipe(
            Effect.catch(() =>
              Effect.logWarning(
                "failed to reconcile clipboard read model after dispatch failure",
              ).pipe(
                Effect.annotateLogs({
                  commandId: envelope.command.commandId,
                  snapshotSequence: readModel.snapshotSequence,
                }),
              ),
            ),
          );

          if (Schema.is(ClipboardCommandInvariantError)(error)) {
            yield* commandReceiptRepository
              .upsert({
                commandId: envelope.command.commandId,
                aggregateKind: "clip",
                aggregateId: "",
                acceptedAt: new Date().toISOString(),
                resultSequence: readModel.snapshotSequence,
                status: "rejected" as "accepted" | "rejected",
                error: formatDispatchError(error),
              })
              .pipe(Effect.catch(() => Effect.void));
          }
          yield* Deferred.fail(envelope.result, error);
        }),
      ),
    );
  };

  // Bootstrap: replay projection pipeline from cursor, then rebuild in-memory read model
  yield* projectionPipeline.bootstrap;

  yield* Stream.runForEach(eventStore.readAll(), (event) =>
    Effect.gen(function* () {
      readModel = yield* projectEvent(readModel, event);
    }),
  );

  // Start the single-threaded command worker
  const worker = Effect.forever(Queue.take(commandQueue).pipe(Effect.flatMap(processEnvelope)));
  yield* Effect.forkScoped(worker);
  yield* Effect.log("clipboard engine started").pipe(
    Effect.annotateLogs({ sequence: readModel.snapshotSequence }),
  );

  const getReadModel: ClipboardEngineShape["getReadModel"] = () =>
    Effect.sync((): ClipboardReadModel => readModel);

  const readEvents: ClipboardEngineShape["readEvents"] = (fromSequenceExclusive) =>
    eventStore.readFromSequence(fromSequenceExclusive);

  const dispatch: ClipboardEngineShape["dispatch"] = (command) =>
    Effect.gen(function* () {
      const result = yield* Deferred.make<{ sequence: number }, ClipboardDispatchError>();
      yield* Queue.offer(commandQueue, { command, result });
      return yield* Deferred.await(result);
    });

  const streamDomainEvents: ClipboardEngineShape["streamDomainEvents"] =
    Stream.fromPubSub(eventPubSub);

  return {
    getReadModel,
    readEvents,
    dispatch,
    streamDomainEvents,
  } satisfies ClipboardEngineShape;
});

export const ClipboardEngineLive = Layer.effect(
  ClipboardEngineService,
  makeClipboardEngine,
);
