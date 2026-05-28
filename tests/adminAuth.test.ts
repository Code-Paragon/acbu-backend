// Tests for requireAdminApiKey middleware (B-031)
import { Request, Response } from "express";

const mockConfig = { adminApiKey: undefined as string | undefined };

jest.mock("../src/config/env", () => ({ config: mockConfig }));
jest.mock("../src/config/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { requireAdminApiKey } from "../src/middleware/adminAuth";

function makeReq(adminKey?: string): Request {
  return { headers: adminKey ? { "x-admin-key": adminKey } : {} } as Request;
}

function makeNext() {
  return jest.fn();
}

describe("requireAdminApiKey", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 503 when ADMIN_API_KEY is not configured", () => {
    mockConfig.adminApiKey = undefined;
    const next = makeNext();
    requireAdminApiKey(makeReq("anything"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
  });

  it("returns 401 when no x-admin-key header is provided", () => {
    mockConfig.adminApiKey = "secret-key";
    const next = makeNext();
    requireAdminApiKey(makeReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("returns 401 when x-admin-key header is wrong", () => {
    mockConfig.adminApiKey = "secret-key";
    const next = makeNext();
    requireAdminApiKey(makeReq("wrong-key"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next() with no error when key matches", () => {
    mockConfig.adminApiKey = "secret-key";
    const next = makeNext();
    requireAdminApiKey(makeReq("secret-key"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
