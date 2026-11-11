import { useEffect, useMemo, useState } from "react";

import { getApiErrorMessage } from "../services/api";
import { moveDocument, renameDocument } from "../services/documentService";
import { getFolders } from "../services/folderService";

function getExtension(name = "") {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLowerCase() : "";
}

function getFolderPath(folder, foldersById) {
  const parts = [folder.name];
  const visited = new Set([folder.id]);
  let parentId = folder.parent_folder_id;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = foldersById.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parent_folder_id;
  }

  return parts.join(" / ");
}

export default function DocumentManagementControls({ document, onDocumentUpdated }) {
  const [name, setName] = useState(document.name);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [renameSuccess, setRenameSuccess] = useState("");
  const [destinationFolderId, setDestinationFolderId] = useState(document.folder_id ?? "");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [moveSuccess, setMoveSuccess] = useState("");
  const [folderState, setFolderState] = useState({ folders: [], loading: true, error: "" });
  const [folderRetry, setFolderRetry] = useState(0);

  useEffect(() => {
    setName(document.name);
    setDestinationFolderId(document.folder_id ?? "");
    setRenameError("");
    setRenameSuccess("");
    setMoveError("");
    setMoveSuccess("");
  }, [document.id, document.name, document.folder_id]);

  useEffect(() => {
    let active = true;
    getFolders()
      .then((folders) => {
        if (active) setFolderState({ folders, loading: false, error: "" });
      })
      .catch((error) => {
        if (active) {
          setFolderState({
            folders: [],
            loading: false,
            error: getApiErrorMessage(error, "Unable to load destination folders."),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [folderRetry]);

  const foldersById = useMemo(
    () => new Map(folderState.folders.map((folder) => [folder.id, folder])),
    [folderState.folders],
  );
  const folderOptions = useMemo(
    () => folderState.folders
      .map((folder) => ({ id: folder.id, label: getFolderPath(folder, foldersById) }))
      .sort((first, second) => first.label.localeCompare(second.label)),
    [folderState.folders, foldersById],
  );

  async function handleRename(event) {
    event.preventDefault();
    setRenameError("");
    setRenameSuccess("");
    const nextName = name.trim();

    if (!nextName) {
      setRenameError("Enter a document name.");
      return;
    }
    if (getExtension(nextName) !== getExtension(document.name)) {
      setRenameError("The document extension cannot be changed.");
      return;
    }
    if (nextName.length > 255) {
      setRenameError("The document name cannot exceed 255 characters.");
      return;
    }
    if (nextName === document.name) {
      setRenameSuccess("The document name has not changed.");
      return;
    }

    setRenaming(true);
    try {
      const updatedDocument = await renameDocument(document.id, nextName);
      onDocumentUpdated(updatedDocument);
      setName(updatedDocument.name);
      setRenameSuccess("Document renamed successfully.");
    } catch (error) {
      setRenameError(getApiErrorMessage(error, "Unable to rename this document. Please try again."));
    } finally {
      setRenaming(false);
    }
  }

  async function handleMove(event) {
    event.preventDefault();
    setMoveError("");
    setMoveSuccess("");
    const nextFolderId = destinationFolderId || null;

    if (nextFolderId === (document.folder_id ?? null)) {
      setMoveSuccess("The document is already in this location.");
      return;
    }

    setMoving(true);
    try {
      const updatedDocument = await moveDocument(document.id, nextFolderId);
      onDocumentUpdated(updatedDocument);
      setMoveSuccess(nextFolderId ? "Document moved successfully." : "Document moved to the root folder.");
    } catch (error) {
      setMoveError(getApiErrorMessage(error, "Unable to move this document. Please try again."));
    } finally {
      setMoving(false);
    }
  }

  return (
    <section className="document-management-controls" aria-label="Document organisation">
      <form className="document-management-controls__form" onSubmit={handleRename}>
        <div className="document-management-controls__heading">
          <h2>Rename document</h2>
          <p>Keep the existing file extension when changing the name.</p>
        </div>
        <label htmlFor="document-new-name">Document name</label>
        <div className="document-management-controls__row">
          <input
            id="document-new-name"
            type="text"
            value={name}
            maxLength={255}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setRenameError("");
              setRenameSuccess("");
            }}
            disabled={renaming || moving}
          />
          <button type="submit" disabled={renaming || moving || !name.trim()}>
            {renaming ? "Saving…" : "Save name"}
          </button>
        </div>
        {renameError && <p className="document-management-controls__error" role="alert">{renameError}</p>}
        {renameSuccess && <p className="document-management-controls__success" role="status">{renameSuccess}</p>}
      </form>

      <form className="document-management-controls__form" onSubmit={handleMove}>
        <div className="document-management-controls__heading">
          <h2>Move document</h2>
          <p>Choose one of your folders or move the document to the root.</p>
        </div>
        <label htmlFor="document-destination-folder">Destination folder</label>
        <div className="document-management-controls__row">
          <select
            id="document-destination-folder"
            value={destinationFolderId}
            onChange={(event) => {
              setDestinationFolderId(event.target.value);
              setMoveError("");
              setMoveSuccess("");
            }}
            disabled={folderState.loading || Boolean(folderState.error) || moving || renaming}
          >
            <option value="">Root (no folder)</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={folderState.loading || Boolean(folderState.error) || moving || renaming}
          >
            {moving ? "Moving…" : "Move document"}
          </button>
        </div>
        {folderState.loading && <p className="document-management-controls__hint" role="status">Loading folders…</p>}
        {folderState.error && (
          <div className="document-management-controls__error" role="alert">
            <p>{folderState.error}</p>
            <button type="button" onClick={() => setFolderRetry((count) => count + 1)}>Retry folders</button>
          </div>
        )}
        {moveError && <p className="document-management-controls__error" role="alert">{moveError}</p>}
        {moveSuccess && <p className="document-management-controls__success" role="status">{moveSuccess}</p>}
      </form>
    </section>
  );
}
