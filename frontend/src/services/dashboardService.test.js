import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "./api";
import { getDashboardData } from "./dashboardService";

describe("dashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and normalizes document, folder, and activity responses", async () => {
    const documents = [{ id: "document-1" }];
    const folders = [{ id: "folder-1" }];
    const activities = [{ id: "activity-1" }];
    api.get
      .mockResolvedValueOnce({ data: { documents } })
      .mockResolvedValueOnce({ data: { items: folders } })
      .mockResolvedValueOnce({ data: activities });

    await expect(getDashboardData()).resolves.toEqual({
      documents,
      folders,
      activities,
    });
    expect(api.get).toHaveBeenNthCalledWith(1, "/api/documents");
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/folders");
    expect(api.get).toHaveBeenNthCalledWith(3, "/api/activities", {
      params: { limit: 5 },
    });
  });

  it("returns empty lists for empty collection responses", async () => {
    api.get
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { activities: [] } });

    await expect(getDashboardData()).resolves.toEqual({
      documents: [],
      folders: [],
      activities: [],
    });
  });

  it("propagates request failures to the dashboard page", async () => {
    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("Folder request failed."))
      .mockResolvedValueOnce({ data: [] });

    await expect(getDashboardData()).rejects.toThrow("Folder request failed.");
  });
});
