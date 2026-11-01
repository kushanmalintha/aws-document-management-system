import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import {
  deleteDocument,
  downloadDocument,
  getDocuments,
  uploadDocument,
} from "../services/documentService";

import "../styles/documents.css";

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
];

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === "") {
    return "—";
  }

  const size = Number(bytes);

  if (!Number.isFinite(size) || size < 0) {
    return "—";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDocumentType(document) {
  if (document.content_type) {
    return document.content_type;
  }

  const name = document.name || document.filename || "";
  const extension = name.includes(".")
    ? name.split(".").pop().toUpperCase()
    : "";

  return extension || "Unknown";
}

function getDocumentName(document) {
  return document.name || document.filename || "Untitled document";
}

function DocumentsPage({ folderId, folderName, unfiledOnly = false } = {}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [retryCount, setRetryCount] = useState(0);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const fileInputRef = useRef(null);
  const requestIdRef = useRef(0);

  const loadDocuments = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const result = await getDocuments({
        search,
        contentType,
        sortBy,
        sortOrder,
        folderId,
        unfiledOnly,
      });

      if (requestId === requestIdRef.current) {
        setDocuments(result);
        setError("");
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(
          getApiErrorMessage(
            requestError,
            "Unable to load your documents. Please try again.",
          ),
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [search, contentType, sortBy, sortOrder, folderId, unfiledOnly]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    getDocuments({
      search,
      contentType,
      sortBy,
      sortOrder,
      folderId,
      unfiledOnly,
    })
      .then((result) => {
        if (requestId === requestIdRef.current) {
          setDocuments(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (requestId === requestIdRef.current) {
          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load your documents. Please try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [search, contentType, sortBy, sortOrder, retryCount, folderId, unfiledOnly]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  async function handleUpload(event) {
    event.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!selectedFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    const lastDotIndex = selectedFile.name.lastIndexOf(".");
    const extension =
      lastDotIndex > 0
        ? selectedFile.name.slice(lastDotIndex).toLowerCase()
        : "";

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setUploadError("This file type is not supported.");
      return;
    }

    if (selectedFile.size === 0) {
      setUploadError("Empty files cannot be uploaded.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError("The file must be 10 MiB or smaller.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await uploadDocument(selectedFile, setUploadProgress, folderId);
      setUploadSuccess(`"${selectedFile.name}" uploaded successfully.`);
      setSelectedFile(null);
      setUploadProgress(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setLoading(true);
      setError("");
      await loadDocuments();
    } catch (requestError) {
      setUploadError(
        getApiErrorMessage(
          requestError,
          "The file could not be uploaded. Please try again.",
        ),
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(document) {
    setDownloadError("");
    setDownloadingDocumentId(document.id);

    try {
      const fileBlob = await downloadDocument(document.id);
      const objectUrl = URL.createObjectURL(fileBlob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = getDocumentName(document);
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setDownloadError(
        getApiErrorMessage(
          requestError,
          `Unable to download "${getDocumentName(document)}". Please try again.`,
        ),
      );
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  async function handleDelete(document) {
    const documentName = getDocumentName(document);

    if (
      !window.confirm(
        `Delete "${documentName}"? It will be removed from your documents list.`,
      )
    ) {
      return;
    }

    setDeleteError("");
    setDeleteSuccess("");
    setDeletingDocumentId(document.id);

    try {
      await deleteDocument(document.id);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((item) => item.id !== document.id),
      );
      setDeleteSuccess(`"${documentName}" was deleted.`);
    } catch (requestError) {
      setDeleteError(
        getApiErrorMessage(
          requestError,
          `Unable to delete "${documentName}". Please try again.`,
        ),
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  function retryDocumentLoad() {
    setLoading(true);
    setError("");
    setRetryCount((count) => count + 1);
  }

  function clearFilters() {
    setLoading(true);
    setError("");
    setSearchInput("");
    setSearch("");
    setContentType("");
    setSortBy("created_at");
    setSortOrder("desc");
  }

  function updateFilter(setter, value) {
    setLoading(true);
    setError("");
    setter(value);
  }

  function updateSearchInput(value) {
    setLoading(true);
    setError("");
    setSearchInput(value);
  }

  const hasFilters =
    searchInput.trim() !== "" ||
    contentType !== "" ||
    sortBy !== "created_at" ||
    sortOrder !== "desc";
  const documentsHeading = folderName
    ? `Documents in ${folderName}`
    : unfiledOnly
      ? "Unfiled documents"
      : "Documents";
  const documentsDescription = folderName
    ? `Files stored in ${folderName}.`
    : unfiledOnly
      ? "Documents that are not assigned to a folder."
      : "Search and organise your stored documents.";
  const documentsReturnPath = folderName || unfiledOnly
    ? folderId
      ? `/folders/${folderId}`
      : "/folders"
    : "/documents";

  return (
    <section className="documents-page">
      <div className="documents-page__header">
        <div>
          <h1>{documentsHeading}</h1>
          <p>{documentsDescription}</p>
        </div>

        <span className="documents-page__count">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </span>
      </div>

      <form className="document-upload" onSubmit={handleUpload}>
        <div className="document-upload__heading">
          <h2>
            {folderName
              ? "Upload to this folder"
              : unfiledOnly
                ? "Upload without a folder"
                : "Upload a document"}
          </h2>
          <p id="document-upload-help">Choose a supported file up to 10 MiB.</p>
        </div>

        <div className="document-upload__controls">
          <label className="document-upload__file-label" htmlFor="document-file">
            Document file
          </label>
          <input
            ref={fileInputRef}
            id="document-file"
            type="file"
            accept={ALLOWED_EXTENSIONS.join(",")}
            aria-describedby="document-upload-help"
            disabled={isUploading}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setUploadError("");
              setUploadSuccess("");
            }}
          />
          <button type="submit" disabled={isUploading || !selectedFile}>
            {isUploading ? "Uploading…" : "Upload document"}
          </button>
        </div>

        {selectedFile && (
          <p className="document-upload__selected">
            Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        )}

        {isUploading && (
          <div className="document-upload__progress">
            <progress
              value={uploadProgress}
              max="100"
              aria-label="Upload progress"
            />
            <span>{uploadProgress}%</span>
          </div>
        )}

        {uploadError && (
          <p
            className="document-upload__message document-upload__message--error"
            role="alert"
          >
            {uploadError}
          </p>
        )}

        {uploadSuccess && (
          <p
            className="document-upload__message document-upload__message--success"
            role="status"
          >
            {uploadSuccess}
          </p>
        )}
      </form>

      <div className="documents-toolbar">
        <div className="documents-search">
          <label htmlFor="document-search">Search documents</label>
          <input
            id="document-search"
            type="search"
            placeholder="Search by document name..."
            value={searchInput}
            onChange={(event) => updateSearchInput(event.target.value)}
          />
        </div>

        <div className="documents-control">
          <label htmlFor="document-type">File type</label>
          <select
            id="document-type"
            value={contentType}
            onChange={(event) => updateFilter(setContentType, event.target.value)}
          >
            <option value="">All file types</option>
            <option value="application/pdf">PDF</option>
            <option value="text/plain">Text files</option>
            <option value="text/csv">CSV</option>
            <option value="application/msword">Word (.doc)</option>
            <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
              Word (.docx)
            </option>
            <option value="application/vnd.ms-excel">Excel (.xls)</option>
            <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
              Excel (.xlsx)
            </option>
            <option value="application/vnd.ms-powerpoint">
              PowerPoint (.ppt)
            </option>
            <option value="application/vnd.openxmlformats-officedocument.presentationml.presentation">
              PowerPoint (.pptx)
            </option>
            <option value="image/png">PNG images</option>
            <option value="image/jpeg">JPEG images</option>
          </select>
        </div>

        <div className="documents-control">
          <label htmlFor="document-sort-by">Sort by</label>
          <select
            id="document-sort-by"
            value={sortBy}
            onChange={(event) => updateFilter(setSortBy, event.target.value)}
          >
            <option value="created_at">Date added</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div className="documents-control">
          <label htmlFor="document-sort-order">Order</label>
          <select
            id="document-sort-order"
            value={sortOrder}
            onChange={(event) => updateFilter(setSortOrder, event.target.value)}
          >
            <option value="desc">
              {sortBy === "name" ? "Z to A" : "Newest first"}
            </option>
            <option value="asc">
              {sortBy === "name" ? "A to Z" : "Oldest first"}
            </option>
          </select>
        </div>

        <button
          className="documents-clear-button"
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
        >
          Clear filters
        </button>
      </div>

      {downloadError && (
        <p className="document-upload__message document-upload__message--error" role="alert">
          {downloadError}
        </p>
      )}

      {deleteError && (
        <p className="document-upload__message document-upload__message--error" role="alert">
          {deleteError}
        </p>
      )}

      {deleteSuccess && (
        <p className="document-upload__message document-upload__message--success" role="status">
          {deleteSuccess}
        </p>
      )}

      {loading && (
        <div className="documents-state" role="status">
          Loading documents…
        </div>
      )}

      {!loading && error && (
        <div className="documents-state documents-state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryDocumentLoad}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="documents-state">
          <h2>{hasFilters ? "No matching documents" : "No documents yet"}</h2>
          <p>
            {hasFilters
              ? "Try a different search or clear your filters."
              : "Your documents will appear here once you add your first file."}
          </p>
          {hasFilters && (
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="documents-table-wrapper">
          <table className="documents-table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Size</th>
                <th scope="col">Date added</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div className="documents-table__name">
                      <span className="documents-table__file-icon" aria-hidden="true">
                        {getDocumentType(document)
                          .split("/")
                          .pop()
                          .toUpperCase()
                          .slice(0, 4)}
                      </span>
                      <span>{getDocumentName(document)}</span>
                    </div>
                  </td>
                  <td>{getDocumentType(document)}</td>
                  <td>{formatFileSize(document.size_bytes)}</td>
                  <td>{formatDate(document.created_at)}</td>
                  <td>
                    <Link
                      className="documents-clear-button documents-details-link"
                      to={`/documents/${document.id}`}
                      state={{ returnTo: documentsReturnPath }}
                      aria-label={`View details for ${getDocumentName(document)}`}
                    >
                      Details
                    </Link>
                    <button
                      className="documents-clear-button"
                      type="button"
                      onClick={() => handleDownload(document)}
                      disabled={
                        downloadingDocumentId !== null ||
                        deletingDocumentId !== null
                      }
                      aria-label={`Download ${getDocumentName(document)}`}
                    >
                      {downloadingDocumentId === document.id
                        ? "Downloading…"
                        : "Download"}
                    </button>
                    <button
                      className="documents-clear-button documents-delete-button"
                      type="button"
                      onClick={() => handleDelete(document)}
                      disabled={
                        deletingDocumentId !== null ||
                        downloadingDocumentId !== null
                      }
                      aria-label={`Delete ${getDocumentName(document)}`}
                    >
                      {deletingDocumentId === document.id
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DocumentsPage;
