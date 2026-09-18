ALTER TABLE "coordination_v2_attempts"
  ADD CONSTRAINT "uq_coordination_v2_attempt_session_id"
  UNIQUE USING INDEX "uq_coordination_v2_attempt_session_id";--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations"
  ADD CONSTRAINT "uq_coordination_v2_cleanup_id_session"
  UNIQUE USING INDEX "uq_coordination_v2_cleanup_id_session";--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions"
  ADD CONSTRAINT "uq_coordination_v2_session_host_binding"
  UNIQUE USING INDEX "uq_coordination_v2_session_host_binding";--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases"
  ADD CONSTRAINT "uq_coordination_v2_lease_session_id"
  UNIQUE USING INDEX "uq_coordination_v2_lease_session_id";--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases"
  ADD CONSTRAINT "uq_coordination_v2_lease_id_epoch"
  UNIQUE USING INDEX "uq_coordination_v2_lease_id_epoch";--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases"
  ADD CONSTRAINT "uq_coordination_v2_lease_id_host"
  UNIQUE USING INDEX "uq_coordination_v2_lease_id_host";