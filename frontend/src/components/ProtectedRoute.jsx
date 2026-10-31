
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext";

function ProtectedRoute() {
  const {
    isAuthenticated,
    isLoading,
    authError,
    refreshUser,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <main className="auth-page">
        <p role="status">Checking your session...</p>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Unable to verify your session</h1>
          <p className="auth-error" role="alert">
            {authError}
          </p>
          <button
            className="auth-submit"
            type="button"
            onClick={refreshUser}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
