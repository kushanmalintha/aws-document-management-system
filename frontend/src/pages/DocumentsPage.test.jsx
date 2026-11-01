import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const documentService = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
  getDocuments: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock("../services/documentService", () => documentService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import DocumentsPage from "./DocumentsPage";
import {
  deleteDocument,
  downloadDocument,
  getDocuments,
  uploadDocument,
} from "../services/documentService";

const documentFixture = {
  id: "document-1",
  name: "report.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  created_at: "2025-01-10T12:00:00Z",
  folder_id: null,
};

function renderDocumentsPage(props = {}) {
  return render(
    <MemoryRouter>
      <DocumentsPage {...props} />
    </MemoryRouter>,
  );
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  } else {
    delete URL.createObjectURL;
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    delete URL.revokeObjectURL;
  }
});

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocuments.mockResolvedValue([documentFixture]);
    uploadDocument.mockResolvedValue({ id: "uploaded-document" });
    deleteDocument.mockResolvedValue(undefined);
    downloadDocument.mockResolvedValue(new Blob(["file contents"]));
  });

  it("renders documents and links to their details", async () => {
    renderDocumentsPage();

    expect(
      await screen.findByRole("link", { name: "View details for report.pdf" }),
    ).toHaveAttribute("href", "/documents/document-1");
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("shows the empty state when no documents are returned", async () => {
    getDocuments.mockResolvedValue([]);
    renderDocumentsPage();

    expect(await screen.findByRole("heading", { name: "No documents yet" }))
      .toBeInTheDocument();
  });

  it("shows a load error and retries the document request", async () => {
    getDocuments
      .mockRejectedValueOnce(new Error("Unable to reach the backend."))
      .mockResolvedValueOnce([documentFixture]);
    renderDocumentsPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to reach the backend.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("link", { name: "View details for report.pdf" }),
    ).toBeInTheDocument();
    expect(getDocuments).toHaveBeenCalledTimes(2);
  });

  it("requests matching documents after search and filter changes", async () => {
    renderDocumentsPage();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search documents" }), {
      target: { value: "  report  " },
    });
    fireEvent.change(screen.getByLabelText("File type"), {
      target: { value: "application/pdf" },
    });
    fireEvent.change(screen.getByLabelText("Sort by"), {
      target: { value: "name" },
    });
    fireEvent.change(screen.getByLabelText("Order"), {
      target: { value: "asc" },
    });

    await waitFor(
      () =>
        expect(getDocuments).toHaveBeenLastCalledWith({
          search: "report",
          contentType: "application/pdf",
          sortBy: "name",
          sortOrder: "asc",
          folderId: undefined,
          unfiledOnly: false,
        }),
      { timeout: 1500 },
    );
  });

  it("uploads a selected document into its current folder and refreshes the list", async () => {
    renderDocumentsPage({
      folderId: "folder-1",
      folderName: "Reports",
    });
    const file = new File(["pdf data"], "new-report.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("Document file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload document" }));

    await waitFor(() => {
      expect(uploadDocument).toHaveBeenCalledWith(
        file,
        expect.any(Function),
        "folder-1",
      );
    });
    expect(
      await screen.findByText('"new-report.pdf" uploaded successfully.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getDocuments).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["unsupported.exe", 1, "This file type is not supported."],
    ["empty.pdf", 0, "Empty files cannot be uploaded."],
    ["large.pdf", 10 * 1024 * 1024 + 1, "The file must be 10 MiB or smaller."],
  ])("rejects invalid upload %s before calling the service", async (name, size, message) => {
    renderDocumentsPage();
    const file = new File([new Uint8Array(size)], name);

    fireEvent.change(screen.getByLabelText("Document file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload document" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it("downloads a document as a Blob using its displayed filename", async () => {
    const createObjectURL = vi.fn(() => "blob:document");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const clickedDownloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clickedDownloads.push({ href: this.href, filename: this.download });
    });

    renderDocumentsPage();
    await screen.findByRole("link", { name: "View details for report.pdf" });
    fireEvent.click(screen.getByRole("button", { name: "Download report.pdf" }));

    await waitFor(() => expect(downloadDocument).toHaveBeenCalledWith("document-1"));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickedDownloads).toEqual([
      { href: "blob:document", filename: "report.pdf" },
    ]);
  });

  it("requires confirmation and removes a deleted document from the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderDocumentsPage();

    await screen.findByRole("link", { name: "View details for report.pdf" });
    fireEvent.click(screen.getByRole("button", { name: "Delete report.pdf" }));

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith("document-1"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      '"report.pdf" was deleted.',
    );
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
  });

  it("does not delete a document when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDocumentsPage();

    await screen.findByRole("link", { name: "View details for report.pdf" });
    fireEvent.click(screen.getByRole("button", { name: "Delete report.pdf" }));

    expect(deleteDocument).not.toHaveBeenCalled();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });
});
