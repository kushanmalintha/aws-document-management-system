import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "./api";
import { getActivities } from "./activityService";

describe("activityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests activity using the supplied limit and offset", async () => {
    const activities = [{ id: "activity-1", action: "DOCUMENT_UPLOADED" }];
    api.get.mockResolvedValue({ data: activities });

    await expect(getActivities({ limit: 51, offset: 50 })).resolves.toEqual(
      activities,
    );
    expect(api.get).toHaveBeenCalledWith("/api/activities", {
      params: { limit: 51, offset: 50 },
    });
  });

  it("uses the default first-page parameters", async () => {
    api.get.mockResolvedValue({ data: [] });

    await expect(getActivities()).resolves.toEqual([]);
    expect(api.get).toHaveBeenCalledWith("/api/activities", {
      params: { limit: 51, offset: 0 },
    });
  });

  it("rejects an unexpected response shape", async () => {
    api.get.mockResolvedValue({ data: { activities: [] } });

    await expect(getActivities()).rejects.toThrow(
      "Activity history could not be loaded because the response format was unexpected.",
    );
  });
});
