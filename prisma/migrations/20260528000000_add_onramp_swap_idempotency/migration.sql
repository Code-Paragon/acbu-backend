-- Add idempotency_key column to on_ramp_swaps for retry-safe mint registration
ALTER TABLE "on_ramp_swaps" ADD COLUMN "idempotency_key" VARCHAR(255);
CREATE UNIQUE INDEX "idx_on_ramp_swaps_idempotency_key" ON "on_ramp_swaps"("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
