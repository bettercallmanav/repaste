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

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Transport disposed"));
    }
    this.pending.clear();
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.disposed) return;
    const ws = new WebSocket(this.url);

    ws.addEventListener("open", () => {
      this.ws = ws;
      this.reconnectAttempt = 0;
    });

    ws.addEventListener("message", (event) => this.handleMessage(event.data));
    ws.addEventListener("close", () => {
      this.ws = null;
      this.scheduleReconnect();
    });
    ws.addEventListener("error", () => {});
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
    // Wait for connection
    const check = setInterval(() => {
      if (this.disposed) { clearInterval(check); return; }
      if (this.ws?.readyState === WebSocket.OPEN) {
        clearInterval(check);
        this.ws.send(JSON.stringify(message));
      }
    }, 50);
    setTimeout(() => clearInterval(check), REQUEST_TIMEOUT_MS);
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
