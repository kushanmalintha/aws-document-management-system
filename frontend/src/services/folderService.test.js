import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "./api";
import {
  createFolder,
  deleteFolder,
  getFolders,
  renameFolder,
} from "./folderService";

describe("folderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the folder list and rejects an unexpected response", async () => {
    const folders = [{ id: "folder-1", name: "Reports" }];
    api.get.mockResolvedValueOnce({ data: folders });
    api.get.mockResolvedValueOnce({ data: { folders } });

    await expect(getFolders()).resolves.toEqual(folders);
    await expect(getFolders()).rejects.toThrow(
      "The folder list could not be loaded because the response format was unexpected.",
    );
    expect(api.get).toHaveBeenCalledWith("/api/folders");
  });

  it("creates root and nested folders with the parent ID", async () => {
    const createdFolder = { id: "folder-2", name: "Invoices" };
    api.post.mockResolvedValue({ data: createdFolder });

    await expect(createFolder("Invoices")).resolves.toEqual(createdFolder);
    await expect(createFolder("Invoices", "parent-1")).resolves.toEqual(
      createdFolder,
    );
    expect(api.post).toHaveBeenNthCalledWith(1, "/api/folders", {
      name: "Invoices",
      parent_folder_id: null,
    });
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/folders", {
      name: "Invoices",
      parent_folder_id: "parent-1",
    });
  });

  it("renames a folder using the folder-specific endpoint", async () => {
    const renamedFolder = { id: "folder-1", name: "Annual Reports" };
    api.put.mockResolvedValue({ data: renamedFolder });

    await expect(renameFolder("folder-1", "Annual Reports")).resolves.toEqual(
      renamedFolder,
    );
    expect(api.put).toHaveBeenCalledWith("/api/folders/folder-1", {
      name: "Annual Reports",
    });
  });

  it("deletes a folder through its endpoint", async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await expect(deleteFolder("folder-1")).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith("/api/folders/folder-1");
  });
});
