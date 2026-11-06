-- Audit logs are append-only. The only permitted UPDATE is the FK action that nulls
-- actor_user_id when a user is deleted (actor_label preserves who it was).
CREATE OR REPLACE FUNCTION audit_logs_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only (DELETE refused)';
  END IF;
  IF (to_jsonb(NEW) - 'actor_user_id') IS DISTINCT FROM (to_jsonb(OLD) - 'actor_user_id') THEN
    RAISE EXCEPTION 'audit_logs is append-only (UPDATE refused)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_guard();
