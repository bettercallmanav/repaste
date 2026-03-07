import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS clipboard_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      aggregate_kind TEXT NOT NULL,
      stream_id TEXT NOT NULL,
      stream_version INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      command_id TEXT,
      payload_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_clip_events_stream_version
    ON clipboard_events(aggregate_kind, stream_id, stream_version)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_clip_events_stream_sequence
    ON clipboard_events(aggregate_kind, stream_id, sequence)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_clip_events_command_id
    ON clipboard_events(command_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_clip_events_type
    ON clipboard_events(event_type)
  `;
});
