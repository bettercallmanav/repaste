import { Schema } from "effect";
import { ClipId, CommandId, EventId, IsoDateTime, NonNegativeInt, SnippetId } from "./baseSchemas";

// ─── Content Types ───────────────────────────────────────────────────────────

export const ContentType = Schema.Literal(
  "text",
  "image",
  "richText",
  "filePath",
  "url",
  "code",
  "email",
  "color",
  "json",
  "phone",
);
export type ContentType = typeof ContentType.Type;

// ─── Aggregate Kinds ─────────────────────────────────────────────────────────

export const ClipboardAggregateKind = Schema.Literal("clip", "snippet", "settings");
export type ClipboardAggregateKind = typeof ClipboardAggregateKind.Type;

// ─── Clip Metadata ───────────────────────────────────────────────────────────

export const ClipMetadata = Schema.Struct({
  charCount: NonNegativeInt,
  wordCount: NonNegativeInt,
  lineCount: NonNegativeInt,
  language: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
});
export type ClipMetadata = typeof ClipMetadata.Type;

// ─── Commands ────────────────────────────────────────────────────────────────

export const ClipCaptureCommand = Schema.Struct({
  type: Schema.Literal("clip.capture"),
  commandId: CommandId,
  clipId: ClipId,
  content: Schema.String,
  contentType: ContentType,
  category: Schema.String,
  preview: Schema.String,
  imageDataUrl: Schema.NullOr(Schema.String),
  sourceApp: Schema.NullOr(Schema.String),
  metadata: ClipMetadata,
  capturedAt: IsoDateTime,
});

export const ClipPinCommand = Schema.Struct({
  type: Schema.Literal("clip.pin"),
  commandId: CommandId,
  clipId: ClipId,
});

export const ClipUnpinCommand = Schema.Struct({
  type: Schema.Literal("clip.unpin"),
  commandId: CommandId,
  clipId: ClipId,
});

export const ClipDeleteCommand = Schema.Struct({
  type: Schema.Literal("clip.delete"),
  commandId: CommandId,
  clipId: ClipId,
});

export const ClipTagCommand = Schema.Struct({
  type: Schema.Literal("clip.tag"),
  commandId: CommandId,
  clipId: ClipId,
  tag: Schema.String,
});

export const ClipUntagCommand = Schema.Struct({
  type: Schema.Literal("clip.untag"),
  commandId: CommandId,
  clipId: ClipId,
  tag: Schema.String,
});

export const ClipMergeCommand = Schema.Struct({
  type: Schema.Literal("clip.merge"),
  commandId: CommandId,
  newClipId: ClipId,
  sourceClipIds: Schema.Array(ClipId),
  separator: Schema.String,
  capturedAt: IsoDateTime,
});

export const ClipPasteCommand = Schema.Struct({
  type: Schema.Literal("clip.paste"),
  commandId: CommandId,
  clipId: ClipId,
  pastedAt: IsoDateTime,
});

export const SnippetCreateCommand = Schema.Struct({
  type: Schema.Literal("snippet.create"),
  commandId: CommandId,
  snippetId: SnippetId,
  title: Schema.String,
  content: Schema.String,
  shortcut: Schema.NullOr(Schema.String),
  createdAt: IsoDateTime,
});

export const SnippetUpdateCommand = Schema.Struct({
  type: Schema.Literal("snippet.update"),
  commandId: CommandId,
  snippetId: SnippetId,
  title: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  shortcut: Schema.optional(Schema.NullOr(Schema.String)),
  updatedAt: IsoDateTime,
});

export const SnippetDeleteCommand = Schema.Struct({
  type: Schema.Literal("snippet.delete"),
  commandId: CommandId,
  snippetId: SnippetId,
});

export const SettingsUpdateCommand = Schema.Struct({
  type: Schema.Literal("settings.update"),
  commandId: CommandId,
  settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  updatedAt: IsoDateTime,
});

export const ClipboardCommand = Schema.Union(
  ClipCaptureCommand,
  ClipPinCommand,
  ClipUnpinCommand,
  ClipDeleteCommand,
  ClipTagCommand,
  ClipUntagCommand,
  ClipMergeCommand,
  ClipPasteCommand,
  SnippetCreateCommand,
  SnippetUpdateCommand,
  SnippetDeleteCommand,
  SettingsUpdateCommand,
);
export type ClipboardCommand = typeof ClipboardCommand.Type;

// ─── Event Payloads ──────────────────────────────────────────────────────────

export const ClipCapturedPayload = Schema.Struct({
  clipId: ClipId,
  content: Schema.String,
  contentType: ContentType,
  category: Schema.String,
  preview: Schema.String,
  imageDataUrl: Schema.NullOr(Schema.String),
  sourceApp: Schema.NullOr(Schema.String),
  metadata: ClipMetadata,
  capturedAt: IsoDateTime,
});

