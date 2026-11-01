import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const folderService = vi.hoisted(() => ({
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  getFolders: vi.fn(),
  renameFolder: vi.fn(),
}));
const documentService = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
  getDocuments: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock("../services/folderService", () => folderService);
vi.mock("../services/documentService", () => documentService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import FolderBrowserPage from "./FolderBrowserPage";
import {
  createFolder,
  deleteFolder,
  getFolders,
  renameFolder,
} from "../services/folderService";
import { getDocuments } from "../services/documentService";

const rootFolderId = "123e4567-e89b-12d3-a456-426614174010";
const childFolderId = "123e4567-e89b-12d3-a456-426614174011";
const grandchildFolderId = "123e4567-e89b-12d3-a456-426614174012";
const archiveFolderId = "123e4567-e89b-12d3-a456-426614174013";

const folders = [
  {
    id: rootFolderId,
    name: "Reports",
    parent_folder_id: null,
  },
  {
    id: childFolderId,
    name: "2025",
    parent_folder_id: rootFolderId,
  },
  {
    id: grandchildFolderId,
    name: "Quarter 1",
    parent_folder_id: childFolderId,
  },
  {
    id: archiveFolderId,
    name: "Archive",
    parent_folder_id: null,
  },
];

function renderFolderBrowser(entry = "/folders") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/folders" element={<FolderBrowserPage />} />
        <Route path="/folders/:id" element={<FolderBrowserPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FolderBrowserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFolders.mockResolvedValue(folders);
    createFolder.mockImplementation(async (name, parentFolderId) => ({
      id: "new-folder",
      name,
      parent_folder_id: parentFolderId,
    }));
    renameFolder.mockImplementation(async (id, name) => ({
      ...folders.find((folder) => folder.id === id),
      name,
    }));
    deleteFolder.mockResolvedValue(undefined);
    getDocuments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists root folders in order and navigates through breadcrumbs", async () => {
    renderFolderBrowser();

    const reportsLink = await screen.findByRole("link", { name: /Reports/ });
    expect(reportsLink).toHaveAttribute("href", `/folders/${rootFolderId}`);
    expect(within(reportsLink).getByText("1 subfolder")).toBeInTheDocument();

    fireEvent.click(reportsLink);
    expect(await screen.findByRole("heading", { name: "Reports" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Folder breadcrumbs" })
        .querySelector('a[href="/folders"]'),
    ).toHaveTextContent("All folders");
    expect(screen.getByRole("link", { name: /2025/ })).toHaveAttribute(
      "href",
      `/folders/${childFolderId}`,
    );
    await waitFor(() => {
      expect(getDocuments).toHaveBeenLastCalledWith({
        search: "",
        contentType: "",
        sortBy: "created_at",
        sortOrder: "desc",
        folderId: rootFolderId,
        unfiledOnly: false,
      });
    });
  });

  it("creates a nested folder with a trimmed name and current parent", async () => {
    renderFolderBrowser(`/folders/${rootFolderId}`);
    await screen.findByRole("heading", { name: "Reports" });

    fireEvent.change(screen.getByLabelText("New folder name"), {
      target: { value: "  Invoices  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));

    expect(createFolder).toHaveBeenCalledWith("Invoices", rootFolderId);
    expect(await screen.findByText('Folder "Invoices" created.'))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Invoices/ })).toHaveAttribute(
      "href",
      "/folders/new-folder",
    );
  });

  it("rejects an empty folder name before calling the service", async () => {
    const { container } = renderFolderBrowser();
    await screen.findByRole("heading", { name: "Folders" });

    fireEvent.change(screen.getByLabelText("New folder name"), {
      target: { value: "   " },
    });
    fireEvent.submit(container.querySelector(".folder-create"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a folder name.",
    );
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("renames a folder with a trimmed name and updates the displayed link", async () => {
    renderFolderBrowser();
    await screen.findByRole("link", { name: /Reports/ });

    fireEvent.click(screen.getByRole("button", { name: "Rename Reports" }));
    fireEvent.change(screen.getByLabelText("Rename folder"), {
      target: { value: "  Annual Reports  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(renameFolder).toHaveBeenCalledWith(rootFolderId, "Annual Reports");
    expect(await screen.findByText('Folder renamed to "Annual Reports".'))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Annual Reports/ })).toHaveAttribute(
      "href",
      `/folders/${rootFolderId}`,
    );
  });

  it("cancels folder renaming without making an API request", async () => {
    renderFolderBrowser();
    await screen.findByRole("link", { name: /Reports/ });

    fireEvent.click(screen.getByRole("button", { name: "Rename Reports" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(renameFolder).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Reports/ })).toBeInTheDocument();
  });

  it("confirms nested-folder deletion, removes the subtree, and keeps documents", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderFolderBrowser();
    await screen.findByRole("link", { name: /Reports/ });

    fireEvent.click(screen.getByRole("button", { name: "Delete folder Reports" }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Permanently delete "Reports" and 2 nested folders'),
    );
    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith(rootFolderId));
    expect(
      await screen.findByText(/Documents were kept and moved out of folders\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Reports/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Archive/ })).toBeInTheDocument();
  });

  it("does not delete a folder when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderFolderBrowser();
    await screen.findByRole("link", { name: /Reports/ });

    fireEvent.click(screen.getByRole("button", { name: "Delete folder Reports" }));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Reports/ })).toBeInTheDocument();
  });

  it("rejects invalid folder IDs without making API requests", () => {
    renderFolderBrowser("/folders/not-a-uuid");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This folder ID is invalid.",
    );
    expect(getFolders).not.toHaveBeenCalled();
    expect(getDocuments).not.toHaveBeenCalled();
  });

  it("displays a folder loading error", async () => {
    getFolders.mockRejectedValue(new Error("Unable to load folders."));
    renderFolderBrowser();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load folders.",
    );
    expect(screen.getByRole("link", { name: "Return to all folders" }))
      .toHaveAttribute("href", "/folders");
  });
});
