import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dashboardService = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

vi.mock("../services/dashboardService", () => dashboardService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import { getDashboardData } from "../services/dashboardService";
import DashboardPage from "./DashboardPage";

const dashboard = {
  documents: [
    {
      id: "older-document",
      name: "older-report.pdf",
      content_type: "application/pdf",
      size_bytes: 1024,
      created_at: "2025-01-01T12:00:00Z",
    },
    {
      id: "newer-document",
      name: "newer-report.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      created_at: "2025-02-01T12:00:00Z",
    },
  ],
  folders: [{ id: "folder-1", name: "Reports" }],
  activities: [
    {
      id: "older-activity",
      action: "DOCUMENT_DELETED",
      metadata_json: { folder_name: "Archive" },
      created_at: "2025-01-30T12:00:00Z",
    },
    {
      id: "activity-1",
      action: "DOCUMENT_UPLOADED",
      metadata_json: { document_name: "newer-report.pdf" },
      created_at: "2025-02-02T12:00:00Z",
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardData.mockResolvedValue(dashboard);
  });

  it("shows workspace counts and sorts recent documents and activity newest first", async () => {
    renderDashboard();

    expect(await screen.findByText("Documents in your workspace"))
      .toBeInTheDocument();
    const stats = screen.getAllByRole("article");
    expect(within(stats[0]).getByText("Documents")).toBeInTheDocument();
    expect(within(stats[0]).getByText("2")).toBeInTheDocument();
    expect(within(stats[1]).getByText("1")).toBeInTheDocument();
    expect(within(stats[2]).getByText("2")).toBeInTheDocument();

    const documentRows = screen.getAllByRole("row").slice(1);
    expect(within(documentRows[0]).getByText("newer-report.pdf"))
      .toBeInTheDocument();
    expect(within(documentRows[1]).getByText("older-report.pdf"))
      .toBeInTheDocument();
    expect(
      screen.getByText("Document Uploaded", {
        selector: ".dashboard-activity-title",
      }),
    ).toBeInTheDocument();
    const activityItems = screen.getAllByRole("listitem");
    expect(within(activityItems[0]).getByText("Document Uploaded"))
      .toBeInTheDocument();
    expect(within(activityItems[1]).getByText("Document Deleted"))
      .toBeInTheDocument();
    expect(screen.getByText("newer-report.pdf", { selector: ".dashboard-activity-description" }))
      .toBeInTheDocument();
    expect(getDashboardData).toHaveBeenCalledOnce();
  });

  it("shows empty states for a workspace without documents or activity", async () => {
    getDashboardData.mockResolvedValue({ documents: [], folders: [], activities: [] });
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "No documents yet" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No activity yet" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to documents" }))
      .toHaveAttribute("href", "/documents");
  });

  it("shows a recoverable load error and retries dashboard data", async () => {
    getDashboardData
      .mockRejectedValueOnce(new Error("Dashboard request failed."))
      .mockResolvedValueOnce(dashboard);
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dashboard request failed.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    const documentTable = await screen.findByRole("table");
    expect(within(documentTable).getByText("newer-report.pdf"))
      .toBeInTheDocument();
    await waitFor(() => expect(getDashboardData).toHaveBeenCalledTimes(2));
  });
});
