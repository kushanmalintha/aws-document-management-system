import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import { getFolders } from "../services/folderService";
import "../styles/folders.css";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function FolderBrowserPage() {
  const { id } = useParams();
  const routeKey = id ?? "root";
  const invalidId = id !== undefined && !UUID_PATTERN.test(id);
  const [loadState, setLoadState] = useState({
    key: null,
    folders: [],
    error: "",
  });

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

      {!loading && !pageError && childFolders.length > 0 && (
        <ul className="folder-list" aria-label="Folders">
          {childFolders.map((folder) => {
            const subfolderCount = folders.filter(
              (item) => item.parent_folder_id === folder.id,
            ).length;

            return (
              <li key={folder.id}>
                <Link className="folder-list__item" to={`/folders/${folder.id}`}>
                  <span className="folder-list__icon" aria-hidden="true">▰</span>
                  <span className="folder-list__name">{folder.name}</span>
                  <span className="folder-list__children">
                    {subfolderCount} {subfolderCount === 1 ? "subfolder" : "subfolders"}
                  </span>
                  <span className="folder-list__open" aria-hidden="true">Open</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default FolderBrowserPage;
