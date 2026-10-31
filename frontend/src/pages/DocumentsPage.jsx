
import { useCallback, useEffect, useState } from "react";

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

  const loadDocuments = useCallback(async () => {
    try {
      const result = await getDocuments();
      setDocuments(result);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Unable to load your documents. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getDocuments()
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
  }, []);

  const retryDocumentLoad = () => {
    setLoading(true);
    setError("");
    loadDocuments();
  };

  return (
    <section className="documents-page">
      <div className="documents-page__header">
        <div>
          <h1>Documents</h1>
          <p>View and manage your stored documents.</p>
        </div>

        <span className="documents-page__count">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </span>
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
          <h2>No documents yet</h2>
          <p>
            Your documents will appear here once you add your first file.
          </p>
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
