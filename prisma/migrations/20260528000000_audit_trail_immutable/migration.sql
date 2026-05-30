-- #287: Make audit_trail table immutable at the DB level.
-- Adds triggers that raise an exception on any UPDATE or DELETE attempt,
-- regardless of whether the operation originates from the application or
-- direct database access.

CREATE OR REPLACE FUNCTION audit_trail_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_trail rows are immutable: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_trail_no_update
  BEFORE UPDATE ON audit_trail
  FOR EACH ROW EXECUTE FUNCTION audit_trail_immutable();

CREATE TRIGGER trg_audit_trail_no_delete
  BEFORE DELETE ON audit_trail
  FOR EACH ROW EXECUTE FUNCTION audit_trail_immutable();
