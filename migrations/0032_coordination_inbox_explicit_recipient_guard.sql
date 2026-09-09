CREATE OR REPLACE FUNCTION enforce_coordination_inbox_explicit_recipient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recipient_actor IS NOT NULL
     AND NEW.recipient_actor <> NEW.actor
     AND NEW.recipient_actor <> 'coordination-system'
     AND NEW.event_type IN ('created', 'comment', 'reassigned', 'reopened')
     AND NOT EXISTS (
       SELECT 1
       FROM coordination_inbox_items item
       WHERE item.coordination_event_id = NEW.id
         AND item.recipient_actor = NEW.recipient_actor
         AND item.recipient_rule_version = 1
     )
  THEN
    RAISE EXCEPTION
      'explicit coordination recipient % for event % has no materialized inbox item',
      NEW.recipient_actor,
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER coordination_events_explicit_recipient_inbox_guard
AFTER INSERT OR UPDATE OF recipient_actor, event_type, actor
ON coordination_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_coordination_inbox_explicit_recipient();