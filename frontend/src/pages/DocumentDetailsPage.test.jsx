import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const folderService = vi.hoisted(() => ({
  getFolders: vi.fn(),
}));

const documentService = vi.hoisted(() => ({
  downloadDocument: vi.fn(),
  downloadDocumentVersion: vi.fn(),
  deleteDocumentVersion: vi.fn(),
  getDocument: vi.fn(),
  getDocumentVersions: vi.fn(),
  uploadDocumentVersion: vi.fn(),
}));

vi.mock("../services/documentService", () => documentService);
vi.mock("../services/folderService", () => folderService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import DocumentDetailsPage from "./DocumentDetailsPage";
import { getFolders } from "../services/folderService";
import {
  downloadDocument,
  downloadDocumentVersion,
  deleteDocumentVersion,
  getDocument,
  getDocumentVersions,
  uploadDocumentVersion,
} from "../services/documentService";

const documentId = "123e4567-e89b-12d3-a456-426614174000";
const folderId = "123e4567-e89b-12d3-a456-426614174001";
const documentFixture = {
  id: documentId,
  name: "report.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  status: "UPLOADED",
  current_version: 2,
  folder_id: folderId,
  created_at: "2025-01-10T12:00:00Z",
  updated_at: "2025-01-11T12:00:00Z",
};
const versionOne = {
  id: "version-1",
  document_id: documentId,
  version_number: 1,
  size_bytes: 1024,
  checksum: "checksum-one",
  created_at: "2025-01-10T12:00:00Z",
};
const versionTwo = {
  id: "version-2",
  document_id: documentId,
  version_number: 2,
  size_bytes: 2048,
  checksum: "checksum-two",
  created_at: "2025-01-11T12:00:00Z",
};

function renderDetails(id = documentId, state = {}) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: `/documents/${id}`, state }]}
    >
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetailsPage />} />
      </Routes>
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

describe("DocumentDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFolders.mockResolvedValue([]);
    getDocument.mockResolvedValue(documentFixture);
    getDocumentVersions.mockResolvedValue([versionOne, versionTwo]);
    downloadDocument.mockResolvedValue(new Blob(["current file"]));
    downloadDocumentVersion.mockResolvedValue(new Blob(["older file"]));
    deleteDocumentVersion.mockResolvedValue(undefined);
    uploadDocumentVersion.mockResolvedValue({
      ...documentFixture,
      current_version: 3,
    });
  });

  it("shows document metadata, newest-first versions, and a safe back link", async () => {
    renderDetails(documentId, { returnTo: `/folders/${folderId}` });

    expect(await screen.findByRole("heading", { name: "report.pdf" }))
      .toBeInTheDocument();
    expect(screen.getByText(documentId)).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(
      within(document.querySelector(".document-details__metadata")).getByText(
        "2.0 KB",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to folder" })).toHaveAttribute(
      "href",
      `/folders/${folderId}`,
    );

    await screen.findByText("checksum-two");
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Version 2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Current")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Version 1")).toBeInTheDocument();
  });

  it("rejects an invalid document ID without making API requests", () => {
    renderDetails("not-a-uuid");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This document ID is invalid.",
    );
    expect(getDocument).not.toHaveBeenCalled();
    expect(getDocumentVersions).not.toHaveBeenCalled();
  });

  it("shows API errors when the document cannot be loaded", async () => {
    getDocument.mockRejectedValue(new Error("Document not found"));
    renderDetails();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Document not found",
    );
  });

  it("shows a separate error when version history cannot be loaded", async () => {
    getDocumentVersions.mockRejectedValue(
      new Error("Unable to load version history."),
    );
    renderDetails();

    expect(await screen.findByRole("heading", { name: "report.pdf" }))
      .toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load version history.",
    );
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("downloads the current document and a selected historical version", async () => {
    const createObjectURL = vi.fn(() => "blob:download");
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
      clickedDownloads.push(this.download);
    });

    renderDetails();
    await screen.findByText("checksum-two");

    fireEvent.click(screen.getByRole("button", { name: "Download version 1" }));
    await waitFor(() => {
      expect(downloadDocumentVersion).toHaveBeenCalledWith(documentId, 1);
    });
    expect(clickedDownloads).toContain("report (v1).pdf");

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(downloadDocument).toHaveBeenCalledWith(documentId));
    expect(clickedDownloads).toContain("report.pdf");
  });

  it("deletes a historical version but never offers deletion for the current version", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderDetails();
    await screen.findByText("checksum-two");

    expect(screen.getByRole("button", { name: "Delete version 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete version 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete version 1" }));
    await waitFor(() => {
      expect(deleteDocumentVersion).toHaveBeenCalledWith(documentId, 1);
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Version 1 deleted successfully.",
    );
    expect(screen.queryByText("checksum-one")).not.toBeInTheDocument();
    expect(screen.getByText("checksum-two")).toBeInTheDocument();
  });

  it("does not delete a historical version when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDetails();
    await screen.findByText("checksum-two");

    fireEvent.click(screen.getByRole("button", { name: "Delete version 1" }));
    expect(deleteDocumentVersion).not.toHaveBeenCalled();
    expect(screen.getByText("checksum-one")).toBeInTheDocument();
  });

  it("shows an error when a historical version download fails", async () => {
    downloadDocumentVersion.mockRejectedValue(
      new Error("Document version not found."),
    );
    renderDetails();
    await screen.findByText("checksum-two");

    fireEvent.click(screen.getByRole("button", { name: "Download version 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Document version not found.",
    );
  });

  it("uploads a same-extension version and refreshes version history", async () => {
    getDocumentVersions
      .mockResolvedValueOnce([versionOne, versionTwo])
      .mockResolvedValueOnce([
        versionOne,
        versionTwo,
        { ...versionTwo, id: "version-three", version_number: 3 },
      ]);
    uploadDocumentVersion.mockResolvedValue({
      ...documentFixture,
      current_version: 3,
    });
    renderDetails();
    await screen.findByText("checksum-two");
    const file = new File(["revision"], "revision.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("New version file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload version" }));

    await waitFor(() => {
      expect(uploadDocumentVersion).toHaveBeenCalledWith(
        documentId,
        file,
        expect.any(Function),
      );
    });
    expect(await screen.findByText("Version 3 uploaded successfully."))
      .toBeInTheDocument();
    expect(getDocumentVersions).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Version 3")).toBeInTheDocument();
  });

  it("rejects a new version with a different extension", async () => {
    renderDetails();
    await screen.findByText("checksum-two");
    const file = new File(["text"], "revision.txt", { type: "text/plain" });

    fireEvent.change(screen.getByLabelText("New version file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload version" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The new version must use the same file extension",
    );
    expect(uploadDocumentVersion).not.toHaveBeenCalled();
  });

  it.each([
    ["empty.pdf", 0, "Empty files cannot be uploaded."],
    ["too-large.pdf", 10 * 1024 * 1024 + 1, "The file must be 10 MiB or smaller."],
  ])("rejects invalid version file %s before uploading", async (name, size, message) => {
    renderDetails();
    await screen.findByText("checksum-two");
    const file = new File([new Uint8Array(size)], name);

    fireEvent.change(screen.getByLabelText("New version file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload version" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(uploadDocumentVersion).not.toHaveBeenCalled();
  });

  it("displays an API failure when uploading a valid new version", async () => {
    uploadDocumentVersion.mockRejectedValue(new Error("Version upload failed."));
    renderDetails();
    await screen.findByText("checksum-two");
    const file = new File(["revision"], "revision.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("New version file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload version" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Version upload failed.",
    );
  });
});
