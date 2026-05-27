/**
 * Investment withdrawal job: at T+24h mark requests as 'available' and send "investment withdrawal ready" notification.
 */
import { prisma } from "../config/database";
import { logger } from "../config/logger";
import { publishInvestmentWithdrawalReady } from "../services/investment/withdrawalNotificationService";
import { getReadyInvestmentWithdrawalBatch } from "../services/investment/withdrawalTimingService";

export async function processInvestmentWithdrawalAvailability(): Promise<void> {
  const { trustedNow, records } = await getReadyInvestmentWithdrawalBatch();
  for (const r of records) {
    try {
      await prisma.investmentWithdrawalRequest.update({
        where: { id: r.id },
        data: { status: "available", notifiedAt: trustedNow },
      });
      const amountAcbu = r.amountAcbu.toNumber();
      if (r.userId || r.organizationId) {
        await publishInvestmentWithdrawalReady(
          r.userId,
          amountAcbu,
          r.organizationId,
          trustedNow,
        );
      }
      logger.info("Investment withdrawal marked available and notified", {
        requestId: r.id,
        userId: r.userId,
        organizationId: r.organizationId,
        amountAcbu,
      });
    } catch (e) {
      logger.error("Investment withdrawal job failed for request", {
        requestId: r.id,
        error: e,
      });
    }
  }
}

/**
 * Start scheduler: run every minute to process available investment withdrawals.
 */
export async function startInvestmentWithdrawalScheduler(): Promise<void> {
  const intervalMs = 60 * 1000;
  setInterval(() => {
    processInvestmentWithdrawalAvailability().catch((e) =>
      logger.error("Investment withdrawal job error", { error: e }),
    );
  }, intervalMs);
  logger.info("Investment withdrawal scheduler started", { intervalMs });
}
