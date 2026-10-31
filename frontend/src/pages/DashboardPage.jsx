
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../services/api";
import { getDashboardData } from "../services/dashboardService";
import "../styles/dashboard.css";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(bytes) {
  if (typeof bytes !== "number" || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAction(action) {
  if (!action) return "Activity";

  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getActivityDescription(activity) {
  const metadata = activity.metadata_json;

  if (metadata && typeof metadata === "object") {
    const name =
      metadata.document_name ||
      metadata.documentName ||
      metadata.folder_name ||
      metadata.folderName;

    if (name) {
      return name;
    }
  }

  return "An action was recorded";
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();

    return dateB - dateA;
  });
}

function DashboardStat({ label, value, description }) {
  return (
    <article className="dashboard-stat">
      <p className="dashboard-stat-label">{label}</p>
      <p className="dashboard-stat-value">{value}</p>
      <p className="dashboard-stat-description">{description}</p>
    </article>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState({
    documents: [],
    folders: [],
    activities: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const data = await getDashboardData();
      setDashboard(data);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Unable to load dashboard data. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getDashboardData()
      .then((data) => {
        if (isCurrent) {
          setDashboard(data);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load dashboard data. Please try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const retryDashboardLoad = () => {
    setIsLoading(true);
    setError("");
    loadDashboard();
  };

  const recentDocuments = sortNewestFirst(dashboard.documents).slice(0, 5);
  const recentActivities = sortNewestFirst(dashboard.activities).slice(0, 5);

  if (isLoading) {
    return (
      <section className="dashboard-page" aria-busy="true">
        <h1>Dashboard</h1>
        <p className="dashboard-message" role="status">
          Loading your dashboard...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-page">
        <h1>Dashboard</h1>

        <div className="dashboard-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="dashboard-button"
            onClick={retryDashboardLoad}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            An overview of your documents and workspace activity.
          </p>
        </div>

        <Link to="/documents" className="dashboard-primary-link">
          View documents
        </Link>
      </div>

      <div className="dashboard-stats">
        <DashboardStat
          label="Documents"
          value={dashboard.documents.length}
          description="Documents in your workspace"
        />

        <DashboardStat
          label="Folders"
          value={dashboard.folders.length}
          description="Folders in your workspace"
        />

        <DashboardStat
        label="Recent activity"
        value={dashboard.activities.length}
        description="Your latest workspace activities"
        />
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Recent documents</h2>
              <p>Your latest documents</p>
            </div>

            <Link to="/documents" className="dashboard-text-link">
              View all
            </Link>
          </div>

          {recentDocuments.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No documents yet</h3>
              <p>Uploaded documents will appear here.</p>
              <Link to="/documents" className="dashboard-text-link">
                Go to documents
              </Link>
            </div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Size</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {recentDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <span className="dashboard-document-name">
                          {document.name || "Untitled document"}
                        </span>
                        <span className="dashboard-document-type">
                          {document.content_type || "Unknown file type"}
                        </span>
                      </td>
                      <td>{formatFileSize(document.size_bytes)}</td>
                      <td>{formatDate(document.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest recorded actions</p>
            </div>
          </div>

          {recentActivities.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No activity yet</h3>
              <p>Your recent actions will appear here when recorded.</p>
            </div>
          ) : (
            <ul className="dashboard-activity-list">
              {recentActivities.map((activity, index) => (
                <li
                  className="dashboard-activity-item"
                  key={activity.id ?? `${activity.action}-${activity.created_at}-${index}`}
                >
                  <span className="dashboard-activity-dot" aria-hidden="true" />

                  <div className="dashboard-activity-content">
                    <p className="dashboard-activity-title">
                      {formatAction(activity.action)}
                    </p>
                    <p className="dashboard-activity-description">
                      {getActivityDescription(activity)}
                    </p>
                    <time dateTime={activity.created_at}>
                      {formatDate(activity.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
