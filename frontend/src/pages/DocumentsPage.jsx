
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../services/api";
import { getDocuments } from "../services/documentService";

import "../styles/documents.css";

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

function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [retryCount, setRetryCount] = useState(0);

  // Debounce text search to avoid sending a request for every keystroke.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search !== searchInput) {
        setLoading(true);
        setError("");
      }
      setSearch(searchInput);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchInput, search]);

  // Reload when the applied search, filter, or sort changes.
  useEffect(() => {
    let isCurrent = true;

    getDocuments({ search, contentType, sortBy, sortOrder })
      .then((result) => {
        if (isCurrent) {
          setDocuments(result);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load your documents. Please try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [search, contentType, sortBy, sortOrder, retryCount]);

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

  const hasFilters =
    searchInput.trim() !== "" ||
    contentType !== "" ||
    sortBy !== "created_at" ||
    sortOrder !== "desc";

  return (
    <section className="documents-page">
      <div className="documents-page__header">
        <div>
          <h1>Documents</h1>
          <p>Search and organise your stored documents.</p>
        </div>

        <span className="documents-page__count">
          {documents.length}{" "}
          {documents.length === 1 ? "document" : "documents"}
        </span>
      </div>

      <div className="documents-toolbar">
        <div className="documents-search">
          <label htmlFor="document-search">Search documents</label>
          <input
            id="document-search"
            type="search"
            placeholder="Search by document name..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="documents-control">
          <label htmlFor="document-type">File type</label>
          <select
            id="document-type"
            value={contentType}
            onChange={(event) =>
              updateFilter(setContentType, event.target.value)
            }
          >
            <option value="">All file types</option>
            <option value="application/pdf">PDF</option>
            <option value="text/plain">Text files</option>
            <option value="text/csv">CSV</option>
            <option value="application/msword">Word (.doc)</option>
            <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
              Word (.docx)
            </option>
            <option value="application/vnd.ms-excel">
              Excel (.xls)
            </option>
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
            onChange={(event) =>
              updateFilter(setSortOrder, event.target.value)
            }
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
          <h2>
            {hasFilters ? "No matching documents" : "No documents yet"}
          </h2>
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
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div className="documents-table__name">
                      <span
                        className="documents-table__file-icon"
                        aria-hidden="true"
                      >
                        {getDocumentType(document)
                          .split("/")
                          .pop()
                          .toUpperCase()
                          .slice(0, 4)}
                      </span>

                      <span>
                        {document.name ||
                          document.filename ||
                          "Untitled document"}
                      </span>
                    </div>
                  </td>

                  <td>{getDocumentType(document)}</td>
                  <td>{formatFileSize(document.size_bytes)}</td>
                  <td>{formatDate(document.created_at)}</td>
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
