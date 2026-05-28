-- WeightDriftAudit: Track basket weight policy drift and approval workflow
CREATE TABLE "weight_drift_audits" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "audit_period_start" timestamp(6) NOT NULL,
  "audit_period_end" timestamp(6) NOT NULL,
  "total_currencies" integer NOT NULL,
  "currencies_exceeding_threshold" integer NOT NULL,
  "max_drift_percent" decimal(10, 4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "diff_report" jsonb NOT NULL,
  "created_by" uuid,
  "approved_by" uuid,
  "approval_notes" text,
  "created_at" timestamp(6) NOT NULL DEFAULT now(),
  "approved_at" timestamp(6),
  PRIMARY KEY ("id")
);

-- Index for querying recent audits and filtering by status
CREATE INDEX "idx_weight_drift_audits_status" ON "weight_drift_audits"("status");
CREATE INDEX "idx_weight_drift_audits_created_at" ON "weight_drift_audits"("created_at" DESC);
CREATE INDEX "idx_weight_drift_audits_status_created" ON "weight_drift_audits"("status", "created_at" DESC);
CREATE INDEX "idx_weight_drift_audits_period" ON "weight_drift_audits"("audit_period_start", "audit_period_end");

-- WeightDriftCurrency: Per-currency drift snapshot for each audit
CREATE TABLE "weight_drift_currencies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "audit_id" uuid NOT NULL,
  "currency" varchar(3) NOT NULL,
  "policy_weight" decimal(5, 2) NOT NULL,
  "actual_weight" decimal(5, 2) NOT NULL,
  "drift_percent" decimal(10, 4) NOT NULL,
  "exceeds_threshold" boolean NOT NULL DEFAULT false,
  "recommendation" text,
  "created_at" timestamp(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_weight_drift_currencies_audit" FOREIGN KEY ("audit_id") REFERENCES "weight_drift_audits"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_weight_drift_currencies_audit_id" ON "weight_drift_currencies"("audit_id");
CREATE INDEX "idx_weight_drift_currencies_currency" ON "weight_drift_currencies"("currency");
CREATE INDEX "idx_weight_drift_currencies_exceeds" ON "weight_drift_currencies"("exceeds_threshold");
