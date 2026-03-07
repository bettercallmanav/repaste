import http from "node:http";
import type { Duplex } from "node:stream";

import {
  type WsRequest,
  type WsPush,
  WsRequest as WsRequestSchema,
  WS_CHANNELS,
} from "@clipm/contracts";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Cause, Effect, Exit, Layer, Ref, Schema, Scope, ServiceMap, Stream } from "effect";
import { WebSocketServer, type WebSocket } from "ws";

import { ServerConfig } from "./config.ts";
import { ClipboardEngineService } from "./clipboard/Services/ClipboardEngine.ts";
import { SearchService } from "./clipboard/Services/SearchService.ts";

// ─── Errors ──────────────────────────────────────────────────────────────────

class ServerLifecycleError extends Error {
  readonly _tag = "ServerLifecycleError";
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// ─── Server Service ──────────────────────────────────────────────────────────

export type ServerDependencies = ServerConfig | ClipboardEngineService | SearchService;

export interface ServerShape {
  readonly start: Effect.Effect<
    http.Server,
    ServerLifecycleError,
    Scope.Scope | ServerDependencies
  >;
  readonly stopSignal: Effect.Effect<void, never>;
}

export class Server extends ServiceMap.Service<Server, ServerShape>()(
  "@clipm/server/wsServer/Server",
) {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rejectUpgrade(socket: Duplex, statusCode: number, message: string): void {
  socket.end(
    `HTTP/1.1 ${statusCode} ${statusCode === 401 ? "Unauthorized" : "Bad Request"}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      "\r\n" +
      message,
  );
}

function websocketRawToString(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw)).toString("utf8");
  return null;
}

function messageFromCause(cause: Cause.Cause<unknown>): string {
  const squashed = Cause.squash(cause);
  const message =
    squashed instanceof Error ? squashed.message.trim() : String(squashed).trim();
  return message.length > 0 ? message : Cause.pretty(cause);
}

// ─── Server Creation ─────────────────────────────────────────────────────────

export const createServer = Effect.fn(function* (): Effect.fn.Return<
  http.Server,
  ServerLifecycleError,
  Scope.Scope | ServerDependencies
> {
  const config = yield* ServerConfig;
  const engine = yield* ClipboardEngineService;
  const search = yield* SearchService;

  const clients = yield* Ref.make(new Set<WebSocket>());
  const wss = new WebSocketServer({ noServer: true });

  // Capture runtime services so we can run effects from raw Node.js callbacks
  const runtimeServices = yield* Effect.services<ServerDependencies>();
  const runPromise = Effect.runPromiseWith(runtimeServices);

  // ── Request router ───────────────────────────────────────────────────────
  const routeRequest = Effect.fnUntraced(function* (request: WsRequest) {
    const { body } = request;
    switch (body._tag) {
      case "clipboard.getSnapshot":
        return yield* engine.getReadModel();

      case "clipboard.dispatchCommand":
        return yield* engine.dispatch(body.command);

      case "clipboard.search":
        return yield* search.search(body.query, 50).pipe(Effect.map((clips) => ({ clips })));
    }
  });

  // ── Message handler ──────────────────────────────────────────────────────
  const handleMessage = Effect.fnUntraced(function* (ws: WebSocket, raw: unknown) {
    const messageText = websocketRawToString(raw);
    if (messageText === null) {
      ws.send(JSON.stringify({ id: null, error: { message: "Invalid message format" } }));
      return;
    }

    const request = Schema.decodeExit(Schema.fromJsonString(WsRequestSchema))(messageText);
    if (request._tag === "Failure") {
      ws.send(
        JSON.stringify({
          id: null,
          error: { message: `Invalid request format: ${messageFromCause(request.cause)}` },
        }),
      );
      return;
    }

    const result = yield* Effect.exit(routeRequest(request.value));
    if (result._tag === "Failure") {
      ws.send(
        JSON.stringify({
          id: request.value.id,
          error: { message: messageFromCause(result.cause) },
        }),
      );
      return;
    }

    ws.send(JSON.stringify({ id: request.value.id, result: result.value }));
  });

  // ── Domain event broadcast ───────────────────────────────────────────────
  const subscriptionsScope = yield* Scope.make("sequential");
  yield* Effect.addFinalizer(() => Scope.close(subscriptionsScope, Exit.void));

  yield* Stream.runForEach(engine.streamDomainEvents, (event) =>
    Ref.get(clients).pipe(
      Effect.flatMap((set) =>
        Effect.sync(() => {
          const push: WsPush = { channel: WS_CHANNELS.domainEvent, data: event };
          const msg = JSON.stringify(push);
          for (const ws of set) {
            try {
              ws.send(msg);
            } catch {
              // dead socket
            }
          }
        }),
      ),
    ),
  ).pipe(Effect.forkIn(subscriptionsScope));

  // ── WebSocket connection handler ─────────────────────────────────────────
  wss.on("connection", (ws: WebSocket) => {
    void runPromise(Ref.update(clients, (set) => set.add(ws)));

    ws.on("message", (raw) => {
      void runPromise(
        handleMessage(ws, raw).pipe(
          Effect.catch((error) => Effect.logError("Error handling message", error)),
        ),
      );
    });

    ws.on("close", () => {
      void runPromise(
        Ref.update(clients, (set) => {
          set.delete(ws);
          return set;
        }),
      );
    });

    ws.on("error", () => {
      void runPromise(
        Ref.update(clients, (set) => {
          set.delete(ws);
          return set;
        }),
      );
    });
  });

  // ── HTTP server ──────────────────────────────────────────────────────────
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("clipm server ok");
  });

  httpServer.on("upgrade", (req, socket: Duplex, head) => {
    if (config.authToken) {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const token = url.searchParams.get("token");
      if (token !== config.authToken) {
        rejectUpgrade(socket, 401, "Invalid auth token");
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  yield* NodeHttpServer.make(() => httpServer, { port: config.port, host: config.host }).pipe(
    Effect.mapError(
      (cause) => new ServerLifecycleError("Failed to start server", { cause }),
    ),
  );

  yield* Effect.addFinalizer(() =>
    Effect.callback<void>((resume) => {
      wss.close();
      httpServer.close(() => resume(Effect.void));
    }),
  );

  return httpServer;
});

// ─── Layer ───────────────────────────────────────────────────────────────────

export const ServerLive = Layer.succeed(Server, {
  start: createServer(),
  stopSignal: Effect.never,
} satisfies ServerShape);
