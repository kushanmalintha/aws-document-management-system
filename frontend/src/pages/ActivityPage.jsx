import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../services/api";
import { getActivities } from "../services/activityService";
import "../styles/activity.css";

const PAGE_SIZE = 50;

function formatAction(action) {
  if (!action) return "Activity";

  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(bytes) {
  if (typeof bytes !== "number" || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getActivityDescription(activity) {
  const metadata = activity.metadata_json;

  if (!metadata || typeof metadata !== "object") {
    return "An action was recorded.";
  }

  const name =
    metadata.name ||
    metadata.document_name ||
    metadata.documentName ||
    metadata.folder_name ||
    metadata.folderName;
  const parts = [];

  if (name) parts.push(name);
  if (metadata.version_number != null) {
    parts.push(`Version ${metadata.version_number}`);
  }

  const fileSize = formatFileSize(metadata.size_bytes);
  if (fileSize) parts.push(fileSize);

  return parts.length > 0 ? parts.join(" · ") : "An action was recorded.";
}

export default function ActivityPage() {
  const [page, setPage] = useState(0);
  const [requestKey, setRequestKey] = useState(0);
  const [loadState, setLoadState] = useState({
    page: null,
    activities: [],
    hasMore: false,
    error: "",
  });

  useEffect(() => {
    let active = true;

    getActivities({ limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE })
      .then((activities) => {
        if (!active) return;
        setLoadState({
          page,
          activities: activities.slice(0, PAGE_SIZE),
          hasMore: activities.length > PAGE_SIZE,
          error: "",
        });
      })
      .catch((requestError) => {
        if (!active) return;
        setLoadState({
          page,
          activities: [],
          hasMore: false,
          error: getApiErrorMessage(
            requestError,
            "Unable to load activity history. Please try again.",
          ),
        });
      });

    return () => {
      active = false;
    };
  }, [page, requestKey]);

  const loading = loadState.page !== page;
  const error = loadState.page === page ? loadState.error : "";
  const activities = loadState.page === page ? loadState.activities : [];
  const hasMore = loadState.page === page && loadState.hasMore;

  return (
    <section className="activity-page">
      <header className="activity-page__header">
        <div>
          <p className="activity-page__eyebrow">Workspace</p>
          <h1>Activity</h1>
          <p>Review the actions recorded in your workspace.</p>
        </div>
        {!loading && !error && activities.length > 0 && (
          <span className="activity-page__count">
            {activities.length} {activities.length === 1 ? "event" : "events"}
          </span>
        )}
      </header>

      <section className="activity-panel" aria-label="Activity history">
        {loading && (
          <p className="activity-state" role="status">
            Loading activity…
          </p>
        )}

        {!loading && error && (
          <div className="activity-state activity-state--error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoadState({
                  page: null,
                  activities: [],
                  hasMore: false,
                  error: "",
                });
                setRequestKey((key) => key + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && activities.length === 0 && page === 0 && (
          <div className="activity-state activity-state--empty">
            <h2>No activity yet</h2>
            <p>Your recorded actions will appear here.</p>
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <ol className="activity-list">
            {activities.map((activity) => (
              <li className="activity-item" key={activity.id}>
                <span className="activity-item__marker" aria-hidden="true" />
                <div className="activity-item__content">
                  <h2>{formatAction(activity.action)}</h2>
                  <p>{getActivityDescription(activity)}</p>
                  <time dateTime={activity.created_at}>
                    {formatDate(activity.created_at)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}

        {!loading && !error && (page > 0 || hasMore) && (
          <nav className="activity-pagination" aria-label="Activity pages">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!hasMore}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}
