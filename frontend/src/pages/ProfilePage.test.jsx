import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userService = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("../services/userService", () => userService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import ProfilePage from "./ProfilePage";
import { AuthContext } from "../context/authContext";
import { getUserProfile, updateUserProfile } from "../services/userService";

const profile = {
  id: "123e4567-e89b-12d3-a456-426614174020",
  email: "reader@example.com",
  display_name: "Test Reader",
  role: "USER",
  is_active: true,
  created_at: "2025-01-10T12:00:00Z",
  updated_at: "2025-01-11T12:00:00Z",
};

function renderProfile(updateUser = vi.fn()) {
  return {
    updateUser,
    ...render(
      <AuthContext.Provider value={{ updateUser }}>
        <ProfilePage />
      </AuthContext.Provider>,
    ),
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserProfile.mockResolvedValue(profile);
    updateUserProfile.mockResolvedValue({
      ...profile,
      display_name: "Updated Reader",
    });
  });

  it("loads profile fields and syncs the current user context", async () => {
    const updateUser = vi.fn();
    renderProfile(updateUser);

    expect(await screen.findByLabelText("Display name")).toHaveValue(
      "Test Reader",
    );
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "reader@example.com",
    );
    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
    expect(screen.getByText(profile.id)).toBeInTheDocument();
    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith(profile);
  });

  it("saves a trimmed display name and updates shared user state", async () => {
    const updatedProfile = { ...profile, display_name: "Updated Reader" };
    updateUserProfile.mockResolvedValue(updatedProfile);
    const updateUser = vi.fn();
    renderProfile(updateUser);

    fireEvent.change(await screen.findByLabelText("Display name"), {
      target: { value: "  Updated Reader  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateUserProfile).toHaveBeenCalledWith({
      display_name: "Updated Reader",
    });
    expect(await screen.findByText("Profile updated successfully."))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Updated Reader");
    expect(updateUser).toHaveBeenLastCalledWith(updatedProfile);
  });

  it("rejects an empty display name before calling the update endpoint", async () => {
    const { container } = renderProfile();
    await screen.findByLabelText("Display name");

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "   " },
    });
    fireEvent.submit(container.querySelector("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Display name cannot be empty.",
    );
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("shows a profile load error and retries the request", async () => {
    getUserProfile
      .mockRejectedValueOnce(new Error("Unable to load profile."))
      .mockResolvedValueOnce(profile);
    const updateUser = vi.fn();
    renderProfile(updateUser);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load profile.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Display name")).toHaveValue(
      "Test Reader",
    );
    expect(getUserProfile).toHaveBeenCalledTimes(2);
    expect(updateUser).toHaveBeenCalledWith(profile);
  });

  it("shows update errors without changing shared user state", async () => {
    updateUserProfile.mockRejectedValue(new Error("Profile update failed."));
    const updateUser = vi.fn();
    renderProfile(updateUser);
    await screen.findByLabelText("Display name");
    updateUser.mockClear();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Another Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Profile update failed.",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});
