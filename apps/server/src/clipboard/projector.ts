import type { ClipboardEvent, ClipboardReadModel, Clip, Snippet } from "@clipm/contracts";
import { DEFAULT_SETTINGS } from "@clipm/contracts";
import { Effect, Schema } from "effect";

import { toProjectorDecodeError, type ClipboardProjectorDecodeError } from "./Errors.ts";
import {
  ClipCapturedPayload,
  ClipPinnedPayload,
  ClipUnpinnedPayload,
  ClipDeletedPayload,
  ClipTaggedPayload,
  ClipUntaggedPayload,
  ClipMergedPayload,
  ClipPastedPayload,
  SnippetCreatedPayload,
  SnippetUpdatedPayload,
  SnippetDeletedPayload,
  SettingsUpdatedPayload,
} from "./Schemas.ts";

function decodeForEvent<A>(
  schema: Schema.Schema<A>,
  value: unknown,
  eventType: ClipboardEvent["type"],
  field: string,
): Effect.Effect<A, ClipboardProjectorDecodeError> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(schema as any)(value),
    catch: (error) => toProjectorDecodeError(`${eventType}:${field}`)(error as Schema.SchemaError),
  });
}

function updateClip(
  clips: ReadonlyArray<Clip>,
  clipId: string,
  patch: Partial<Clip>,
): Clip[] {
  return clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip));
}

function updateSnippet(
  snippets: ReadonlyArray<Snippet>,
  snippetId: string,
  patch: Partial<Snippet>,
): Snippet[] {
  return snippets.map((s) => (s.id === snippetId ? { ...s, ...patch } : s));
}

function collectKnownTags(clips: ReadonlyArray<Clip>): string[] {
  const tagSet = new Set<string>();
  for (const clip of clips) {
    for (const tag of clip.tags) tagSet.add(tag);
  }
  return [...tagSet].sort();
}

export function createEmptyReadModel(nowIso: string): ClipboardReadModel {
  return {
    snapshotSequence: 0 as ClipboardReadModel["snapshotSequence"],
    clips: [],
    snippets: [],
    knownTags: [],
    settings: DEFAULT_SETTINGS,
    stats: {
      totalClips: 0 as ClipboardReadModel["stats"]["totalClips"],
      totalPastes: 0 as ClipboardReadModel["stats"]["totalPastes"],
      mostUsedClipIds: [],
    },
    updatedAt: nowIso,
  };
}

/**
 * Apply a single event to the in-memory read model, returning the next state.
 *
 * This is a pure fold: readModel + event → readModel.
 * The projector decodes the event payload to ensure type safety and
 * updates the relevant portion of the read model.
 */
