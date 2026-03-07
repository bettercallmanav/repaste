import type { ClipboardEvent } from "@clipm/contracts";
import { Effect, Layer, Option, Stream } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";
import { ClipboardEventStore } from "../../persistence/Services/ClipboardEventStore.ts";
import { ProjectionStateRepository } from "../../persistence/Services/ProjectionState.ts";
import { ProjectionClipRepository } from "../../persistence/Services/ProjectionClips.ts";
import { ProjectionSnippetRepository } from "../../persistence/Services/ProjectionSnippets.ts";
import { ProjectionStatsRepository } from "../../persistence/Services/ProjectionStats.ts";
import {
  ClipboardProjectionPipeline,
  type ClipboardProjectionPipelineShape,
} from "../Services/ProjectionPipeline.ts";

export const CLIPBOARD_PROJECTOR_NAMES = {
  clips: "projection.clips",
  snippets: "projection.snippets",
  stats: "projection.stats",
} as const;

type ProjectorName = (typeof CLIPBOARD_PROJECTOR_NAMES)[keyof typeof CLIPBOARD_PROJECTOR_NAMES];

interface ProjectorDefinition {
  readonly name: ProjectorName;
  readonly apply: (event: ClipboardEvent) => Effect.Effect<void, ProjectionRepositoryError>;
}

