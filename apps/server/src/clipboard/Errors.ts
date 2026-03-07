import { SchemaIssue, Schema } from "effect";

import type { ProjectionRepositoryError } from "../persistence/Errors.ts";

export class ClipboardCommandInvariantError extends Schema.TaggedErrorClass<ClipboardCommandInvariantError>()(
  "ClipboardCommandInvariantError",
  {
    commandType: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Command invariant failed (${this.commandType}): ${this.detail}`;
  }
}

export class ClipboardCommandPreviouslyRejectedError extends Schema.TaggedErrorClass<ClipboardCommandPreviouslyRejectedError>()(
  "ClipboardCommandPreviouslyRejectedError",
  {
    commandId: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Command previously rejected (${this.commandId}): ${this.detail}`;
  }
}

export class ClipboardCommandDecodeError extends Schema.TaggedErrorClass<ClipboardCommandDecodeError>()(
  "ClipboardCommandDecodeError",
  {
    issue: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Invalid clipboard command payload: ${this.issue}`;
  }
}

export class ClipboardProjectorDecodeError extends Schema.TaggedErrorClass<ClipboardProjectorDecodeError>()(
  "ClipboardProjectorDecodeError",
  {
    eventType: Schema.String,
    issue: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Projector decode failed for ${this.eventType}: ${this.issue}`;
  }
}

export class ClipboardListenerCallbackError extends Schema.TaggedErrorClass<ClipboardListenerCallbackError>()(
  "ClipboardListenerCallbackError",
  {
    listener: Schema.Literals(["read-model", "domain-event"]),
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Clipboard ${this.listener} listener failed: ${this.detail}`;
  }
}

export type ClipboardDispatchError =
  | ProjectionRepositoryError
  | ClipboardCommandInvariantError
  | ClipboardCommandPreviouslyRejectedError
  | ClipboardProjectorDecodeError
  | ClipboardListenerCallbackError;

export type ClipboardEngineError =
  | ClipboardDispatchError
  | ClipboardCommandDecodeError;

export function toClipboardCommandDecodeError(error: Schema.SchemaError) {
  return new ClipboardCommandDecodeError({
    issue: SchemaIssue.makeFormatterDefault()(error.issue),
    cause: error,
  });
}

export function toProjectorDecodeError(eventType: string) {
  return (error: Schema.SchemaError): ClipboardProjectorDecodeError =>
    new ClipboardProjectorDecodeError({
      eventType,
      issue: SchemaIssue.makeFormatterDefault()(error.issue),
      cause: error,
    });
}
