-- The composite UNIQUE constraint on (currency, timestamp) already creates a
-- B-tree index whose leftmost prefix covers currency-only lookups, making the
-- standalone idx_oracle_rates_currency index redundant. Dropping it removes
-- unnecessary write overhead on every INSERT/UPDATE to oracle_rates.
DROP INDEX IF EXISTS "idx_oracle_rates_currency";
