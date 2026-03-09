import { Schema } from "effect";
import { ClipboardCommand, ClipboardEvent, ClipboardReadModel, ContentType } from "./clipboard.ts";

export const ClipSearchFilters = Schema.Struct({
  contentType: Schema.optional(ContentType),
  pinned: Schema.optional(Schema.Boolean),
  tag: Schema.optional(Schema.String),
  sourceApp: Schema.optional(Schema.String),
  dateFrom: Schema.optional(Schema.String),
  dateTo: Schema.optional(Schema.String),
});
export type ClipSearchFilters = typeof ClipSearchFilters.Type;

// ─── WebSocket Request/Response Protocol ─────────────────────────────────────

export const WsRequestBody = Schema.Union([
  Schema.TaggedStruct("clipboard.getSnapshot", {}),
  Schema.TaggedStruct("clipboard.dispatchCommand", {
    command: ClipboardCommand,
  }),
  Schema.TaggedStruct("clipboard.search", {
    query: Schema.String,
    filters: Schema.optional(ClipSearchFilters),
  }),
]);
export type WsRequestBody = typeof WsRequestBody.Type;

export const WsRequest = Schema.Struct({
  id: Schema.String,
  body: WsRequestBody,
});
export type WsRequest = typeof WsRequest.Type;

export const WsSuccessResponse = Schema.Struct({
  id: Schema.String,
  result: Schema.Unknown,
});

export const WsErrorResponse = Schema.Struct({
  id: Schema.String,
  error: Schema.Struct({ message: Schema.String }),
});

export const WsResponse = Schema.Union([WsSuccessResponse, WsErrorResponse]);
export type WsResponse = typeof WsResponse.Type;

export const WsPush = Schema.Struct({
  channel: Schema.String,
  data: Schema.Unknown,
});
export type WsPush = typeof WsPush.Type;

// ─── Channels ────────────────────────────────────────────────────────────────

export const WS_CHANNELS = {
  domainEvent: "clipboard.domainEvent",
} as const;

// ─── Snapshot Response ───────────────────────────────────────────────────────

export const SnapshotResponse = ClipboardReadModel;
export type SnapshotResponse = ClipboardReadModel;

// ─── Dispatch Response ───────────────────────────────────────────────────────

export const DispatchResponse = Schema.Struct({
  sequence: Schema.Number,
});
export type DispatchResponse = typeof DispatchResponse.Type;

// ─── Search Response ─────────────────────────────────────────────────────────

export const SearchResponse = Schema.Struct({
  clips: Schema.Array(Schema.Unknown),
});
export type SearchResponse = typeof SearchResponse.Type;

// ─── Domain Event Push ───────────────────────────────────────────────────────

export const DomainEventPush = ClipboardEvent;
export type DomainEventPush = typeof DomainEventPush.Type;
