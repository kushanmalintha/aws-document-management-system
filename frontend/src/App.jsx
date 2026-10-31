import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/authContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <Navigate
            to={isAuthenticated ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
        }
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={<h1>Dashboard placeholder</h1>}
        />
      </Route>

      <Route path="*" element={<h1>404 - Page not found</h1>} />
    </Routes>
  );
}

export default AppRoutes;