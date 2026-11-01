import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import { downloadDocument, getDocument } from "../services/documentService";
import "../styles/documents.css";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) {
    return "Unavailable";
  }

  const size = Number(bytes);
  if (size < 0) return "Unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DocumentDetailsPage() {
  const { id } = useParams();
  const [loadState, setLoadState] = useState({
    id: null,
    status: "loading",
    document: null,
    error: "",
  });
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const invalidId = !UUID_PATTERN.test(id ?? "");

  useEffect(() => {
    let active = true;

    if (invalidId) {
      return () => {
        active = false;
      };
    }

    getDocument(id)
      .then((result) => {
        if (active) {
          setLoadState({ id, status: "success", document: result, error: "" });
        }
      })
      .catch((requestError) => {
        if (active) {
          setLoadState({
            id,
            status: "error",
            document: null,
            error: getApiErrorMessage(
              requestError,
              "Unable to load this document. Please try again.",
            ),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [id, invalidId]);

  const loading = !invalidId && loadState.id !== id;
  const error = loadState.id === id ? loadState.error : "";
  const document = loadState.id === id ? loadState.document : null;

  async function handleDownload() {
    setDownloadError("");
    setDownloading(true);

    try {
      const fileBlob = await downloadDocument(document.id);
      const objectUrl = URL.createObjectURL(fileBlob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = document.name;
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setDownloadError(
        getApiErrorMessage(requestError, "Unable to download this document."),
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="documents-page document-details">
      <Link className="document-details__back" to="/documents">
        Back to documents
      </Link>

      {invalidId && (
        <div className="documents-state documents-state--error" role="alert">
          <h1>Unable to open document</h1>
          <p>This document ID is invalid.</p>
        </div>
      )}

      {!invalidId && loading && (
        <div className="documents-state" role="status">
          Loading document details…
        </div>
      )}

      {!invalidId && !loading && error && (
        <div className="documents-state documents-state--error" role="alert">
          <h1>Unable to open document</h1>
          <p>{error}</p>
        </div>
      )}

      {!invalidId && !loading && !error && document && (
        <>
          <div className="documents-page__header document-details__header">
            <div>
              <h1>{document.name}</h1>
              <p>Document details</p>
            </div>
            <button
              className="document-details__download"
              type="button"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Downloading…" : "Download"}
            </button>
          </div>

          {downloadError && (
            <p className="document-details__error" role="alert">
              {downloadError}
            </p>
          )}

          <dl className="document-details__metadata">
            <div>
              <dt>Document ID</dt>
              <dd>{document.id}</dd>
            </div>
            <div>
              <dt>File type</dt>
              <dd>{document.content_type || "Unavailable"}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{formatFileSize(document.size_bytes)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{document.status || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Current version</dt>
              <dd>{document.current_version ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Folder ID</dt>
              <dd>{document.folder_id || "None"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(document.created_at)}</dd>
            </div>
            <div>
              <dt>Last modified</dt>
              <dd>{formatDate(document.updated_at)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

export default DocumentDetailsPage;
