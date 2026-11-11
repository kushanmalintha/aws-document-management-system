import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import DocumentManagementControls from "../components/DocumentManagementControls";
import {
  MAX_DOCUMENT_UPLOAD_SIZE_BYTES,
  MAX_DOCUMENT_UPLOAD_SIZE_LABEL,
} from "../config/documentUpload";
import {
  downloadDocument,
  downloadDocumentVersion,
  deleteDocumentVersion,
  getDocument,
  getDocumentVersions,
  uploadDocumentVersion,
} from "../services/documentService";
import "../styles/documents.css";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLDER_RETURN_PATH_PATTERN =
  /^\/folders(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;

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

function getFileExtension(fileName = "") {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.slice(lastDotIndex).toLowerCase() : "";
}

function DocumentDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const requestedReturnTo = location.state?.returnTo;
  const returnTo = FOLDER_RETURN_PATH_PATTERN.test(requestedReturnTo ?? "")
    ? requestedReturnTo
    : "/documents";
  const [loadState, setLoadState] = useState({
    id: null,
    status: "loading",
    document: null,
    error: "",
  });
  const [versionLoadState, setVersionLoadState] = useState({
    id: null,
    versions: [],
    error: "",
  });
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState(null);
  const [versionDownloadError, setVersionDownloadError] = useState("");
  const [versionFile, setVersionFile] = useState(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [versionUploadError, setVersionUploadError] = useState("");
  const [versionUploadSuccess, setVersionUploadSuccess] = useState("");
  const [deletingVersion, setDeletingVersion] = useState(null);
  const [versionDeleteError, setVersionDeleteError] = useState("");
  const [versionDeleteSuccess, setVersionDeleteSuccess] = useState("");
  const versionFileInputRef = useRef(null);
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

  useEffect(() => {
    let active = true;

    if (invalidId) {
      return () => {
        active = false;
      };
    }

    getDocumentVersions(id)
      .then((versions) => {
        if (active) setVersionLoadState({ id, versions, error: "" });
      })
      .catch((requestError) => {
        if (active) {
          setVersionLoadState({
            id,
            versions: [],
            error: getApiErrorMessage(
              requestError,
              "Unable to load version history. Please try again.",
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
  const versionsLoading = !invalidId && versionLoadState.id !== id;
  const versionsError =
    versionLoadState.id === id ? versionLoadState.error : "";
  const versions =
    versionLoadState.id === id ? versionLoadState.versions : [];
  const orderedVersions = versions
    .slice()
    .sort((first, second) => second.version_number - first.version_number);

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

  async function handleVersionDownload(version) {
    setVersionDownloadError("");
    setDownloadingVersion(version.version_number);

    try {
      const fileBlob = await downloadDocumentVersion(
        document.id,
        version.version_number,
      );
      const objectUrl = URL.createObjectURL(fileBlob);
      const link = window.document.createElement("a");
      const extensionIndex = document.name.lastIndexOf(".");
      const fileName =
        extensionIndex > 0
          ? `${document.name.slice(0, extensionIndex)} (v${version.version_number})${document.name.slice(extensionIndex)}`
          : `${document.name} (v${version.version_number})`;

      link.href = objectUrl;
      link.download = fileName;
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setVersionDownloadError(
        getApiErrorMessage(
          requestError,
          `Unable to download version ${version.version_number}.`,
        ),
      );
    } finally {
      setDownloadingVersion(null);
    }
  }

  async function handleVersionDelete(version) {
    if (version.version_number === document.current_version) {
      setVersionDeleteError("The current document version cannot be deleted.");
      return;
    }

    if (!window.confirm(`Delete version ${version.version_number}? This cannot be undone.`)) {
      return;
    }

    setVersionDeleteError("");
    setVersionDeleteSuccess("");
    setDeletingVersion(version.version_number);

    try {
      await deleteDocumentVersion(document.id, version.version_number);
      setVersionLoadState((current) => ({
        ...current,
        versions: current.id === id
          ? current.versions.filter((item) => item.version_number !== version.version_number)
          : current.versions,
      }));
      setVersionDeleteSuccess(`Version ${version.version_number} deleted successfully.`);
    } catch (requestError) {
      setVersionDeleteError(
        getApiErrorMessage(
          requestError,
          `Unable to delete version ${version.version_number}. Please try again.`,
        ),
      );
    } finally {
      setDeletingVersion(null);
    }
  }

  async function handleVersionUpload(event) {
    event.preventDefault();
    setVersionUploadError("");
    setVersionUploadSuccess("");

    if (!versionFile) {
      setVersionUploadError("Choose a file to upload as a new version.");
      return;
    }

    const currentExtension = getFileExtension(document.name);
    const uploadedExtension = getFileExtension(versionFile.name);

    if (!currentExtension || uploadedExtension !== currentExtension) {
      setVersionUploadError(
        "The new version must use the same file extension as the current document.",
      );
      return;
    }

    if (versionFile.size === 0) {
      setVersionUploadError("Empty files cannot be uploaded.");
      return;
    }

    if (versionFile.size > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
      setVersionUploadError(`The file must be ${MAX_DOCUMENT_UPLOAD_SIZE_LABEL} or smaller.`);
      return;
    }

    setUploadingVersion(true);
    setUploadProgress(0);

    try {
      const updatedDocument = await uploadDocumentVersion(
        document.id,
        versionFile,
        setUploadProgress,
      );
      setLoadState((currentState) =>
        currentState.id === id
          ? { ...currentState, document: updatedDocument }
          : currentState,
      );
      setVersionFile(null);
      setUploadProgress(100);
      setVersionUploadSuccess(
        `Version ${updatedDocument.current_version} uploaded successfully.`,
      );

      if (versionFileInputRef.current) {
        versionFileInputRef.current.value = "";
      }

      setVersionLoadState({ id: null, versions: [], error: "" });

      try {
        const updatedVersions = await getDocumentVersions(document.id);
        setVersionLoadState({ id, versions: updatedVersions, error: "" });
      } catch (requestError) {
        setVersionLoadState({
          id,
          versions: [],
          error: getApiErrorMessage(
            requestError,
            "Unable to refresh version history. Please try again.",
          ),
        });
      }
    } catch (requestError) {
      setVersionUploadError(
        getApiErrorMessage(
          requestError,
          "The new version could not be uploaded. Please try again.",
        ),
      );
    } finally {
      setUploadingVersion(false);
    }
  }

  return (
    <section className="documents-page document-details">
      <Link className="document-details__back" to={returnTo}>
        {returnTo.startsWith("/folders") ? "Back to folder" : "Back to documents"}
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

          <DocumentManagementControls
            document={document}
            onDocumentUpdated={(updatedDocument) =>
              setLoadState((current) =>
                current.id === id ? { ...current, document: updatedDocument } : current,
              )
            }
          />

          <form
            className="document-upload document-version-upload"
            onSubmit={handleVersionUpload}
          >
            <div className="document-upload__heading">
              <h2>Upload a new version</h2>
              <p id="document-version-upload-help">
                Choose a file with the same extension. The server enforces the configured size and content checks.
              </p>
            </div>

            <div className="document-upload__controls">
              <label
                className="document-upload__file-label"
                htmlFor="document-version-file"
              >
                New version file
              </label>
              <input
                ref={versionFileInputRef}
                id="document-version-file"
                type="file"
                accept={getFileExtension(document.name) || undefined}
                aria-describedby="document-version-upload-help"
                disabled={uploadingVersion}
                onChange={(inputEvent) => {
                  setVersionFile(inputEvent.target.files?.[0] ?? null);
                  setVersionUploadError("");
                  setVersionUploadSuccess("");
                }}
              />
              <button
                type="submit"
                disabled={uploadingVersion || !versionFile}
              >
                {uploadingVersion ? "Uploading version…" : "Upload version"}
              </button>
            </div>

            {versionFile && (
              <p className="document-upload__selected">
                Selected: {versionFile.name} ({formatFileSize(versionFile.size)})
              </p>
            )}

            {uploadingVersion && (
              <div className="document-upload__progress">
                <progress
                  value={uploadProgress}
                  max="100"
                  aria-label="Version upload progress"
                />
                <span>{uploadProgress}%</span>
              </div>
            )}

            {versionUploadError && (
              <p
                className="document-upload__message document-upload__message--error"
                role="alert"
              >
                {versionUploadError}
              </p>
            )}

            {versionUploadSuccess && (
              <p
                className="document-upload__message document-upload__message--success"
                role="status"
              >
                {versionUploadSuccess}
              </p>
            )}
          </form>

          <section
            className="document-version-history"
            aria-labelledby="document-version-history-title"
          >
            <div className="document-version-history__header">
              <div>
                <h2 id="document-version-history-title">Version history</h2>
                <p>Versions of this document, newest first.</p>
              </div>
            </div>

            {versionsLoading && (
              <p className="document-version-history__message" role="status">
                Loading version history…
              </p>
            )}

            {!versionsLoading && versionsError && (
              <p
                className="document-version-history__message document-version-history__message--error"
                role="alert"
              >
                {versionsError}
              </p>
            )}

            {!versionsLoading && !versionsError && versions.length === 0 && (
              <p className="document-version-history__message">
                No version history is available for this document.
              </p>
            )}

            {versionDeleteError && (
              <p className="document-version-history__message document-version-history__message--error" role="alert">
                {versionDeleteError}
              </p>
            )}
            {versionDeleteSuccess && (
              <p className="document-version-history__message" role="status">
                {versionDeleteSuccess}
              </p>
            )}

            {!versionsLoading && !versionsError && versions.length > 0 && (
              <div className="documents-table-wrapper document-version-history__table-wrapper">
                <table className="documents-table document-version-history__table">
                  <thead>
                    <tr>
                      <th scope="col">Version</th>
                      <th scope="col">File size</th>
                      <th scope="col">Uploaded</th>
                      <th scope="col">Checksum</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedVersions.map((version) => (
                      <tr key={version.id}>
                        <td>
                          <span>Version {version.version_number}</span>
                          {version.version_number === document.current_version && (
                            <span className="document-version-history__current">
                              Current
                            </span>
                          )}
                        </td>
                        <td>{formatFileSize(version.size_bytes)}</td>
                        <td>{formatDate(version.created_at)}</td>
                        <td className="document-version-history__checksum">
                          {version.checksum || "Unavailable"}
                        </td>
                        <td>
                          <div className="document-version-history__actions">
                            <button
                              className="document-version-history__download"
                              type="button"
                              onClick={() => handleVersionDownload(version)}
                              disabled={downloadingVersion !== null || deletingVersion !== null}
                              aria-label={`Download version ${version.version_number}`}
                            >
                              {downloadingVersion === version.version_number ? "Downloading…" : "Download"}
                            </button>
                            {version.version_number !== document.current_version && (
                              <button
                                className="document-version-history__delete"
                                type="button"
                                onClick={() => handleVersionDelete(version)}
                                disabled={deletingVersion !== null || downloadingVersion !== null}
                                aria-label={`Delete version ${version.version_number}`}
                              >
                                {deletingVersion === version.version_number ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {versionDownloadError && (
              <p
                className="document-version-history__message document-version-history__message--error"
                role="alert"
              >
                {versionDownloadError}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default DocumentDetailsPage;
