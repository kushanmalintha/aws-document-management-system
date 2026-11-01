import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityService = vi.hoisted(() => ({
  getActivities: vi.fn(),
}));

vi.mock("../services/activityService", () => activityService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import ActivityPage from "./ActivityPage";
import { getActivities } from "../services/activityService";

const activity = {
  id: "activity-1",
  user_id: "user-1",
  document_id: "document-1",
  action: "DOCUMENT_VERSION_UPLOADED",
  metadata_json: {
    name: "annual-report.pdf",
    version_number: 4,
    size_bytes: 2048,
  },
  created_at: "2025-01-11T12:00:00Z",
};

describe("ActivityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActivities.mockResolvedValue([activity]);
  });

  it("renders activity action, available metadata, and timestamp", async () => {
    render(<ActivityPage />);

    expect(
      await screen.findByRole("heading", { name: "Document Version Uploaded" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/annual-report\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Version 4/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute(
      "dateTime",
      activity.created_at,
    );
    expect(getActivities).toHaveBeenCalledWith({ limit: 51, offset: 0 });
  });

  it("shows an empty state when the user has no activity", async () => {
    getActivities.mockResolvedValue([]);
    render(<ActivityPage />);

    expect(await screen.findByRole("heading", { name: "No activity yet" }))
      .toBeInTheDocument();
  });

  it("paginates through activity using the backend limit and offset", async () => {
    const firstPage = Array.from({ length: 51 }, (_, index) => ({
      ...activity,
      id: `activity-${index}`,
      action: `ACTION_${index}`,
    }));
    getActivities
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ ...activity, action: "PAGE_TWO_EVENT" }])
      .mockResolvedValueOnce(firstPage);
    render(<ActivityPage />);

    expect(await screen.findByRole("heading", { name: "Action 0" }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    expect(screen.queryByRole("heading", { name: "Action 50" }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Page Two Event" }))
      .toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(getActivities).toHaveBeenNthCalledWith(2, { limit: 51, offset: 50 });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByRole("heading", { name: "Action 0" }))
      .toBeInTheDocument();
    await waitFor(() => {
      expect(getActivities).toHaveBeenNthCalledWith(3, { limit: 51, offset: 0 });
    });
  });

  it("shows an API error and retries the activity request", async () => {
    getActivities
      .mockRejectedValueOnce(new Error("Unable to load activity."))
      .mockResolvedValueOnce([activity]);
    render(<ActivityPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load activity.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Document Version Uploaded" }),
    ).toBeInTheDocument();
    expect(getActivities).toHaveBeenCalledTimes(2);
  });
});
