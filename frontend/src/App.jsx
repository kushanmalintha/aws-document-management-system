
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import DocumentsPage from "./pages/DocumentsPage";
import DocumentDetailsPage from "./pages/DocumentDetailsPage";
import FolderBrowserPage from "./pages/FolderBrowserPage";
import ActivityPage from "./pages/ActivityPage";

function ComingSoonPage({ title }) {
  return (
    <section>
      <h1>{title}</h1>
      <p>This section will be implemented in a later task.</p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />  
          <Route path="documents/:id" element={<DocumentDetailsPage />} />
          <Route path="/folders" element={<FolderBrowserPage />} />
          <Route path="/folders/:id" element={<FolderBrowserPage />} />
          <Route path="/activities" element={<ActivityPage />} />
          <Route
            path="/profile"
            element={<ComingSoonPage title="Profile" />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
