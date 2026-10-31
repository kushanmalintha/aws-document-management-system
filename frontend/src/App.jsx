import { Link, Route, Routes } from "react-router-dom";

import { useBackendHealth } from "./hooks/useBackendHealth";

import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";

function HomePage() {
  return (
    <main>
      <h1>AWS Document Management System</h1>

      <p>
        Local development frontend is running successfully.
      </p>

      <Link to="/health">
        Check Backend
      </Link>

      <p>
        <Link to="/register">Create an account</Link>
      </p>
    </main>
  );
}

function HealthPage() {
  const { health, loading, error } = useBackendHealth();

  return (
    <main>
      <h1>Backend Health</h1>

      {loading && <p>Checking backend...</p>}

      {error && (
        <p>
          Backend connection failed: {error}
        </p>
      )}

      {health && (
        <div>
          <p>Status: {health.status}</p>
          <p>Service: {health.service}</p>
        </div>
      )}

      <Link to="/">
        Back to Home
      </Link>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main>
      <h1>404</h1>

      <p>Page not found.</p>

      <Link to="/">
        Back to Home
      </Link>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="*" element={<NotFoundPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <main className="auth-page">
              <section className="auth-card">
                <h1>Dashboard</h1>
                <p>You are authenticated.</p>
              </section>
            </main>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;