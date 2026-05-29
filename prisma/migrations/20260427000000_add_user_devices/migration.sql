CREATE TABLE "user_devices" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "user_agent" VARCHAR(512),
  "last_ip" VARCHAR(45),
  "is_trusted" BOOLEAN NOT NULL DEFAULT false,
  "verification_attempts" INTEGER NOT NULL DEFAULT 0,
  "trusted_at" TIMESTAMP(6),
  "last_seen_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_devices_user_id_fingerprint_key"
  ON "user_devices"("user_id", "fingerprint");

CREATE INDEX "idx_user_devices_user_id"
  ON "user_devices"("user_id");

CREATE INDEX "idx_user_devices_fingerprint"
  ON "user_devices"("fingerprint");

CREATE INDEX "idx_user_devices_last_seen_at"
  ON "user_devices"("last_seen_at");