const makeProjectionPipeline = Effect.gen(function* () {
  const eventStore = yield* ClipboardEventStore;
  const projectionState = yield* ProjectionStateRepository;
  const clipRepo = yield* ProjectionClipRepository;
  const snippetRepo = yield* ProjectionSnippetRepository;
  const statsRepo = yield* ProjectionStatsRepository;

  // ── Clips projector ────────────────────────────────────────────────────────
  const projectClipEvent = (event: ClipboardEvent): Effect.Effect<void, ProjectionRepositoryError> => {
    switch (event.type) {
      case "clip.captured": {
        const p = event.payload as any;
        return clipRepo.upsert({
          id: p.clipId,
          content: p.content,
          contentType: p.contentType,
          preview: p.preview,
          imageDataUrl: p.imageDataUrl ?? null,
          pinned: 0,
          tagsJson: "[]",
          category: p.category,
          sourceApp: p.sourceApp ?? null,
          pasteCount: 0 as any,
          capturedAt: p.capturedAt,
          deletedAt: null,
          metadataJson: JSON.stringify(p.metadata ?? {}),
        });
      }
      case "clip.pinned": {
        const p = event.payload as any;
        return clipRepo.updatePinned(p.clipId, true);
      }
      case "clip.unpinned": {
        const p = event.payload as any;
        return clipRepo.updatePinned(p.clipId, false);
      }
      case "clip.deleted": {
        const p = event.payload as any;
        return clipRepo.softDelete(p.clipId, p.deletedAt);
      }
      case "clip.tagged": {
        const p = event.payload as any;
        return clipRepo.getById(p.clipId).pipe(
          Effect.flatMap((opt) => {
            if (Option.isNone(opt)) return Effect.void;
            const existing: string[] = opt.value.tagsJson as any ?? [];
            const next = [...existing, p.tag];
            return clipRepo.updateTags(p.clipId, JSON.stringify(next));
          }),
        );
      }
      case "clip.untagged": {
        const p = event.payload as any;
        return clipRepo.getById(p.clipId).pipe(
          Effect.flatMap((opt) => {
            if (Option.isNone(opt)) return Effect.void;
            const existing: string[] = opt.value.tagsJson as any ?? [];
            const next = existing.filter((t: string) => t !== p.tag);
            return clipRepo.updateTags(p.clipId, JSON.stringify(next));
          }),
        );
      }
      case "clip.merged": {
        const p = event.payload as any;
        return clipRepo.upsert({
          id: p.newClipId,
          content: p.content,
          contentType: "text",
          preview: p.preview,
          imageDataUrl: null,
          pinned: 0,
          tagsJson: "[]",
          category: "text",
          sourceApp: null,
          pasteCount: 0 as any,
          capturedAt: p.capturedAt,
          deletedAt: null,
          metadataJson: JSON.stringify(p.metadata ?? {}),
        });
      }
      case "clip.pasted": {
        const p = event.payload as any;
        return clipRepo.incrementPasteCount(p.clipId);
      }
      default:
        return Effect.void;
    }
  };

  // ── Snippets projector ─────────────────────────────────────────────────────
  const projectSnippetEvent = (event: ClipboardEvent): Effect.Effect<void, ProjectionRepositoryError> => {
    switch (event.type) {
      case "snippet.created": {
        const p = event.payload as any;
        return snippetRepo.upsert({
          id: p.snippetId,
          title: p.title,
          content: p.content,
          shortcut: p.shortcut ?? null,
          usageCount: 0 as any,
          createdAt: p.createdAt,
          updatedAt: p.createdAt,
          deletedAt: null,
        });
      }
      case "snippet.updated": {
        const p = event.payload as any;
        return snippetRepo.getById(p.snippetId).pipe(
          Effect.flatMap((opt) => {
            if (Option.isNone(opt)) return Effect.void;
            const existing = opt.value;
            return snippetRepo.upsert({
              ...existing,
              ...(p.title !== undefined ? { title: p.title } : {}),
              ...(p.content !== undefined ? { content: p.content } : {}),
              ...(p.shortcut !== undefined ? { shortcut: p.shortcut } : {}),
              updatedAt: p.updatedAt,
            });
          }),
        );
      }
      case "snippet.deleted": {
        const p = event.payload as any;
        return snippetRepo.softDelete(p.snippetId, p.deletedAt);
      }
      default:
        return Effect.void;
    }
  };

  // ── Stats projector ────────────────────────────────────────────────────────
  const projectStatsEvent = (event: ClipboardEvent): Effect.Effect<void, ProjectionRepositoryError> => {
    switch (event.type) {
      case "clip.captured":
        return incrementStatCounter("totalClips");
      case "clip.pasted":
        return incrementStatCounter("totalPastes");
      default:
        return Effect.void;
    }
  };

  function incrementStatCounter(key: string): Effect.Effect<void, ProjectionRepositoryError> {
    return statsRepo.get(key).pipe(
      Effect.flatMap((existing) => {
        const current = existing ? parseInt(existing, 10) : 0;
        return statsRepo.set(key, String(current + 1));
      }),
    );
  }

  const projectors: ReadonlyArray<ProjectorDefinition> = [
    { name: CLIPBOARD_PROJECTOR_NAMES.clips, apply: projectClipEvent },
    { name: CLIPBOARD_PROJECTOR_NAMES.snippets, apply: projectSnippetEvent },
    { name: CLIPBOARD_PROJECTOR_NAMES.stats, apply: projectStatsEvent },
  ];

  // ── Bootstrap: replay events from each projector's last cursor ─────────────
  const bootstrap: ClipboardProjectionPipelineShape["bootstrap"] = Effect.gen(function* () {
    for (const projector of projectors) {
      const stateOpt = yield* projectionState.getByProjector({ projector: projector.name });
      const lastSequence = Option.isSome(stateOpt) ? stateOpt.value.lastAppliedSequence : 0;

      yield* Stream.runForEach(
        eventStore.readFromSequence(lastSequence),
        (event) =>
          projector.apply(event).pipe(
            Effect.flatMap(() =>
              projectionState.upsert({
                projector: projector.name,
                lastAppliedSequence: event.sequence,
                updatedAt: event.occurredAt,
              }),
            ),
          ),
      );
    }
    yield* Effect.log("clipboard projection pipeline bootstrapped");
  });

  // ── Project a single event through all projectors ──────────────────────────
  const projectEventFn: ClipboardProjectionPipelineShape["projectEvent"] = (event) =>
    Effect.gen(function* () {
      for (const projector of projectors) {
        yield* projector.apply(event);
        yield* projectionState.upsert({
          projector: projector.name,
          lastAppliedSequence: event.sequence,
          updatedAt: event.occurredAt,
        });
      }
    });

  return {
    bootstrap,
    projectEvent: projectEventFn,
  } satisfies ClipboardProjectionPipelineShape;
});

export const ClipboardProjectionPipelineLive = Layer.effect(
  ClipboardProjectionPipeline,
  makeProjectionPipeline,
);
