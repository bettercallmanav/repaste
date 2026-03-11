import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`ALTER TABLE projection_clips ADD COLUMN ocr_status TEXT`;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_proj_clips_ocr_status
    ON projection_clips(ocr_status, content_type)
  `;

  // Backfill: image clips with OCR text already extracted are "ready"
  yield* sql`
    UPDATE projection_clips
    SET ocr_status = 'ready'
    WHERE content_type = 'image' AND ocr_text IS NOT NULL
  `;
});
