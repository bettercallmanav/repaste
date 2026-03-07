import path from "node:path";
import { Effect, Layer } from "effect";

import { DEFAULT_PORT, ServerConfig } from "./config.ts";
import { Server } from "./wsServer.ts";
import * as SqlitePersistence from "./persistence/Layers/Sqlite.ts";
import { makeServerRuntimeServicesLayer } from "./serverLayers.ts";
import { ServerLive } from "./wsServer.ts";

export interface CliInput {
  readonly port?: number;
  readonly host?: string;
  readonly stateDir?: string;
  readonly authToken?: string;
}

export const makeServerProgram = Effect.gen(function* () {
  const { start, stopSignal } = yield* Server;
  const config = yield* ServerConfig;

  yield* start;
  yield* Effect.log(`clipm server listening on http://${config.host}:${config.port}`);
  yield* stopSignal;
});

export const makeRuntimeLayer = (input: CliInput = {}) => {
  const stateDir = input.stateDir ?? process.cwd();
  const port = input.port ?? DEFAULT_PORT;
  const host = input.host ?? "127.0.0.1";

  const dbPath = path.join(stateDir, "clipm.db");

  const configLayer = ServerConfig.layer({ port, host, stateDir, authToken: input.authToken });
  const sqliteLayer = SqlitePersistence.makeSqlitePersistenceLive(dbPath);
  const runtimeLayer = makeServerRuntimeServicesLayer();

  return Layer.empty.pipe(
    Layer.provideMerge(ServerLive),
    Layer.provideMerge(runtimeLayer),
    Layer.provideMerge(sqliteLayer),
    Layer.provideMerge(configLayer),
  );
};