export function projectEvent(
  model: ClipboardReadModel,
  event: ClipboardEvent,
): Effect.Effect<ClipboardReadModel, ClipboardProjectorDecodeError> {
  const nextBase: ClipboardReadModel = {
    ...model,
    snapshotSequence: event.sequence,
    updatedAt: event.occurredAt,
  };

  switch (event.type) {
    case "clip.captured":
      return decodeForEvent(ClipCapturedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const newClip: Clip = {
            id: p.clipId,
            content: p.content,
            contentType: p.contentType,
            preview: p.preview,
            imageDataUrl: p.imageDataUrl,
            pinned: false,
            tags: [],
            category: p.category,
            sourceApp: p.sourceApp,
            pasteCount: 0 as Clip["pasteCount"],
            capturedAt: p.capturedAt,
            deletedAt: null,
            metadata: p.metadata,
          };
          const nextClips = [newClip, ...nextBase.clips];
          // Enforce max history: soft-delete oldest non-pinned clips beyond limit
          const maxHistory = nextBase.settings.maxHistorySize;
          const activeClips = nextClips.filter((c) => c.deletedAt === null);
          if (activeClips.length > maxHistory) {
            const overflow = activeClips.filter((c) => !c.pinned).slice(maxHistory);
            const overflowIds = new Set(overflow.map((c) => c.id));
            return {
              ...nextBase,
              clips: nextClips.map((c) =>
                overflowIds.has(c.id) ? { ...c, deletedAt: event.occurredAt } : c,
              ),
              stats: {
                ...nextBase.stats,
                totalClips: (nextBase.stats.totalClips + 1) as ClipboardReadModel["stats"]["totalClips"],
              },
            };
          }
          return {
            ...nextBase,
            clips: nextClips,
            stats: {
              ...nextBase.stats,
              totalClips: (nextBase.stats.totalClips + 1) as ClipboardReadModel["stats"]["totalClips"],
            },
          };
        }),
      );

    case "clip.pinned":
      return decodeForEvent(ClipPinnedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          clips: updateClip(nextBase.clips, p.clipId, { pinned: true }),
        })),
      );

    case "clip.unpinned":
      return decodeForEvent(ClipUnpinnedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          clips: updateClip(nextBase.clips, p.clipId, { pinned: false }),
        })),
      );

    case "clip.deleted":
      return decodeForEvent(ClipDeletedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          clips: updateClip(nextBase.clips, p.clipId, { deletedAt: p.deletedAt }),
        })),
      );

    case "clip.tagged":
      return decodeForEvent(ClipTaggedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const nextClips = updateClip(nextBase.clips, p.clipId, {
            tags: [
              ...(nextBase.clips.find((c) => c.id === p.clipId)?.tags ?? []),
              p.tag,
            ],
          });
          return {
            ...nextBase,
            clips: nextClips,
            knownTags: collectKnownTags(nextClips),
          };
        }),
      );

    case "clip.untagged":
      return decodeForEvent(ClipUntaggedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const nextClips = updateClip(nextBase.clips, p.clipId, {
            tags: (nextBase.clips.find((c) => c.id === p.clipId)?.tags ?? []).filter(
              (t) => t !== p.tag,
            ),
          });
          return {
            ...nextBase,
            clips: nextClips,
            knownTags: collectKnownTags(nextClips),
          };
        }),
      );

    case "clip.merged":
      return decodeForEvent(ClipMergedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const newClip: Clip = {
            id: p.newClipId,
            content: p.content,
            contentType: "text",
            preview: p.preview,
            imageDataUrl: null,
            pinned: false,
            tags: [],
            category: "text",
            sourceApp: null,
            pasteCount: 0 as Clip["pasteCount"],
            capturedAt: p.capturedAt,
            deletedAt: null,
            metadata: p.metadata,
          };
          return {
            ...nextBase,
            clips: [newClip, ...nextBase.clips],
            stats: {
              ...nextBase.stats,
              totalClips: (nextBase.stats.totalClips + 1) as ClipboardReadModel["stats"]["totalClips"],
            },
          };
        }),
      );

    case "clip.pasted":
      return decodeForEvent(ClipPastedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const clip = nextBase.clips.find((c) => c.id === p.clipId);
          const nextPasteCount = ((clip?.pasteCount ?? 0) + 1) as Clip["pasteCount"];
          return {
            ...nextBase,
            clips: updateClip(nextBase.clips, p.clipId, { pasteCount: nextPasteCount }),
            stats: {
              ...nextBase.stats,
              totalPastes: (nextBase.stats.totalPastes + 1) as ClipboardReadModel["stats"]["totalPastes"],
            },
          };
        }),
      );

    case "snippet.created":
      return decodeForEvent(SnippetCreatedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => {
          const newSnippet: Snippet = {
            id: p.snippetId,
            title: p.title,
            content: p.content,
            shortcut: p.shortcut,
            usageCount: 0 as Snippet["usageCount"],
            createdAt: p.createdAt,
            updatedAt: p.createdAt,
            deletedAt: null,
          };
          return {
            ...nextBase,
            snippets: [...nextBase.snippets, newSnippet],
          };
        }),
      );

    case "snippet.updated":
      return decodeForEvent(SnippetUpdatedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          snippets: updateSnippet(nextBase.snippets, p.snippetId, {
            ...(p.title !== undefined ? { title: p.title } : {}),
            ...(p.content !== undefined ? { content: p.content } : {}),
            ...(p.shortcut !== undefined ? { shortcut: p.shortcut } : {}),
            updatedAt: p.updatedAt,
          }),
        })),
      );

    case "snippet.deleted":
      return decodeForEvent(SnippetDeletedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          snippets: updateSnippet(nextBase.snippets, p.snippetId, { deletedAt: p.deletedAt }),
        })),
      );

    case "settings.updated":
      return decodeForEvent(SettingsUpdatedPayload, event.payload, event.type, "payload").pipe(
        Effect.map((p) => ({
          ...nextBase,
          settings: { ...nextBase.settings, ...p.settings },
        })),
      );

    default: {
      // Unknown event types are silently skipped — forward compatibility
      return Effect.succeed(nextBase);
    }
  }
}
