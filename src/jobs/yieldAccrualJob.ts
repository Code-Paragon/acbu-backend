import { logger } from "../config/logger";
import { accrueFromStrategies } from "../services/investment";

/**
 * Start yield accrual scheduler.
 * - Runs once at startup to ensure seeded data has accruals recorded.
 * - Schedules a daily run to pro-rate accruals (can be adjusted later).
 */
export async function startYieldAccrualScheduler(): Promise<void> {
  try {
    logger.info("Running initial yield accrual pass");
    // Run one-day accrual to seed yields (good for seeded/test data)
    await accrueFromStrategies(1, new Date());
    logger.info("Initial yield accrual completed");
  } catch (err) {
    logger.error("Initial yield accrual failed", err);
  }

  // Daily schedule: pro-rate accrual by 1 day. Real production should run monthly or
  // support configurable windows; this is intentionally conservative for now.
  try {
    setInterval(async () => {
      try {
        await accrueFromStrategies(1, new Date());
      } catch (e) {
        logger.error("Scheduled yield accrual failed", e);
      }
    }, 24 * 60 * 60 * 1000); // every 24h
    logger.info("Yield accrual scheduler started (daily)");
  } catch (err) {
    logger.error("Failed to start yield accrual scheduler", err);
  }
}
