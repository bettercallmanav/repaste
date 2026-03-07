import type {
  ClipboardCommand,
  ClipboardEvent,
  ClipboardReadModel,
} from "@clipm/contracts";
import { Effect } from "effect";

import { ClipboardCommandInvariantError } from "./Errors.ts";
import {
  requireClip,
  requireSnippet,
  requireSnippetAbsent,
  requireAllClipsExist,
} from "./commandInvariants.ts";

const nowIso = () => new Date().toISOString();

type EventBase = Omit<ClipboardEvent, "sequence">;

function withEventBase(input: {
  readonly commandId: string;
  readonly aggregateKind: ClipboardEvent["aggregateKind"];
  readonly aggregateId: string;
  readonly occurredAt: string;
}): Omit<EventBase, "type" | "payload"> {
  return {
    eventId: crypto.randomUUID() as ClipboardEvent["eventId"],
    aggregateKind: input.aggregateKind,
    aggregateId: input.aggregateId,
    occurredAt: input.occurredAt,
    commandId: input.commandId as ClipboardEvent["commandId"],
    metadata: {},
  };
}

/**
 * Decide which events to emit for a given clipboard command.
 *
 * Pure function: validates command invariants against the current read model,
 * then returns one or more event bases (without sequence — the event store
 * assigns sequences on append).
 */
