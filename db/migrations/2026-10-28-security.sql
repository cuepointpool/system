-- Security hardening (2026-10-28). Idempotent: safe to re-run.
--
--   Run as postgres on prod (postgres can't read /home/cuepoint — copy to /tmp first):
--   sudo -u postgres psql -d cuepoint -f /tmp/2026-10-28-security.sql

-- 1. Revocable sign-ins: a session token carries the account's version;
--    bumping it (password change, "sign out all devices", 2FA on) ends
--    every older session.
ALTER TABLE player_profiles   ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;
ALTER TABLE business_partners ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;

-- 2. Two-step sign-in (authenticator app codes)
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS totp_secret    TEXT;    -- active secret (base32)
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS totp_pending   TEXT;    -- during setup
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;  -- replay guard

-- 3. Append-only audit trail: rows can be added and read, never changed or removed.
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_change();

DROP TRIGGER IF EXISTS acct_entry_log_append_only ON acct_entry_log;
CREATE TRIGGER acct_entry_log_append_only BEFORE UPDATE OR DELETE ON acct_entry_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
DROP TRIGGER IF EXISTS acct_entry_log_no_truncate ON acct_entry_log;
CREATE TRIGGER acct_entry_log_no_truncate BEFORE TRUNCATE ON acct_entry_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_change();

-- On prod the app connects as `cuepoint`, which owns its tables and so could
-- drop these triggers. Hand the two log tables to postgres and give the app
-- only INSERT + SELECT, so even a compromised app can't rewrite history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cuepoint') THEN
    ALTER TABLE audit_log      OWNER TO postgres;
    ALTER TABLE acct_entry_log OWNER TO postgres;
    REVOKE ALL ON audit_log, acct_entry_log FROM cuepoint;
    GRANT SELECT, INSERT ON audit_log, acct_entry_log TO cuepoint;
    GRANT USAGE, SELECT ON SEQUENCE acct_entry_log_id_seq TO cuepoint;
  END IF;
END $$;