export const ClipPinnedPayload = Schema.Struct({ clipId: ClipId });
export const ClipUnpinnedPayload = Schema.Struct({ clipId: ClipId });
export const ClipDeletedPayload = Schema.Struct({ clipId: ClipId, deletedAt: IsoDateTime });

export const ClipTaggedPayload = Schema.Struct({ clipId: ClipId, tag: Schema.String });
export const ClipUntaggedPayload = Schema.Struct({ clipId: ClipId, tag: Schema.String });

export const ClipMergedPayload = Schema.Struct({
  newClipId: ClipId,
  sourceClipIds: Schema.Array(ClipId),
  content: Schema.String,
  preview: Schema.String,
  metadata: ClipMetadata,
  capturedAt: IsoDateTime,
});

export const ClipPastedPayload = Schema.Struct({ clipId: ClipId, pastedAt: IsoDateTime });

export const SnippetCreatedPayload = Schema.Struct({
  snippetId: SnippetId,
  title: Schema.String,
  content: Schema.String,
  shortcut: Schema.NullOr(Schema.String),
  createdAt: IsoDateTime,
});

export const SnippetUpdatedPayload = Schema.Struct({
  snippetId: SnippetId,
  title: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  shortcut: Schema.optional(Schema.NullOr(Schema.String)),
  updatedAt: IsoDateTime,
});

export const SnippetDeletedPayload = Schema.Struct({
  snippetId: SnippetId,
  deletedAt: IsoDateTime,
});

export const SettingsUpdatedPayload = Schema.Struct({
  settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  updatedAt: IsoDateTime,
});

// ─── Event Types ─────────────────────────────────────────────────────────────

export const ClipboardEventType = Schema.Literal(
  "clip.captured",
  "clip.pinned",
  "clip.unpinned",
  "clip.deleted",
  "clip.tagged",
  "clip.untagged",
  "clip.merged",
  "clip.pasted",
  "snippet.created",
  "snippet.updated",
  "snippet.deleted",
  "settings.updated",
);
export type ClipboardEventType = typeof ClipboardEventType.Type;

// ─── Event Envelope ──────────────────────────────────────────────────────────

export const ClipboardEvent = Schema.Struct({
  sequence: NonNegativeInt,
  eventId: EventId,
  aggregateKind: ClipboardAggregateKind,
  aggregateId: Schema.String,
  type: ClipboardEventType,
  payload: Schema.Unknown,
  occurredAt: IsoDateTime,
  commandId: Schema.NullOr(CommandId),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type ClipboardEvent = typeof ClipboardEvent.Type;

// ─── Read Model ──────────────────────────────────────────────────────────────

export const Clip = Schema.Struct({
  id: ClipId,
  content: Schema.String,
  contentType: ContentType,
  preview: Schema.String,
  imageDataUrl: Schema.NullOr(Schema.String),
  pinned: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  category: Schema.String,
  sourceApp: Schema.NullOr(Schema.String),
  pasteCount: NonNegativeInt,
  capturedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
  metadata: ClipMetadata,
});
export type Clip = typeof Clip.Type;

export const Snippet = Schema.Struct({
  id: SnippetId,
  title: Schema.String,
  content: Schema.String,
  shortcut: Schema.NullOr(Schema.String),
  usageCount: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type Snippet = typeof Snippet.Type;

export const AppSettings = Schema.Struct({
  maxHistorySize: Schema.Number,
  pollingIntervalMs: Schema.Number,
  globalShortcut: Schema.String,
  showInMenuBar: Schema.Boolean,
  startAtLogin: Schema.Boolean,
  deduplicateConsecutive: Schema.Boolean,
  ignoredApps: Schema.Array(Schema.String),
  theme: Schema.Literal("system", "light", "dark"),
});
export type AppSettings = typeof AppSettings.Type;

export const ClipboardStats = Schema.Struct({
  totalClips: NonNegativeInt,
  totalPastes: NonNegativeInt,
  mostUsedClipIds: Schema.Array(ClipId),
});
export type ClipboardStats = typeof ClipboardStats.Type;

export const ClipboardReadModel = Schema.Struct({
  snapshotSequence: NonNegativeInt,
  clips: Schema.Array(Clip),
  snippets: Schema.Array(Snippet),
  knownTags: Schema.Array(Schema.String),
  settings: AppSettings,
  stats: ClipboardStats,
  updatedAt: IsoDateTime,
});
export type ClipboardReadModel = typeof ClipboardReadModel.Type;

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistorySize: 1000,
  pollingIntervalMs: 500,
  globalShortcut: "CmdOrCtrl+Shift+V",
  showInMenuBar: true,
  startAtLogin: false,
  deduplicateConsecutive: true,
  ignoredApps: [],
  theme: "system",
};
