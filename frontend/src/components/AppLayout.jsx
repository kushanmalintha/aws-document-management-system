
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import "../styles/app-layout.css";

const navigationItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Documents", to: "/documents" },
  { label: "Folders", to: "/folders" },
  { label: "Activity", to: "/activities" },
  { label: "Profile", to: "/profile" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // AuthContext clears the local session even when the API request fails.
    }
    navigate("/login", { replace: true });
  }

  const displayName = user?.display_name || user?.email || "User";

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink
          to="/dashboard"
          className="app-brand"
          aria-label="DMS Dashboard"
        >
          <span className="app-brand-mark">D</span>
          <span>Document Management</span>
        </NavLink>

        <div className="app-header-user">
          <div className="app-user-details">
            <span className="app-user-name">{displayName}</span>
            {user?.email && (
              <span className="app-user-email">{user.email}</span>
            )}
          </div>

          <button
            type="button"
            className="app-logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Main navigation">
          <p className="app-sidebar-heading">WORKSPACE</p>

          <nav className="app-navigation">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `app-nav-link${isActive ? " active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
