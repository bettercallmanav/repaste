import type {
  ClipSearchFilters,
  ClipboardCommand,
  ClipboardReadModel,
  Clip,
} from "@clipm/contracts";
import { WsTransport } from "./wsTransport.ts";

const transport = new WsTransport();

export const api = {
  getSnapshot: () =>
    transport.request<ClipboardReadModel>("clipboard.getSnapshot"),

  dispatch: (command: ClipboardCommand) =>
    transport.request<{ sequence: number }>("clipboard.dispatchCommand", { command }),

  search: (query: string, filters?: ClipSearchFilters) =>
    transport.request<{ clips: Clip[] }>("clipboard.search", { query, filters }),

  subscribe: transport.subscribe.bind(transport),
};
