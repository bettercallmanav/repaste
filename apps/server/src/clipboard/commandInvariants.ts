import type {
  ClipboardCommand,
  ClipboardReadModel,
  Clip,
  Snippet,
  ClipId,
  SnippetId,
} from "@clipm/contracts";
import { Effect } from "effect";

import { ClipboardCommandInvariantError } from "./Errors.ts";

function invariantError(commandType: string, detail: string): ClipboardCommandInvariantError {
  return new ClipboardCommandInvariantError({ commandType, detail });
}

export function findClipById(
  readModel: ClipboardReadModel,
  clipId: ClipId,
): Clip | undefined {
  return readModel.clips.find((clip) => clip.id === clipId && clip.deletedAt === null);
}

export function findSnippetById(
  readModel: ClipboardReadModel,
  snippetId: SnippetId,
): Snippet | undefined {
  return readModel.snippets.find((s) => s.id === snippetId && s.deletedAt === null);
}

export function requireClip(input: {
  readonly readModel: ClipboardReadModel;
  readonly command: ClipboardCommand;
  readonly clipId: ClipId;
}): Effect.Effect<Clip, ClipboardCommandInvariantError> {
  const clip = findClipById(input.readModel, input.clipId);
  if (clip) return Effect.succeed(clip);
  return Effect.fail(
    invariantError(input.command.type, `Clip '${input.clipId}' does not exist.`),
  );
}

export function requireClipAbsent(input: {
  readonly readModel: ClipboardReadModel;
  readonly command: ClipboardCommand;
  readonly clipId: ClipId;
}): Effect.Effect<void, ClipboardCommandInvariantError> {
  if (!findClipById(input.readModel, input.clipId)) return Effect.void;
  return Effect.fail(
    invariantError(input.command.type, `Clip '${input.clipId}' already exists.`),
  );
}

export function requireSnippet(input: {
  readonly readModel: ClipboardReadModel;
  readonly command: ClipboardCommand;
  readonly snippetId: SnippetId;
}): Effect.Effect<Snippet, ClipboardCommandInvariantError> {
  const snippet = findSnippetById(input.readModel, input.snippetId);
  if (snippet) return Effect.succeed(snippet);
  return Effect.fail(
    invariantError(input.command.type, `Snippet '${input.snippetId}' does not exist.`),
  );
}

export function requireSnippetAbsent(input: {
  readonly readModel: ClipboardReadModel;
  readonly command: ClipboardCommand;
  readonly snippetId: SnippetId;
}): Effect.Effect<void, ClipboardCommandInvariantError> {
  if (!findSnippetById(input.readModel, input.snippetId)) return Effect.void;
  return Effect.fail(
    invariantError(input.command.type, `Snippet '${input.snippetId}' already exists.`),
  );
}

export function requireAllClipsExist(input: {
  readonly readModel: ClipboardReadModel;
  readonly command: ClipboardCommand;
  readonly clipIds: ReadonlyArray<ClipId>;
}): Effect.Effect<ReadonlyArray<Clip>, ClipboardCommandInvariantError> {
  const clips: Clip[] = [];
  for (const clipId of input.clipIds) {
    const clip = findClipById(input.readModel, clipId);
    if (!clip) {
      return Effect.fail(
        invariantError(input.command.type, `Source clip '${clipId}' does not exist for merge.`),
      );
    }
    clips.push(clip);
  }
  return Effect.succeed(clips);
}
