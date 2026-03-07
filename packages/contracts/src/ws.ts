import { Schema } from "effect";
import { ClipboardCommand, ClipboardEvent, ClipboardReadModel } from "./clipboard";

// ─── WebSocket Request/Response Protocol ─────────────────────────────────────

export const WsRequestBody = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("clipboard.getSnapshot"),
  }),
  Schema.Struct({
    _tag: Schema.Literal("clipboard.dispatchCommand"),
    command: ClipboardCommand,
  }),
  Schema.Struct({
    _tag: Schema.Literal("clipboard.search"),
    query: Schema.String,
    filters: Schema.optional(
      Schema.Struct({
        contentType: Schema.optional(Schema.String),
        pinned: Schema.optional(Schema.Boolean),
        tag: Schema.optional(Schema.String),
      }),
    ),
  }),
);
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

export const WsResponse = Schema.Union(WsSuccessResponse, WsErrorResponse);
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
