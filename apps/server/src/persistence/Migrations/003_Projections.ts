import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Projection cursor state
  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_state (
      projector TEXT PRIMARY KEY,
      last_applied_sequence INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `;

  // Denormalized clip projection
  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_clips (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      preview TEXT NOT NULL,
      image_data_url TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      tags_json TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'text',
      source_app TEXT,
      paste_count INTEGER NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL,
      deleted_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_captured
    ON projection_clips(captured_at DESC)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_category
    ON projection_clips(category)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_pinned
    ON projection_clips(pinned)
  `;

  // Denormalized snippet projection
  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      shortcut TEXT,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `;

  // Key-value stats
  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_stats (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    )
  `;

  // Full-text search on clip content
  yield* sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
      id UNINDEXED,
      content,
      preview,
      category UNINDEXED
    )
  `;
});
