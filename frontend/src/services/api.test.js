import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

import api, { ACCESS_TOKEN_KEY } from "./api";

describe("API client authentication handling", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    window.localStorage.clear();
  });

  it("attaches the current access token to protected requests", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    let requestConfig;

    api.defaults.adapter = async (config) => {
      requestConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await api.get("/api/documents");
    expect(requestConfig.headers.Authorization).toBe("Bearer access-token");
  });

  it("clears the stored token and dispatches an unauthorized event for protected 401 responses", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "expired-token");
    const unauthorized = vi.fn();
    window.addEventListener("dms:unauthorized", unauthorized);

    api.defaults.adapter = async (config) => {
      const response = {
        data: { detail: "Not authenticated" },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      };
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, response);
    };

    await expect(api.get("/api/documents")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(unauthorized).toHaveBeenCalledOnce();
    window.removeEventListener("dms:unauthorized", unauthorized);
  });

  it("does not invalidate the session when login credentials are rejected", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "existing-token");
    const unauthorized = vi.fn();
    window.addEventListener("dms:unauthorized", unauthorized);

    api.defaults.adapter = async (config) => {
      const response = {
        data: { detail: "Invalid credentials" },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      };
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, response);
    };

    await expect(api.post("/api/auth/login", {})).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("existing-token");
    expect(unauthorized).not.toHaveBeenCalled();
    window.removeEventListener("dms:unauthorized", unauthorized);
  });
});
