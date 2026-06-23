/**
 * #388: Prometheus-compatible metrics for Prisma connection pool.
 *
 * Instruments Prisma middleware to track:
 *  - prisma_pool_wait_seconds   – time spent waiting to acquire a connection (histogram)
 *  - prisma_pool_acquire_seconds – total time from request to first query byte (histogram)
 *  - prisma_pool_exhausted_total – P2024 (pool timeout) error counter
 *
 * Also collects default Node.js process metrics (event loop, memory, CPU).
 */
import { Registry, Histogram, Counter, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const poolWaitHistogram = new Histogram({
  name: "prisma_pool_wait_seconds",
  help: "Time in seconds a query spent waiting for a connection from the pool",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const poolAcquireHistogram = new Histogram({
  name: "prisma_pool_acquire_seconds",
  help: "Total time in seconds from query start to first result (includes pool wait + query)",
  labelNames: ["model", "action"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const poolExhaustedCounter = new Counter({
  name: "prisma_pool_exhausted_total",
  help: "Total number of P2024 connection pool timeout errors",
  registers: [registry],
});
