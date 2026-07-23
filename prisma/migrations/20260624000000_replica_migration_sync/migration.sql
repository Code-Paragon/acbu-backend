-- #383: Replica promotion safety – sync _prisma_migrations history to the promoted replica.
--
-- Problem: _prisma_migrations is a regular table on the primary. If a read replica is promoted
-- to primary after failover, it inherits all application data but NOT _prisma_migrations rows
-- that were written after the replica's last WAL position.  Running `prisma migrate deploy`
-- against the promoted replica may then re-apply already-applied migrations (if rows are missing)
-- or fail with a checksum mismatch (if rows are partially present).
--
-- Fix: provide a stored procedure that an operator calls immediately after promoting a replica.
-- The procedure upserts every row from the authoritative source (passed as input) so that
-- `prisma migrate deploy` sees a complete, consistent history and becomes a no-op.
--
-- Usage (run on the newly-promoted primary right after promotion):
--
--   SELECT sync_prisma_migrations_from_primary(ARRAY[
--     ROW('id-1', '20260129225314_init', 1706529194, 'hash...', NULL, 17486, 'Migration Author', false, NOW(), NULL)::_prisma_migration_row,
--     ...
--   ]);
--
-- In practice, export the rows from the old primary before failover and pipe them here, or
-- generate the call from the migration files on disk (which are the source of truth):
--
--   psql $OLD_PRIMARY -c "\COPY _prisma_migrations TO '/tmp/migrations.csv' CSV HEADER"
--   psql $NEW_PRIMARY -f <(scripts/ci/restore-migrations.sh /tmp/migrations.csv)
--
-- The simpler operational runbook (no procedure needed) is documented in scripts/ci/restore-migrations.sh.

-- Composite type matching _prisma_migrations columns so callers can pass rows strongly-typed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '_prisma_migration_row') THEN
    CREATE TYPE _prisma_migration_row AS (
      id               VARCHAR(36),
      checksum         VARCHAR(64),
      finished_at      TIMESTAMPTZ,
      migration_name   VARCHAR(255),
      logs             TEXT,
      rolled_back_at   TIMESTAMPTZ,
      started_at       TIMESTAMPTZ,
      applied_steps_count INTEGER
    );
  END IF;
END
$$;

-- sync_prisma_migrations_from_snapshot: upserts the canonical migration history into
-- _prisma_migrations on the current (promoted) primary.
-- Each row from the snapshot is inserted; existing rows with the same id are left untouched
-- (ON CONFLICT DO NOTHING) so the procedure is idempotent and safe to re-run.
CREATE OR REPLACE FUNCTION sync_prisma_migrations_from_snapshot(
  p_rows _prisma_migration_row[]
)
RETURNS TABLE(upserted INT, skipped INT)
LANGUAGE plpgsql
AS $$
DECLARE
  r       _prisma_migration_row;
  v_upserted INT := 0;
  v_skipped  INT := 0;
BEGIN
  FOREACH r IN ARRAY p_rows LOOP
    INSERT INTO "_prisma_migrations" (
      id, checksum, finished_at, migration_name,
      logs, rolled_back_at, started_at, applied_steps_count
    ) VALUES (
      r.id, r.checksum, r.finished_at, r.migration_name,
      r.logs, r.rolled_back_at, r.started_at, r.applied_steps_count
    )
    ON CONFLICT (id) DO NOTHING;

    IF FOUND THEN
      v_upserted := v_upserted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_upserted, v_skipped;
END;
$$;

COMMENT ON FUNCTION sync_prisma_migrations_from_snapshot IS
  '#383: Call this on a newly-promoted replica immediately after promotion to restore '
  'complete _prisma_migrations history. Source rows from the pre-failover primary export. '
  'Idempotent — safe to re-run; existing rows are skipped.';