export const decideClipboardCommand = Effect.fn("decideClipboardCommand")(function* ({
  command,
  readModel,
}: {
  readonly command: ClipboardCommand;
  readonly readModel: ClipboardReadModel;
}): Effect.fn.Return<EventBase | ReadonlyArray<EventBase>, ClipboardCommandInvariantError> {
  switch (command.type) {
    case "clip.capture": {
      // Dedup: if identical content was just captured, silently accept
      if (readModel.settings.deduplicateConsecutive) {
        const latest = readModel.clips[0];
        if (latest && latest.content === command.content && latest.deletedAt === null) {
          // Emit a paste event instead of re-capturing
          return {
            ...withEventBase({
              aggregateKind: "clip",
              aggregateId: latest.id,
              occurredAt: command.capturedAt,
              commandId: command.commandId,
            }),
            type: "clip.pasted",
            payload: { clipId: latest.id, pastedAt: command.capturedAt },
          };
        }
      }

      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: command.capturedAt,
          commandId: command.commandId,
        }),
        type: "clip.captured",
        payload: {
          clipId: command.clipId,
          content: command.content,
          contentType: command.contentType,
          category: command.category,
          preview: command.preview,
          imageDataUrl: command.imageDataUrl,
          sourceApp: command.sourceApp,
          metadata: command.metadata,
          capturedAt: command.capturedAt,
        },
      };
    }

    case "clip.pin": {
      const clip = yield* requireClip({ readModel, command, clipId: command.clipId });
      if (clip.pinned) {
        return yield* new ClipboardCommandInvariantError({
          commandType: command.type,
          detail: `Clip '${command.clipId}' is already pinned.`,
        });
      }
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: nowIso(),
          commandId: command.commandId,
        }),
        type: "clip.pinned",
        payload: { clipId: command.clipId },
      };
    }

    case "clip.unpin": {
      const clip = yield* requireClip({ readModel, command, clipId: command.clipId });
      if (!clip.pinned) {
        return yield* new ClipboardCommandInvariantError({
          commandType: command.type,
          detail: `Clip '${command.clipId}' is not pinned.`,
        });
      }
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: nowIso(),
          commandId: command.commandId,
        }),
        type: "clip.unpinned",
        payload: { clipId: command.clipId },
      };
    }

    case "clip.delete": {
      yield* requireClip({ readModel, command, clipId: command.clipId });
      const occurredAt = nowIso();
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt,
          commandId: command.commandId,
        }),
        type: "clip.deleted",
        payload: { clipId: command.clipId, deletedAt: occurredAt },
      };
    }

    case "clip.tag": {
      const clip = yield* requireClip({ readModel, command, clipId: command.clipId });
      if (clip.tags.includes(command.tag)) {
        return yield* new ClipboardCommandInvariantError({
          commandType: command.type,
          detail: `Clip '${command.clipId}' already has tag '${command.tag}'.`,
        });
      }
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: nowIso(),
          commandId: command.commandId,
        }),
        type: "clip.tagged",
        payload: { clipId: command.clipId, tag: command.tag },
      };
    }

    case "clip.untag": {
      const clip = yield* requireClip({ readModel, command, clipId: command.clipId });
      if (!clip.tags.includes(command.tag)) {
        return yield* new ClipboardCommandInvariantError({
          commandType: command.type,
          detail: `Clip '${command.clipId}' does not have tag '${command.tag}'.`,
        });
      }
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: nowIso(),
          commandId: command.commandId,
        }),
        type: "clip.untagged",
        payload: { clipId: command.clipId, tag: command.tag },
      };
    }

    case "clip.merge": {
      const clips = yield* requireAllClipsExist({
        readModel,
        command,
        clipIds: command.sourceClipIds,
      });
      const mergedContent = clips.map((c) => c.content).join(command.separator);
      const preview = mergedContent.slice(0, 200);
      const metadata = {
        charCount: mergedContent.length,
        wordCount: mergedContent.split(/\s+/).filter(Boolean).length,
        lineCount: mergedContent.split("\n").length,
        language: null,
        url: null,
      };

      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.newClipId,
          occurredAt: command.capturedAt,
          commandId: command.commandId,
        }),
        type: "clip.merged",
        payload: {
          newClipId: command.newClipId,
          sourceClipIds: command.sourceClipIds,
          content: mergedContent,
          preview,
          metadata,
          capturedAt: command.capturedAt,
        },
      };
    }

    case "clip.paste": {
      yield* requireClip({ readModel, command, clipId: command.clipId });
      return {
        ...withEventBase({
          aggregateKind: "clip",
          aggregateId: command.clipId,
          occurredAt: command.pastedAt,
          commandId: command.commandId,
        }),
        type: "clip.pasted",
        payload: { clipId: command.clipId, pastedAt: command.pastedAt },
      };
    }

    case "snippet.create": {
      yield* requireSnippetAbsent({ readModel, command, snippetId: command.snippetId });
      return {
        ...withEventBase({
          aggregateKind: "snippet",
          aggregateId: command.snippetId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        }),
        type: "snippet.created",
        payload: {
          snippetId: command.snippetId,
          title: command.title,
          content: command.content,
          shortcut: command.shortcut,
          createdAt: command.createdAt,
        },
      };
    }

    case "snippet.update": {
      yield* requireSnippet({ readModel, command, snippetId: command.snippetId });
      return {
        ...withEventBase({
          aggregateKind: "snippet",
          aggregateId: command.snippetId,
          occurredAt: command.updatedAt,
          commandId: command.commandId,
        }),
        type: "snippet.updated",
        payload: {
          snippetId: command.snippetId,
          ...(command.title !== undefined ? { title: command.title } : {}),
          ...(command.content !== undefined ? { content: command.content } : {}),
          ...(command.shortcut !== undefined ? { shortcut: command.shortcut } : {}),
          updatedAt: command.updatedAt,
        },
      };
    }

    case "snippet.delete": {
      yield* requireSnippet({ readModel, command, snippetId: command.snippetId });
      const occurredAt = nowIso();
      return {
        ...withEventBase({
          aggregateKind: "snippet",
          aggregateId: command.snippetId,
          occurredAt,
          commandId: command.commandId,
        }),
        type: "snippet.deleted",
        payload: { snippetId: command.snippetId, deletedAt: occurredAt },
      };
    }

    case "settings.update": {
      return {
        ...withEventBase({
          aggregateKind: "settings",
          aggregateId: "singleton",
          occurredAt: command.updatedAt,
          commandId: command.commandId,
        }),
        type: "settings.updated",
        payload: {
          settings: command.settings,
          updatedAt: command.updatedAt,
        },
      };
    }

    default: {
      command satisfies never;
      const fallback = command as never as { type: string };
      return yield* new ClipboardCommandInvariantError({
        commandType: fallback.type,
        detail: `Unknown command type: ${fallback.type}`,
      });
    }
  }
});
