import bcrypt from "bcryptjs";
import { unlockApp, verifyRecoveryOtp } from "../src/services/recovery";
import { prisma } from "../src/config/database";
import { generateApiKey } from "../src/middleware/auth";
import { signChallengeToken, verifyChallengeToken } from "../src/utils/jwt";
import { getRabbitMQChannel } from "../src/config/rabbitmq";
import {
  checkRecoveryRateLimit,
  recordRecoveryAttempt,
} from "../src/services/recovery/rateLimitService";
import {
  verifyDevice,
  trustDevice,
  isDeviceRateLimited,
} from "../src/services/recovery/deviceVerification";
import {
  auditRecoveryEvent,
  detectSuspiciousPatterns,
  rotateUserSessions,
} from "../src/services/recovery/auditService";

jest.mock("../src/config/database", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    otpChallenge: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    recoveryAttempt: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("../src/middleware/auth", () => ({
  generateApiKey: jest.fn(),
}));

jest.mock("../src/utils/jwt", () => ({
  signChallengeToken: jest.fn(),
  verifyChallengeToken: jest.fn(),
}));

jest.mock("../src/config/rabbitmq", () => ({
  getRabbitMQChannel: jest.fn(),
  QUEUES: {
    OTP_SEND: "otp_send",
  },
}));

jest.mock("../src/config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/services/recovery/rateLimitService", () => ({
  checkRecoveryRateLimit: jest.fn(),
  recordRecoveryAttempt: jest.fn(),
}));

jest.mock("../src/services/recovery/deviceVerification", () => ({
  verifyDevice: jest.fn(),
  trustDevice: jest.fn(),
  isDeviceRateLimited: jest.fn(),
}));

jest.mock("../src/services/recovery/auditService", () => ({
  auditRecoveryEvent: jest.fn(),
  detectSuspiciousPatterns: jest.fn(),
  rotateUserSessions: jest.fn(),
}));

const mockPrismaUserFindFirst = prisma.user.findFirst as jest.Mock;
const mockPrismaOtpCreate = prisma.otpChallenge.create as jest.Mock;
const mockPrismaOtpFindFirst = prisma.otpChallenge.findFirst as jest.Mock;
const mockPrismaOtpUpdate = prisma.otpChallenge.update as jest.Mock;
const mockGenerateApiKey = generateApiKey as jest.Mock;
const mockSignChallengeToken = signChallengeToken as jest.Mock;
const mockVerifyChallengeToken = verifyChallengeToken as jest.Mock;
const mockGetRabbitMQChannel = getRabbitMQChannel as jest.Mock;
const mockCheckRecoveryRateLimit = checkRecoveryRateLimit as jest.Mock;
const mockRecordRecoveryAttempt = recordRecoveryAttempt as jest.Mock;
const mockVerifyDevice = verifyDevice as jest.Mock;
const mockTrustDevice = trustDevice as jest.Mock;
const mockIsDeviceRateLimited = isDeviceRateLimited as jest.Mock;
const mockAuditRecoveryEvent = auditRecoveryEvent as jest.Mock;
const mockDetectSuspiciousPatterns = detectSuspiciousPatterns as jest.Mock;
const mockRotateUserSessions = rotateUserSessions as jest.Mock;

describe("recoveryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRabbitMQChannel.mockReturnValue({
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn(),
    });
    mockCheckRecoveryRateLimit.mockResolvedValue({
      allowed: true,
      remainingAttempts: 5,
    });
    mockIsDeviceRateLimited.mockResolvedValue(false);
    mockVerifyDevice.mockResolvedValue({
      deviceId: "device-1",
      isTrusted: false,
      requiresVerification: false,
    });
    mockDetectSuspiciousPatterns.mockResolvedValue({
      isSuspicious: false,
      reasons: [],
    });
    mockRecordRecoveryAttempt.mockResolvedValue(undefined);
    mockAuditRecoveryEvent.mockResolvedValue(undefined);
    mockRotateUserSessions.mockResolvedValue(undefined);
    mockTrustDevice.mockResolvedValue(undefined);
  });

  describe("unlockApp", () => {
    it("returns challenge token after valid identifier + passcode", async () => {
      mockPrismaUserFindFirst.mockResolvedValue({
        id: "user-1",
        passcodeHash: await bcrypt.hash("1234", 10),
        email: "user@example.com",
        phoneE164: "+12345678901",
      });
      mockSignChallengeToken.mockReturnValue("challenge-token");

      const out = await unlockApp({
        identifier: "user@example.com",
        passcode: "1234",
        deviceFingerprint: { os: "Android", browser: "Chrome" } as any,
      });

      expect(out).toEqual({
        challenge_token: "challenge-token",
        channel: "email",
        requires_device_verification: false,
        device_id: "device-1",
        rate_limit_info: {
          remaining_attempts: 5,
        },
      });
      expect(mockPrismaOtpCreate).toHaveBeenCalledTimes(1);
      expect(mockSignChallengeToken).toHaveBeenCalledWith("user-1");
    });

    it("rejects invalid passcode", async () => {
      mockPrismaUserFindFirst.mockResolvedValue({
        id: "user-1",
        passcodeHash: await bcrypt.hash("1234", 10),
        email: "user@example.com",
        phoneE164: "+12345678901",
      });

      await expect(
        unlockApp({ identifier: "user@example.com", passcode: "9999", deviceFingerprint: { os: "Android", browser: "Chrome" } as any }),
      ).rejects.toThrow("Invalid passcode");
    });
  });

  describe("verifyRecoveryOtp", () => {
    it("issues API key on valid OTP", async () => {
      mockVerifyChallengeToken.mockReturnValue({ userId: "user-1" });
      mockPrismaOtpFindFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("111111", 10),
      });
      mockGenerateApiKey.mockResolvedValue("api-key-1");

      const out = await verifyRecoveryOtp({
        challenge_token: "challenge-token",
        code: "111111",
      });

      expect(out).toEqual({ api_key: "api-key-1", user_id: "user-1" });
      expect(mockPrismaOtpUpdate).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockGenerateApiKey).toHaveBeenCalledWith("user-1", []);
    });

    it("rejects invalid OTP", async () => {
      mockVerifyChallengeToken.mockReturnValue({ userId: "user-1" });
      mockPrismaOtpFindFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("111111", 10),
      });

      await expect(
        verifyRecoveryOtp({
          challenge_token: "challenge-token",
          code: "222222",
        }),
      ).rejects.toThrow("Invalid code");
    });
  });
});
