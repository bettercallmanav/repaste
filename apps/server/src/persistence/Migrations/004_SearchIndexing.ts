import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_content_type
    ON projection_clips(content_type)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_source_app
    ON projection_clips(source_app)
  `;

  // Rebuild the derived FTS table with richer indexed fields.
  yield* sql`DROP TABLE IF EXISTS clips_fts`;

  yield* sql`
    CREATE VIRTUAL TABLE clips_fts USING fts5(
      id UNINDEXED,
      content,
      preview,
      category UNINDEXED,
      tags,
      source_app
    )
  `;

  yield* sql`
    INSERT INTO clips_fts (id, content, preview, category, tags, source_app)
    SELECT
      c.id,
      c.content,
      c.preview,
      c.category,
      COALESCE((
        SELECT group_concat(tags.value, ' ')
        FROM json_each(c.tags_json) tags
      ), ''),
      COALESCE(c.source_app, '')
    FROM projection_clips c
    WHERE c.deleted_at IS NULL
  `;
});
