import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { ClipboardEvent, ClipboardReadModel } from "@clipm/contracts";

import { createEmptyReadModel, projectEvent, projectNewEvents } from "./projector.ts";

const OCCURRED_AT = "2026-07-15T00:00:00.000Z";

function capturedEvent(sequence: number, clipId: string): ClipboardEvent {
  return {
    sequence,
    eventId: `event-${sequence}`,
    aggregateKind: "clip",
    aggregateId: clipId,
    type: "clip.captured",
    payload: {
      clipId,
      content: "hello",
      contentType: "text",
      category: "text",
      preview: "hello",
      imageDataUrl: null,
      sourceApp: null,
      metadata: { charCount: 5, wordCount: 1, lineCount: 1, language: null, url: null },
      capturedAt: OCCURRED_AT,
    },
    occurredAt: OCCURRED_AT,
    commandId: null,
    metadata: {},
  } as unknown as ClipboardEvent;
}

function pastedEvent(sequence: number, clipId: string): ClipboardEvent {
  return {
    sequence,
    eventId: `event-${sequence}`,
    aggregateKind: "clip",
    aggregateId: clipId,
    type: "clip.pasted",
    payload: { clipId, pastedAt: OCCURRED_AT },
    occurredAt: OCCURRED_AT,
    commandId: null,
    metadata: {},
  } as unknown as ClipboardEvent;
}

function foldAll(
  model: ClipboardReadModel,
  events: ReadonlyArray<ClipboardEvent>,
): ClipboardReadModel {
  let next = model;
  for (const event of events) {
    next = Effect.runSync(projectEvent(next, event));
  }
  return next;
}

describe("projectNewEvents", () => {
  it("skips events already applied (no duplicate clips)", () => {
    const captured = capturedEvent(1, "clip-1");
    const model = foldAll(createEmptyReadModel(OCCURRED_AT), [captured]);

    const { model: next, applied } = Effect.runSync(projectNewEvents(model, [captured]));

    expect(applied).toHaveLength(0);
    expect(next).toBe(model);
    expect(next.clips).toHaveLength(1);
    expect(next.snapshotSequence).toBe(1);
  });

  it("does not double-increment pasteCount on replayed events", () => {
    const model = foldAll(createEmptyReadModel(OCCURRED_AT), [
      capturedEvent(1, "clip-1"),
      pastedEvent(2, "clip-1"),
    ]);
    expect(model.clips[0]?.pasteCount).toBe(1);

    // Replay includes the already-applied paste plus one genuinely new one.
    const { model: next, applied } = Effect.runSync(
      projectNewEvents(model, [pastedEvent(2, "clip-1"), pastedEvent(3, "clip-1")]),
    );

    expect(applied.map((event) => event.sequence)).toEqual([3]);
    expect(next.clips[0]?.pasteCount).toBe(2);
    expect(next.snapshotSequence).toBe(3);
  });

  it("clip.captureDeduplicated bumps the existing clip to the top with a fresh capturedAt", () => {
    const model = foldAll(createEmptyReadModel(OCCURRED_AT), [
      capturedEvent(1, "clip-1"),
      capturedEvent(2, "clip-2"), // clip-2 is now at the head
    ]);
    expect(model.clips.map((clip) => clip.id)).toEqual(["clip-2", "clip-1"]);

    const bumpedAt = "2026-07-15T01:00:00.000Z";
    const dedupEvent = {
      sequence: 3,
      eventId: "event-3",
      aggregateKind: "clip",
      aggregateId: "clip-1",
      type: "clip.captureDeduplicated",
      payload: { clipId: "clip-1", capturedAt: bumpedAt },
      occurredAt: bumpedAt,
      commandId: null,
      metadata: {},
    } as unknown as ClipboardEvent;

    const next = Effect.runSync(projectEvent(model, dedupEvent));

    expect(next.clips.map((clip) => clip.id)).toEqual(["clip-1", "clip-2"]);
    expect(next.clips[0]?.capturedAt).toBe(bumpedAt);
    expect(next.clips).toHaveLength(2);
    expect(next.snapshotSequence).toBe(3);
  });

  it("applies newer events in order and advances snapshotSequence", () => {
    const model = createEmptyReadModel(OCCURRED_AT);

    const { model: next, applied } = Effect.runSync(
      projectNewEvents(model, [capturedEvent(1, "clip-1"), capturedEvent(2, "clip-2")]),
    );

    expect(applied.map((event) => event.sequence)).toEqual([1, 2]);
    expect(next.clips.map((clip) => clip.id)).toEqual(["clip-2", "clip-1"]);
    expect(next.snapshotSequence).toBe(2);
  });
});
