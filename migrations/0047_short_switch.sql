ALTER TABLE "coordination_v2_transport_work_claims"
  ADD CONSTRAINT "uq_coordination_v2_transport_work_claim_provenance"
  UNIQUE USING INDEX "uq_coordination_v2_transport_work_claim_provenance";