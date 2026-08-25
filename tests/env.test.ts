jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

describe("env validation", () => {
  const ORIGINAL = process.env;
  const REQUIRED_ENV = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    MONGODB_URI: "mongodb://localhost:27017/db",
    RABBITMQ_URL: "amqp://localhost:5672",
    JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    PRISMA_ACCELERATE_URL: "prisma://accelerate.prisma-data.net/?api_key=test",
    CORS_ORIGIN: "https://app.acbu.io",
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL, ...REQUIRED_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL;
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => require("../src/config/env")).toThrow(/JWT_SECRET/);
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => require("../src/config/env")).toThrow(/DATABASE_URL/);
  });

  it("throws when MONGODB_URI is missing", () => {
    delete process.env.MONGODB_URI;
    expect(() => require("../src/config/env")).toThrow(/MONGODB_URI/);
  });

  it("loads successfully with all required vars set", () => {
    const { config } = require("../src/config/env");
    expect(config.redis.url).toBeUndefined();
    expect(config.s3.bucket).toBeUndefined();
  });

  it("coerces PORT to a number", () => {
    process.env.PORT = "3000";
    const { config } = require("../src/config/env");
    expect(typeof config.port).toBe("number");
    expect(config.port).toBe(3000);
  });

  it("accepts valid LOG_LEVEL values", () => {
    process.env.LOG_LEVEL = "debug";
    const { config } = require("../src/config/env");
    expect(config.logLevel).toBe("debug");
  });

  it("coerces rate-limit fallback config values from env strings", () => {
    process.env.RATE_LIMIT_FALLBACK_MAX_REQUESTS = "42";
    process.env.RATE_LIMIT_CIRCUIT_BREAKER_THRESHOLD = "7";
    process.env.RATE_LIMIT_CIRCUIT_BREAKER_COOLDOWN_MS = "90000";

    const { config } = require("../src/config/env");

    expect(config.rateLimitFallbackMaxRequests).toBe(42);
    expect(config.rateLimitCircuitBreakerThreshold).toBe(7);
    expect(config.rateLimitCircuitBreakerCooldownMs).toBe(90000);
  });

  it("throws when LOG_LEVEL is invalid", () => {
    process.env.LOG_LEVEL = "invalid_level";
    expect(() => require("../src/config/env")).toThrow(/LOG_LEVEL/);
  });

  it("throws when CORS_ORIGIN contains wildcard", () => {
    process.env.CORS_ORIGIN = "*";
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../src/config/env");
    }).toThrow(/wildcard/i);
  });

  it("throws in production when S3_SCAN_WEBHOOK_SECRET is the placeholder", () => {
    process.env = {
      ...ORIGINAL,
      ...REQUIRED_ENV,
      NODE_ENV: "production",
      CHALLENGE_TOKEN_SECRET: "distinct-challenge-token-secret-32-chars",
      USDC_ISSUER_TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      USDC_ISSUER_MAINNET: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      S3_SCAN_WEBHOOK_SECRET: "change-me-in-production",
    };

    expect(() => require("../src/config/env")).toThrow(/S3_SCAN_WEBHOOK_SECRET/);
  });

  it("loads in production when S3_SCAN_WEBHOOK_SECRET is configured", () => {
    process.env = {
      ...ORIGINAL,
      ...REQUIRED_ENV,
      NODE_ENV: "production",
      S3_SCAN_WEBHOOK_SECRET: "super-secret-value",
      USDC_ISSUER_TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      USDC_ISSUER_MAINNET: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      CHALLENGE_TOKEN_SECRET: "distinct-challenge-token-secret-32-chars",
      FLUTTERWAVE_SECRET_KEY: "FLWSECK-real-production-key-12345",
      FLUTTERWAVE_WEBHOOK_SECRET: "flw-webhook-secret-real-12345",
      PAYSTACK_SECRET_KEY: "pstk_valid_production_secret_key_12345",
      BILLS_WEBHOOK_SECRET: "bills-secret-real-12345",
      MTN_MOMO_SUBSCRIPTION_KEY: "momo-sub-key-real-12345",
      MTN_MOMO_API_USER_ID: "momo-user-id-real-12345",
      MTN_MOMO_API_KEY: "momo-api-key-real-12345",
    };

    expect(() => require("../src/config/env")).not.toThrow();
  });

  it("throws in production when required fintech key is missing or a placeholder", () => {
    process.env = {
      ...ORIGINAL,
      ...REQUIRED_ENV,
      NODE_ENV: "production",
      S3_SCAN_WEBHOOK_SECRET: "super-secret-value",
      USDC_ISSUER_TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      USDC_ISSUER_MAINNET: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      CHALLENGE_TOKEN_SECRET: "distinct-challenge-token-secret-32-chars",
      FLUTTERWAVE_SECRET_KEY: "flutterwave secret key", // placeholder
      FLUTTERWAVE_WEBHOOK_SECRET: "flw-webhook-secret-real-12345",
      PAYSTACK_SECRET_KEY: "pstk_valid_production_secret_key_12345",
      BILLS_WEBHOOK_SECRET: "bills-secret-real-12345",
      MTN_MOMO_SUBSCRIPTION_KEY: "momo-sub-key-real-12345",
      MTN_MOMO_API_USER_ID: "momo-user-id-real-12345",
      MTN_MOMO_API_KEY: "momo-api-key-real-12345",
    };

    expect(() => require("../src/config/env")).toThrow(/FLUTTERWAVE_SECRET_KEY/);
  });

  it("throws in production when CHALLENGE_TOKEN_SECRET equals JWT_SECRET", () => {
    process.env = {
      ...ORIGINAL,
      ...REQUIRED_ENV,
      NODE_ENV: "production",
      S3_SCAN_WEBHOOK_SECRET: "super-secret-value",
      USDC_ISSUER_TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      USDC_ISSUER_MAINNET: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      CHALLENGE_TOKEN_SECRET: REQUIRED_ENV.JWT_SECRET,
    };

    expect(() => require("../src/config/env")).toThrow(
      /CHALLENGE_TOKEN_SECRET must be distinct from JWT_SECRET/,
    );
  });

  describe("zod schema validation for optional and typed env vars", () => {
    it("throws when NOTIFICATION_EMAIL_PROVIDER is invalid", () => {
      process.env.NOTIFICATION_EMAIL_PROVIDER = "unsupported_provider";
      expect(() => require("../src/config/env")).toThrow(/NOTIFICATION_EMAIL_PROVIDER/);
    });

    it("throws when NOTIFICATION_SMS_PROVIDER is invalid", () => {
      process.env.NOTIFICATION_SMS_PROVIDER = "unsupported_sms";
      expect(() => require("../src/config/env")).toThrow(/NOTIFICATION_SMS_PROVIDER/);
    });

    it("throws when MTN_MOMO_TARGET_ENVIRONMENT is invalid", () => {
      process.env.MTN_MOMO_TARGET_ENVIRONMENT = "staging";
      expect(() => require("../src/config/env")).toThrow(/MTN_MOMO_TARGET_ENVIRONMENT/);
    });

    it("throws when WALLET_ACTIVATION_STRATEGY is invalid", () => {
      process.env.WALLET_ACTIVATION_STRATEGY = "invalid_strategy";
      expect(() => require("../src/config/env")).toThrow(/WALLET_ACTIVATION_STRATEGY/);
    });

    it("throws when PG_WAL_BACKUP_CONFIGURED is invalid boolean string", () => {
      process.env.PG_WAL_BACKUP_CONFIGURED = "not_a_boolean";
      expect(() => require("../src/config/env")).toThrow(/PG_WAL_BACKUP_CONFIGURED/);
    });

    it("throws when SMTP_PORT is not a positive integer", () => {
      process.env.SMTP_PORT = "-5";
      expect(() => require("../src/config/env")).toThrow(/SMTP_PORT/);
    });

    it("throws when BULK_TRANSFER_CHUNK_SIZE is not a positive integer", () => {
      process.env.BULK_TRANSFER_CHUNK_SIZE = "0";
      expect(() => require("../src/config/env")).toThrow(/BULK_TRANSFER_CHUNK_SIZE/);
    });

    it("correctly parses and coerces optional env vars into config object", () => {
      process.env.BULK_TRANSFER_CHUNK_SIZE = "250";
      process.env.BULK_TRANSFER_MAX_FILE_SIZE_BYTES = "20971520";
      process.env.S3_UPLOAD_URL_TTL_SECONDS = "1800";
      process.env.S3_DOWNLOAD_URL_TTL_SECONDS = "600";
      process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_TEST-123456";
      process.env.REDIS_MAX_RETRIES_PER_REQUEST = "5";
      process.env.NOTIFICATION_EMAIL_PROVIDER = "sendgrid";
      process.env.SMTP_PORT = "465";
      process.env.ORACLE_UPDATE_INTERVAL_HOURS = "12";
      process.env.RESERVE_DRIFT_THRESHOLD_PCT = "2.5";

      const { config } = require("../src/config/env");

      expect(config.bulkTransfer.chunkSize).toBe(250);
      expect(config.bulkTransfer.maxFileSizeBytes).toBe(20971520);
      expect(config.s3.uploadUrlTtlSeconds).toBe(1800);
      expect(config.s3.downloadUrlTtlSeconds).toBe(600);
      expect(config.flutterwave.publicKey).toBe("FLWPUBK_TEST-123456");
      expect(config.redis.maxRetriesPerRequest).toBe(5);
      expect(config.notification.emailProvider).toBe("sendgrid");
      expect(config.notification.smtp.port).toBe(465);
      expect(config.oracle.updateIntervalHours).toBe(12);
      expect(config.reserve.driftThresholdPct).toBe(2.5);
    });
  });
});
