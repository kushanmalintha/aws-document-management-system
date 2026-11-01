import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "./api";
import {
  deleteDocument,
  downloadDocument,
  downloadDocumentVersion,
  getDocument,
  getDocumentVersions,
  getDocuments,
  uploadDocument,
  uploadDocumentVersion,
} from "./documentService";

describe("documentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends trimmed search, file type, sorting, and folder filters", async () => {
    const documents = [{ id: "doc-1" }];
    api.get.mockResolvedValue({ data: documents });

    await expect(
      getDocuments({
        search: "  report  ",
        contentType: "application/pdf",
        sortBy: "name",
        sortOrder: "asc",
        folderId: "folder-1",
      }),
    ).resolves.toEqual(documents);

    expect(api.get).toHaveBeenCalledWith("/api/documents", {
      params: {
        search: "report",
        content_type: "application/pdf",
        sort_by: "name",
        sort_order: "asc",
        folder_id: "folder-1",
      },
    });
  });

  it("filters the returned list to unfiled documents when requested", async () => {
    api.get.mockResolvedValue({
      data: [
        { id: "filed", folder_id: "folder-1" },
        { id: "unfiled", folder_id: null },
      ],
    });

    await expect(getDocuments({ unfiledOnly: true })).resolves.toEqual([
      { id: "unfiled", folder_id: null },
    ]);
  });

  it("rejects an unexpected document list response", async () => {
    api.get.mockResolvedValue({ data: { unexpected: [] } });

    await expect(getDocuments()).rejects.toThrow(
      "The document list could not be loaded because the response format was unexpected.",
    );
  });

  it("retrieves document details and validates the version history response", async () => {
    const document = { id: "doc-1", name: "report.pdf" };
    const versions = [{ id: "version-1", version_number: 1 }];
    api.get
      .mockResolvedValueOnce({ data: document })
      .mockResolvedValueOnce({ data: versions });

    await expect(getDocument("doc-1")).resolves.toEqual(document);
    await expect(getDocumentVersions("doc-1")).resolves.toEqual(versions);
    expect(api.get).toHaveBeenNthCalledWith(1, "/api/documents/doc-1");
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/api/documents/doc-1/versions",
    );
  });

  it("uploads a document as multipart data and reports upload progress", async () => {
    const file = new File(["file contents"], "report.pdf", {
      type: "application/pdf",
    });
    const onProgress = vi.fn();
    const uploadedDocument = { id: "doc-1", name: file.name };
    api.post.mockImplementation(async (_path, formData, config) => {
      config.onUploadProgress({ loaded: 1, total: 4 });
      return { data: uploadedDocument };
    });

    await expect(
      uploadDocument(file, onProgress, "folder-1"),
    ).resolves.toEqual(uploadedDocument);

    const [path, formData] = api.post.mock.calls[0];
    expect(path).toBe("/api/documents/upload");
    expect(formData.get("file")).toBe(file);
    expect(formData.get("folder_id")).toBe("folder-1");
    expect(onProgress).toHaveBeenCalledWith(25);
  });

  it("uploads a new version to the document version endpoint", async () => {
    const file = new File(["new version"], "report.pdf", {
      type: "application/pdf",
    });
    const updatedDocument = { id: "doc-1", current_version: 2 };
    const onProgress = vi.fn();
    api.post.mockImplementation(async (_path, _formData, config) => {
      config.onUploadProgress({ loaded: 3, total: 4 });
      return { data: updatedDocument };
    });

    await expect(
      uploadDocumentVersion("doc-1", file, onProgress),
    ).resolves.toEqual(updatedDocument);

    expect(api.post).toHaveBeenCalledWith(
      "/api/documents/doc-1/versions",
      expect.any(FormData),
      expect.objectContaining({ onUploadProgress: expect.any(Function) }),
    );
    expect(api.post.mock.calls[0][1].get("file")).toBe(file);
    expect(onProgress).toHaveBeenCalledWith(75);
  });

  it("returns Blob data from current and version-specific downloads", async () => {
    const fileBlob = new Blob(["document contents"], {
      type: "application/pdf",
    });
    api.get
      .mockResolvedValueOnce({ data: fileBlob })
      .mockResolvedValueOnce({ data: fileBlob });

    await expect(downloadDocument("doc-1")).resolves.toBe(fileBlob);
    await expect(downloadDocumentVersion("doc-1", 1)).resolves.toBe(fileBlob);
    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/api/documents/doc-1/download",
      { responseType: "blob" },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/api/documents/doc-1/versions/1/download",
      { responseType: "blob" },
    );
  });

  it("parses JSON errors returned as a version-download Blob", async () => {
    const error = {
      response: {
        data: new Blob([JSON.stringify({ detail: "Document version not found" })], {
          type: "application/json",
        }),
      },
    };
    api.get.mockRejectedValue(error);

    await expect(downloadDocumentVersion("doc-1", 8)).rejects.toBe(error);
    expect(error.response.data).toEqual({
      detail: "Document version not found",
    });
  });

  it("deletes a document through the soft-delete endpoint", async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await expect(deleteDocument("doc-1")).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith("/api/documents/doc-1");
  });
});
