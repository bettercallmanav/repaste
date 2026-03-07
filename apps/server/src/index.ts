import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";

import { makeServerProgram, makeRuntimeLayer } from "./main.ts";

const port = parseInt(process.env.CLIPM_PORT ?? "3847", 10);
const host = process.env.CLIPM_HOST ?? "127.0.0.1";
const stateDir = process.env.CLIPM_STATE_DIR ?? process.cwd();
const authToken = process.env.CLIPM_AUTH_TOKEN ?? undefined;

const RuntimeLayer = Layer.empty.pipe(
  Layer.provideMerge(makeRuntimeLayer({ port, host, stateDir, authToken })),
  Layer.provideMerge(NodeServices.layer),
);

makeServerProgram.pipe(Effect.provide(RuntimeLayer), Effect.scoped, NodeRuntime.runMain);
