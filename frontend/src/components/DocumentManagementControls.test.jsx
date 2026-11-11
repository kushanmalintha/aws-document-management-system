import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  moveDocument: vi.fn(),
  renameDocument: vi.fn(),
  getFolders: vi.fn(),
}));

vi.mock("../services/documentService", () => ({
  moveDocument: service.moveDocument,
  renameDocument: service.renameDocument,
}));
vi.mock("../services/folderService", () => ({
  getFolders: service.getFolders,
}));
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import DocumentManagementControls from "./DocumentManagementControls";

const documentFixture = {
  id: "document-1",
  name: "report.pdf",
  folder_id: null,
};
const folders = [
  { id: "folder-1", name: "Reports", parent_folder_id: null },
  { id: "folder-2", name: "2025", parent_folder_id: "folder-1" },
];

describe("DocumentManagementControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getFolders.mockResolvedValue(folders);
    service.renameDocument.mockImplementation(async (id, name) => ({
      ...documentFixture,
      id,
      name,
    }));
    service.moveDocument.mockImplementation(async (id, folderId) => ({
      ...documentFixture,
      id,
      folder_id: folderId,
    }));
  });

  it("renames a document while preserving its extension", async () => {
    const onDocumentUpdated = vi.fn();
    render(
      <DocumentManagementControls
        document={documentFixture}
        onDocumentUpdated={onDocumentUpdated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Document name"), {
      target: { value: "  annual-report.pdf  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(service.renameDocument).toHaveBeenCalledWith(
        "document-1",
        "annual-report.pdf",
      );
    });
    expect(onDocumentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ name: "annual-report.pdf" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Document renamed successfully.",
    );
  });

  it("rejects an empty name and a changed extension without API calls", async () => {
    render(
      <DocumentManagementControls
        document={documentFixture}
        onDocumentUpdated={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Document name"), {
      target: { value: "annual-report.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The document extension cannot be changed.",
    );
    expect(service.renameDocument).not.toHaveBeenCalled();
  });

  it("moves a document to a selected folder and supports moving to root", async () => {
    const onDocumentUpdated = vi.fn();
    render(
      <DocumentManagementControls
        document={documentFixture}
        onDocumentUpdated={onDocumentUpdated}
      />,
    );

    await screen.findByRole("option", { name: "Reports / 2025" });
    fireEvent.change(screen.getByLabelText("Destination folder"), {
      target: { value: "folder-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move document" }));

    await waitFor(() => {
      expect(service.moveDocument).toHaveBeenCalledWith("document-1", "folder-2");
    });
    expect(onDocumentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ folder_id: "folder-2" }),
    );
  });

  it("shows a recoverable error when folders cannot be loaded", async () => {
    service.getFolders.mockRejectedValueOnce(new Error("Folder service unavailable"));
    render(
      <DocumentManagementControls
        document={documentFixture}
        onDocumentUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Folder service unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry folders" }));
    expect(await screen.findByRole("option", { name: "Reports" })).toBeInTheDocument();
  });
});
