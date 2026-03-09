import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`ALTER TABLE projection_clips ADD COLUMN image_asset_id TEXT`;
  yield* sql`ALTER TABLE projection_clips ADD COLUMN image_asset_path TEXT`;
  yield* sql`ALTER TABLE projection_clips ADD COLUMN image_width INTEGER`;
  yield* sql`ALTER TABLE projection_clips ADD COLUMN image_height INTEGER`;
  yield* sql`ALTER TABLE projection_clips ADD COLUMN image_mime_type TEXT`;
  yield* sql`ALTER TABLE projection_clips ADD COLUMN ocr_text TEXT`;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_image_asset_id
    ON projection_clips(image_asset_id)
  `;

  // Rebuild the FTS table so OCR text becomes searchable.
  yield* sql`DROP TABLE IF EXISTS clips_fts`;

  yield* sql`
    CREATE VIRTUAL TABLE clips_fts USING fts5(
      id UNINDEXED,
      content,
      preview,
      category UNINDEXED,
      tags,
      source_app,
      ocr_text
    )
  `;

  yield* sql`
    INSERT INTO clips_fts (id, content, preview, category, tags, source_app, ocr_text)
    SELECT
      c.id,
      c.content,
      c.preview,
      c.category,
      COALESCE((
        SELECT group_concat(tags.value, ' ')
        FROM json_each(c.tags_json) tags
      ), ''),
      COALESCE(c.source_app, ''),
      COALESCE(c.ocr_text, '')
    FROM projection_clips c
    WHERE c.deleted_at IS NULL
  `;
});
