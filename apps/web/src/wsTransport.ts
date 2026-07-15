import type { WsPush, WsResponse } from "@clipm/contracts";

type PushListener = (data: unknown) => void;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];

interface WsRequestEnvelope {
  id: string;
  body: { _tag: string; [key: string]: unknown };
}

function isPush(msg: unknown): msg is WsPush {
  return typeof msg === "object" && msg !== null && "channel" in msg && "data" in msg;
}

function isResponse(msg: unknown): msg is WsResponse & { id: string } {
  return typeof msg === "object" && msg !== null && "id" in msg;
}

export class WsTransport {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<string, Set<PushListener>>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly url: string;
  // Incremented per connect()/dispose(); listeners on stale sockets no-op.
  private generation = 0;
  private hasConnected = false;
  // Requests made while disconnected wait here and flush on open.
  private readonly outbox: WsRequestEnvelope[] = [];
  private readonly reconnectListeners = new Set<() => void>();

  constructor(url?: string) {
    const bridgeUrl = (window as { desktopBridge?: { getWsUrl(): string } }).desktopBridge?.getWsUrl();
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    this.url =
      url ??
      (bridgeUrl && bridgeUrl.length > 0
        ? bridgeUrl
        : envUrl && envUrl.length > 0
          ? envUrl
          : `ws://${window.location.hostname}:${window.location.port}`);
    this.connect();
  }

  async request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = String(this.nextId++);
    const body = params ? { ...params, _tag: method } : { _tag: method };
    const message: WsRequestEnvelope = { id, body };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      });

      this.send(message);
    });
  }

  subscribe(channel: string, listener: PushListener): () => void {
    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set();
      this.listeners.set(channel, channelListeners);
    }
    channelListeners.add(listener);
    return () => {
      channelListeners!.delete(listener);
      if (channelListeners!.size === 0) this.listeners.delete(channel);
    };
  }

  /** Fires after the connection is re-established (not on the first connect). */
  onReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.rejectPending("Transport disposed");
    this.outbox.length = 0;
    this.reconnectListeners.clear();
    this.ws?.close();
    this.ws = null;
  }

  private rejectPending(message: string) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private connect() {
    if (this.disposed) return;
    const generation = ++this.generation;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      if (generation !== this.generation || this.disposed) {
        ws.close();
        return;
      }
      this.reconnectAttempt = 0;
      this.flushOutbox();
      if (this.hasConnected) {
        for (const listener of this.reconnectListeners) {
          try {
            listener();
          } catch { /* swallow */ }
        }
      }
      this.hasConnected = true;
    });

    ws.addEventListener("message", (event) => {
      if (generation !== this.generation) return;
      this.handleMessage(event.data);
    });
    ws.addEventListener("close", () => {
      if (generation !== this.generation) return;
      this.ws = null;
      // In-flight requests cannot complete on a dead socket; not-yet-sent
      // requests stay in the outbox and flush on reconnect.
      this.rejectPending("Connection closed");
      this.scheduleReconnect();
    });
    ws.addEventListener("error", () => {});
  }

  private flushOutbox() {
    while (this.outbox.length > 0) {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const message = this.outbox.shift()!;
      // Skip requests that already timed out while waiting.
      if (!this.pending.has(message.id)) continue;
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    // Push event
    if (isPush(parsed)) {
      const channelListeners = this.listeners.get(parsed.channel);
      if (channelListeners) {
        for (const listener of channelListeners) {
          try {
            listener(parsed.data);
          } catch { /* swallow */ }
        }
      }
      return;
    }

    // Response
    if (isResponse(parsed)) {
      const pending = this.pending.get(parsed.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(parsed.id);

      if ("error" in parsed && parsed.error) {
        const err = parsed.error as { message?: string };
        pending.reject(new Error(err.message ?? "Unknown error"));
      } else {
        pending.resolve("result" in parsed ? parsed.result : undefined);
      }
    }
  }

  private send(message: WsRequestEnvelope) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    // Not connected yet: hold until open. The request's own timeout in
    // request() still bounds how long it can wait.
    this.outbox.push(message);
  }

  private scheduleReconnect() {
    if (this.disposed) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]!;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
