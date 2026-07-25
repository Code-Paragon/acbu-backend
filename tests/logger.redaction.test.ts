import { redactLogValue, redactFormat } from "../src/config/logger";
import winston from "winston";
import { Writable } from "stream";

describe("redactLogValue", () => {
  it("redacts sensitive keys such as passcode", () => {
    expect(redactLogValue({ passcode: "1234", userId: "u-1" })).toEqual({
      passcode: "[REDACTED]",
      userId: "u-1",
    });
  });

  it("redacts nested sensitive keys and card-like numbers", () => {
    expect(
      redactLogValue({
        error: "failed",
        meta: {
          authorization: "Bearer abc",
          note: "card 4111111111111111 charged",
        },
      }),
    ).toEqual({
      error: "failed",
      meta: {
        authorization: "[REDACTED]",
        note: "card [REDACTED] charged",
      },
    });
  });

  it("does not mutate the original object", () => {
    const original = { passcode: "secret", nested: { token: "abc" } };
    redactLogValue(original);
    expect(original).toEqual({ passcode: "secret", nested: { token: "abc" } });
  });

  it("handles circular references", () => {
    const circular: Record<string, unknown> = { ok: true };
    circular.self = circular;
    expect(redactLogValue(circular)).toEqual({
      ok: true,
      self: "[Circular]",
    });
  });
});

describe("redactFormat (winston)", () => {
  it("redacts meta on logger.debug before transport write", (done) => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    const testLogger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(redactFormat(), winston.format.json()),
      transports: [new winston.transports.Stream({ stream })],
    });

    testLogger.debug("failed", { passcode: "my-secret", amount: 10 });

    setImmediate(() => {
      expect(chunks).toHaveLength(1);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed.message).toBe("failed");
      expect(parsed.passcode).toBe("[REDACTED]");
      expect(parsed.amount).toBe(10);
      expect(chunks[0]).not.toContain("my-secret");
      done();
    });
  });
});
