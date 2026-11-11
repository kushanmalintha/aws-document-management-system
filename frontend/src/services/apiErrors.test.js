import { describe, expect, it } from "vitest";

import { getApiErrorMessage, getApiRequestId } from "./api";

describe("API error response handling", () => {
  it("formats the standardized validation error response", () => {
    const error = {
      response: {
        status: 422,
        data: {
          detail: "Request validation failed",
          request_id: "request-123",
          errors: [
            {
              location: "body.email",
              message: "A valid email address is required",
              type: "value_error",
            },
          ],
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe(
      "Request validation failed: A valid email address is required (Reference ID: request-123)",
    );
    expect(getApiRequestId(error)).toBe("request-123");
  });

  it("keeps compatibility with legacy FastAPI validation details", () => {
    const error = {
      response: {
        status: 422,
        data: {
          detail: [{ msg: "Field required" }],
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe("Field required");
  });

  it("adds the request reference to server error messages", () => {
    const error = {
      response: {
        status: 503,
        data: {
          detail: "Database unavailable",
          request_id: "request-503",
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe(
      "Database unavailable (Reference ID: request-503)",
    );
  });

  it("reads a request ID from the response header when no body ID exists", () => {
    const error = {
      response: {
        status: 500,
        data: {},
        headers: { "x-request-id": "header-request-id" },
      },
    };

    expect(getApiRequestId(error)).toBe("header-request-id");
  });

  it("includes a reference ID for validation errors", () => {
    const error = {
      response: {
        status: 422,
        data: {
          detail: "Request validation failed",
          request_id: "validation-123",
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe("Request validation failed (Reference ID: validation-123)");
  });
});
