import * as Migrator from "effect/unstable/sql/Migrator";
import * as Layer from "effect/Layer";
import { Effect } from "effect";

import Migration0001 from "./Migrations/001_ClipboardEvents.ts";
import Migration0002 from "./Migrations/002_CommandReceipts.ts";
import Migration0003 from "./Migrations/003_Projections.ts";
import Migration0004 from "./Migrations/004_SearchIndexing.ts";
import Migration0005 from "./Migrations/005_ImageAssetsAndOcr.ts";
import Migration0006 from "./Migrations/006_OcrStatus.ts";

const loader = Migrator.fromRecord({
  "1_ClipboardEvents": Migration0001,
  "2_CommandReceipts": Migration0002,
  "3_Projections": Migration0003,
  "4_SearchIndexing": Migration0004,
  "5_ImageAssetsAndOcr": Migration0005,
  "6_OcrStatus": Migration0006,
});

const run = Migrator.make({});

export const runMigrations = Effect.gen(function* () {
  yield* Effect.log("Running clipboard migrations...");
  yield* run({ loader });
  yield* Effect.log("Clipboard migrations ran successfully");
});

export const MigrationsLive = Layer.effectDiscard(runMigrations);
