-- B-074: prevent replay submissions with the same blockchain tx hash for burn transactions.
-- Deduplicate pre-existing rows before enforcing the constraint.
-- For each (type, blockchain_tx_hash) pair with duplicates, keep the oldest and delete newer rows.
DELETE FROM "transactions" t
WHERE id NOT IN (
  SELECT MIN(id) FROM "transactions"
  WHERE "type" IS NOT NULL AND "blockchain_tx_hash" IS NOT NULL
  GROUP BY "type", "blockchain_tx_hash"
);

-- Postgres UNIQUE allows multiple NULLs, so this enforces uniqueness only when present.
CREATE UNIQUE INDEX "uq_transactions_type_blockchain_tx_hash"
ON "transactions" ("type", "blockchain_tx_hash");
