import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { AuthContext } from "../context/authContext";

function LoginLanding() {
  const location = useLocation();
  const returnTo = location.state?.from;

  return (
    <p>
      Login page
      {returnTo && ` — return to ${returnTo.pathname}${returnTo.search}`}
    </p>
  );
}

function renderProtectedRoute(authState, initialEntry = "/documents/example?tab=details") {
  return render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginLanding />} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="/documents/:id"
              element={<p>Protected document details</p>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while authentication is unresolved", () => {
    renderProtectedRoute({
      isAuthenticated: false,
      isLoading: true,
      authError: "",
      refreshUser: vi.fn(),
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your session",
    );
    expect(screen.queryByText("Protected document details")).toBeNull();
  });

  it("redirects signed-out users to login and remembers their destination", () => {
    renderProtectedRoute({
      isAuthenticated: false,
      isLoading: false,
      authError: "",
      refreshUser: vi.fn(),
    });

    expect(screen.getByText("Login page — return to /documents/example?tab=details"))
      .toBeInTheDocument();
    expect(screen.queryByText("Protected document details")).toBeNull();
  });

  it("shows a retry action when authentication verification has an error", () => {
    const refreshUser = vi.fn();
    renderProtectedRoute({
      isAuthenticated: false,
      isLoading: false,
      authError: "Unable to reach the backend.",
      refreshUser,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to reach the backend.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refreshUser).toHaveBeenCalledOnce();
    expect(screen.queryByText("Protected document details")).toBeNull();
  });

  it("renders the protected page for an authenticated user", () => {
    renderProtectedRoute({
      isAuthenticated: true,
      isLoading: false,
      authError: "",
      refreshUser: vi.fn(),
    });

    expect(screen.getByText("Protected document details")).toBeInTheDocument();
  });
});
