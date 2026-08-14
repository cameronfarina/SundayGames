export const artifactByIdSql = `
SELECT e.*, c.content_base64
FROM draft_room_exports e
JOIN draft_room_export_contents c ON c.artifact_id = e.id
WHERE e.id = $1
LIMIT 1
`.trim();

export const artifactByRoomRevisionSql = `
SELECT e.*, c.content_base64
FROM draft_room_exports e
JOIN draft_room_export_contents c ON c.artifact_id = e.id
WHERE e.draft_room_id = $1
  AND e.source_revision = $2
  AND e.artifact_type = $3
  AND e.status = 'completed'
LIMIT 1
`.trim();

export const artifactsByRoomSql = `
SELECT *
FROM draft_room_exports
WHERE draft_room_id = $1
  AND status = 'completed'
ORDER BY created_at DESC, source_revision DESC, id ASC
`.trim();

export const insertArtifactSql = `
INSERT INTO draft_room_exports (
  id, league_id, league_season_id, draft_room_id, created_by_user_id,
  artifact_type, status, storage_key, payload_hash, content_type,
  byte_length, source_revision, metadata_json, created_at, completed_at
) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
ON CONFLICT (id) DO NOTHING
RETURNING id
`.trim();

export const insertArtifactContentSql = `
INSERT INTO draft_room_export_contents (
  id, artifact_id, content_base64, created_at
) VALUES ($1, $2, $3, $4)
ON CONFLICT (artifact_id) DO NOTHING
`.trim();
