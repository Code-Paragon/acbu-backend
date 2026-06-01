/*
  Warnings:
  - A unique constraint covering the columns `[currency,segment,timestamp]` on the table `reserves` was already defined; the primary key is now being synced
  - Added the required index for query optimization on reserves table
*/

-- Optimize existing reserves index for the most common query pattern:
-- SELECT DISTINCT BY (currency, segment) ORDER BY timestamp DESC
-- This is used in getEnterpriseTreasury() for fetching latest reserves

-- The unique constraint already exists and serves dual purpose:
-- 1. Prevents duplicate snapshots for same currency+segment+timestamp
-- 2. Supports efficient DISTINCT queries on currency and segment

-- Add covering index for oracle_rate lookups used in FX fallback logic
CREATE INDEX IF NOT EXISTS idx_oracle_rates_currency_timestamp_desc 
ON oracle_rates(currency, timestamp DESC);

-- Optimize transaction aggregation queries
CREATE INDEX IF NOT EXISTS idx_transactions_type_currency 
ON transactions(type, local_currency, status);

-- Optimize reserve health checks
CREATE INDEX IF NOT EXISTS idx_reserves_segment_timestamp 
ON reserves(segment, timestamp DESC);

-- ANALYSIS:
-- Current indexes already support primary query patterns:
-- 1. reserves.idx_reserves_currency_segment_timestamp(sort: Desc) - optimal for DISTINCT + ORDER BY
-- 2. oracle_rates.idx_oracle_rates_currency + idx_oracle_rates_timestamp
-- 3. transactions.idx_transactions_user_type already covers core lookups

-- New indexes improve:
-- 1. idx_oracle_rates_currency_timestamp_desc - FX fallback queries (7-day lookback)
-- 2. idx_transactions_type_currency - transaction aggregation by currency
-- 3. idx_reserves_segment_timestamp - reserve health by segment

-- Query Performance Targets (after indexes):
-- - getLatestReservesBySegment(): ~50ms for 10 currencies
-- - getFxRateWithFallback(): ~10ms per currency
-- - aggregateTransactionsBySegment(): ~100ms for 1M transactions
-- - Full getEnterpriseTreasury(): ~500ms for 10 currencies, 1M transactions
