import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import {
  createFolder,
  deleteFolder,
  getFolders,
  renameFolder,
} from "../services/folderService";
import "../styles/folders.css";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getFolderSubtreeIds(folderId, folders) {
  const childIdsByParent = new Map();

  folders.forEach((folder) => {
    if (!folder.parent_folder_id) return;

    const childIds = childIdsByParent.get(folder.parent_folder_id) ?? [];
    childIds.push(folder.id);
    childIdsByParent.set(folder.parent_folder_id, childIds);
  });

  const subtreeIds = new Set([folderId]);
  const foldersToVisit = [folderId];

  while (foldersToVisit.length > 0) {
    const currentFolderId = foldersToVisit.pop();

    childIdsByParent.get(currentFolderId)?.forEach((childId) => {
      if (!subtreeIds.has(childId)) {
        subtreeIds.add(childId);
        foldersToVisit.push(childId);
      }
    });
  }

  return subtreeIds;
}

function FolderBrowserPage() {
  const { id } = useParams();
  const routeKey = id ?? "root";
  const invalidId = id !== undefined && !UUID_PATTERN.test(id);
  const [loadState, setLoadState] = useState({
    key: null,
    folders: [],
    error: "",
  });
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [renameSuccess, setRenameSuccess] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  useEffect(() => {
    let active = true;

    if (invalidId) {
      return () => {
        active = false;
      };
    }

    getFolders()
      .then((folders) => {
        if (active) setLoadState({ key: routeKey, folders, error: "" });
      })
      .catch((requestError) => {
        if (active) {
          setLoadState({
            key: routeKey,
            folders: [],
            error: getApiErrorMessage(
              requestError,
              "Unable to load your folders. Please try again.",
            ),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [invalidId, routeKey]);

  const loading = !invalidId && loadState.key !== routeKey;
  const error = loadState.key === routeKey ? loadState.error : "";
  const folders = loadState.key === routeKey ? loadState.folders : [];
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const currentFolder = id ? folderById.get(id) : null;

  const breadcrumbs = [];
  if (currentFolder) {
    let folder = currentFolder;
    const visited = new Set();

    while (folder && !visited.has(folder.id)) {
      breadcrumbs.unshift(folder);
      visited.add(folder.id);
      folder = folder.parent_folder_id
        ? folderById.get(folder.parent_folder_id)
        : null;
    }
  }

  const childFolders = folders
    .filter((folder) => (folder.parent_folder_id ?? null) === (id ?? null))
    .sort((first, second) => first.name.localeCompare(second.name));

  const pageError = invalidId
    ? "This folder ID is invalid."
    : id && !loading && !error && !currentFolder
      ? "Folder not found."
      : error;

  async function handleCreateFolder(event) {
    event.preventDefault();
    const name = folderName.trim();

    if (!name) {
      setCreateError("Enter a folder name.");
      setCreateSuccess("");
      return;
    }

    if (name.length > 255) {
      setCreateError("Folder names must be 255 characters or fewer.");
      setCreateSuccess("");
      return;
    }

    setCreateError("");
    setCreateSuccess("");
    setCreating(true);

    try {
      const createdFolder = await createFolder(name, id ?? null);
      setLoadState((currentState) =>
        currentState.key === routeKey
          ? { ...currentState, folders: [...currentState.folders, createdFolder] }
          : currentState,
      );
      setFolderName("");
      setCreateSuccess(`Folder "${createdFolder.name}" created.`);
    } catch (requestError) {
      setCreateError(
        getApiErrorMessage(
          requestError,
          "Unable to create the folder. Please try again.",
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  function startRename(folder) {
    setRenamingFolderId(folder.id);
    setRenameName(folder.name);
    setRenameError("");
    setRenameSuccess("");
  }

  function cancelRename() {
    setRenamingFolderId(null);
    setRenameName("");
    setRenameError("");
  }

  async function handleRenameFolder(event, folder) {
    event.preventDefault();
    const name = renameName.trim();

    if (!name) {
      setRenameError("Enter a folder name.");
      return;
    }

    if (name.length > 255) {
      setRenameError("Folder names must be 255 characters or fewer.");
      return;
    }

    if (name === folder.name) {
      cancelRename();
      return;
    }

    setRenameError("");
    setRenameSuccess("");
    setRenaming(true);

    try {
      const updatedFolder = await renameFolder(folder.id, name);
      setLoadState((currentState) =>
        currentState.key === routeKey
          ? {
              ...currentState,
              folders: currentState.folders.map((item) =>
                item.id === updatedFolder.id ? updatedFolder : item,
              ),
            }
          : currentState,
      );
      setRenamingFolderId(null);
      setRenameName("");
      setRenameSuccess(`Folder renamed to "${updatedFolder.name}".`);
    } catch (requestError) {
      setRenameError(
        getApiErrorMessage(
          requestError,
          "Unable to rename the folder. Please try again.",
        ),
      );
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteFolder(folder) {
    const subtreeIds = getFolderSubtreeIds(folder.id, folders);
    const nestedFolderCount = subtreeIds.size - 1;
    const nestedFolderText = nestedFolderCount
      ? ` and ${nestedFolderCount} nested ${nestedFolderCount === 1 ? "folder" : "folders"}`
      : "";

    if (
      !window.confirm(
        `Permanently delete "${folder.name}"${nestedFolderText}? Documents in these folders will be kept and moved out of folders.`,
      )
    ) {
      return;
    }

    setDeleteError("");
    setDeleteSuccess("");
    setDeletingFolderId(folder.id);

    try {
      await deleteFolder(folder.id);
      setLoadState((currentState) =>
        currentState.key === routeKey
          ? {
              ...currentState,
              folders: currentState.folders.filter(
                (item) => !subtreeIds.has(item.id),
              ),
            }
          : currentState,
      );
      setRenameSuccess("");
      setDeleteSuccess(
        nestedFolderCount > 0
          ? `Folder "${folder.name}" and ${nestedFolderCount} nested ${nestedFolderCount === 1 ? "folder" : "folders"} deleted. Documents were kept and moved out of folders.`
          : `Folder "${folder.name}" deleted. Documents were kept and moved out of folders.`,
      );
    } catch (requestError) {
      setDeleteError(
        getApiErrorMessage(
          requestError,
          `Unable to delete "${folder.name}". Please try again.`,
        ),
      );
    } finally {
      setDeletingFolderId(null);
    }
  }

  return (
    <section className="folder-browser">
      <nav className="folder-breadcrumbs" aria-label="Folder breadcrumbs">
        <ol>
          <li>
            {currentFolder ? (
              <Link to="/folders">All folders</Link>
            ) : (
              <span aria-current="page">All folders</span>
            )}
          </li>
          {breadcrumbs.map((folder, index) => {
            const isCurrent = index === breadcrumbs.length - 1;

            return (
              <li key={folder.id}>
                {isCurrent ? (
                  <span aria-current="page">{folder.name}</span>
                ) : (
                  <Link to={`/folders/${folder.id}`}>{folder.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="folder-browser__header">
        <div>
          <h1>{currentFolder?.name ?? "Folders"}</h1>
          <p>
            {currentFolder
              ? `Subfolders inside ${currentFolder.name}.`
              : "Browse your folder hierarchy."}
          </p>
        </div>
        {!loading && !pageError && (
          <span className="folder-browser__count">
            {childFolders.length} {childFolders.length === 1 ? "folder" : "folders"}
          </span>
        )}
      </div>

      {!loading && !pageError && (
        <form className="folder-create" onSubmit={handleCreateFolder}>
          <div className="folder-create__field">
            <label htmlFor="folder-name">New folder name</label>
            <input
              id="folder-name"
              type="text"
              value={folderName}
              maxLength={255}
              autoComplete="off"
              disabled={creating || deletingFolderId !== null}
              onChange={(event) => {
                setFolderName(event.target.value);
                setCreateError("");
                setCreateSuccess("");
              }}
            />
          </div>
          <button
            type="submit"
            disabled={creating || deletingFolderId !== null || !folderName.trim()}
          >
            {creating ? "Creating…" : "Create folder"}
          </button>
          {createError && (
            <p className="folder-create__message folder-create__message--error" role="alert">
              {createError}
            </p>
          )}
          {createSuccess && (
            <p className="folder-create__message folder-create__message--success" role="status">
              {createSuccess}
            </p>
          )}
        </form>
      )}

      {loading && (
        <div className="folder-browser__state" role="status">
          Loading folders…
        </div>
      )}

      {!loading && pageError && (
        <div className="folder-browser__state folder-browser__state--error" role="alert">
          <p>{pageError}</p>
          <Link to="/folders">Return to all folders</Link>
        </div>
      )}

      {!loading && !pageError && childFolders.length === 0 && (
        <div className="folder-browser__state">
          <h2>{currentFolder ? "No subfolders" : "No folders yet"}</h2>
          <p>
            {currentFolder
              ? "There are no folders inside this folder."
              : "Folders you create will appear here."}
          </p>
        </div>
      )}

      {deleteError && (
        <p className="folder-create__message folder-create__message--error" role="alert">
          {deleteError}
        </p>
      )}

      {deleteSuccess && (
        <p className="folder-create__message folder-create__message--success" role="status">
          {deleteSuccess}
        </p>
      )}

      {!loading && !pageError && childFolders.length > 0 && (
        <ul className="folder-list" aria-label="Folders">
          {childFolders.map((folder) => {
            const subfolderCount = folders.filter(
              (item) => item.parent_folder_id === folder.id,
            ).length;

            return (
              <li key={folder.id}>
                <div className="folder-list__row">
                  {renamingFolderId === folder.id ? (
                    <form
                      className="folder-rename"
                      onSubmit={(event) => handleRenameFolder(event, folder)}
                    >
                      <div className="folder-rename__field">
                        <label htmlFor={`folder-rename-${folder.id}`}>
                          Rename folder
                        </label>
                        <input
                          id={`folder-rename-${folder.id}`}
                          type="text"
                          value={renameName}
                          maxLength={255}
                          autoFocus
                          disabled={renaming}
                          onChange={(event) => {
                            setRenameName(event.target.value);
                            setRenameError("");
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={
                          renaming ||
                          deletingFolderId !== null ||
                          !renameName.trim()
                        }
                      >
                        {renaming ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="folder-rename__cancel"
                        type="button"
                        onClick={cancelRename}
                        disabled={renaming || deletingFolderId !== null}
                      >
                        Cancel
                      </button>
                      {renameError && (
                        <p className="folder-rename__error" role="alert">
                          {renameError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <>
                      <Link className="folder-list__item" to={`/folders/${folder.id}`}>
                        <span className="folder-list__icon" aria-hidden="true">▰</span>
                        <span className="folder-list__name">{folder.name}</span>
                        <span className="folder-list__children">
                          {subfolderCount} {subfolderCount === 1 ? "subfolder" : "subfolders"}
                        </span>
                        <span className="folder-list__open" aria-hidden="true">Open</span>
                      </Link>
                      <button
                        className="folder-list__rename"
                        type="button"
                        onClick={() => startRename(folder)}
                        disabled={renaming || deletingFolderId !== null}
                        aria-label={`Rename ${folder.name}`}
                      >
                        Rename
                      </button>
                      <button
                        className="folder-list__delete"
                        type="button"
                        onClick={() => handleDeleteFolder(folder)}
                        disabled={creating || renaming || deletingFolderId !== null}
                        aria-label={`Delete folder ${folder.name}`}
                      >
                        {deletingFolderId === folder.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {renameSuccess && (
        <p className="folder-create__message folder-create__message--success" role="status">
          {renameSuccess}
        </p>
      )}
    </section>
  );
}

export default FolderBrowserPage;
