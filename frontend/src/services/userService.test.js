import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import api from "./api";
import { getUserProfile, updateUserProfile } from "./userService";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current user profile from the authenticated endpoint", async () => {
    const profile = { id: "user-1", email: "reader@example.com" };
    api.get.mockResolvedValue({ data: profile });

    await expect(getUserProfile()).resolves.toEqual(profile);
    expect(api.get).toHaveBeenCalledWith("/api/users/me");
  });

  it("updates only the display name and returns the response profile", async () => {
    const profile = { id: "user-1", display_name: "New Name" };
    api.put.mockResolvedValue({ data: profile });

    await expect(
      updateUserProfile({ display_name: "New Name" }),
    ).resolves.toEqual(profile);
    expect(api.put).toHaveBeenCalledWith("/api/users/me", {
      display_name: "New Name",
    });
  });
});
