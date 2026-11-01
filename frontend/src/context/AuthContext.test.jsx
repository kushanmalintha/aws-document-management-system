import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext.jsx";
import { useAuth } from "./authContext.js";
import api, { ACCESS_TOKEN_KEY } from "../services/api";

const profile = {
  id: "user-1",
  email: "reader@example.com",
  display_name: "Test Reader",
  role: "USER",
  is_active: true,
};

function AuthProbe() {
  const { user, isAuthenticated, isLoading, authError } = useAuth();

  return (
    <div>
      <p>{isLoading ? "Loading session" : "Session ready"}</p>
      <p>{isAuthenticated ? user.email : "Signed out"}</p>
      {authError && <p role="alert">{authError}</p>}
    </div>
  );
}

function AuthControls() {
  const { user, login, logout } = useAuth();

  return (
    <div>
      <p>{user?.email || "Signed out"}</p>
      <button type="button" onClick={() => login({ email: profile.email, password: "secret" })}>
        Sign in
      </button>
      <button type="button" onClick={() => logout().catch(() => {})}>
        Sign out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not request a session when no token is stored", async () => {
    const getSpy = vi.spyOn(api, "get");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Session ready")).toBeInTheDocument();
    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("restores the current user from a stored token", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "valid-token");
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText(profile.email)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/users/me");
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("valid-token");
  });

  it("clears an expired token when session restoration returns 401", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "expired-token");
    vi.spyOn(api, "get").mockRejectedValue({ response: { status: 401 } });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Session ready")).toBeInTheDocument();
    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a recoverable error when session verification fails", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "valid-token");
    vi.spyOn(api, "get").mockRejectedValue({
      response: { status: 503, data: { detail: "Service unavailable" } },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service unavailable",
    );
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("valid-token");
  });

  it("stores a login token and clears it on logout even if logout fails", async () => {
    vi.spyOn(api, "post")
      .mockResolvedValueOnce({
        data: { access_token: "new-token", user: profile },
      })
      .mockRejectedValueOnce(new Error("Network unavailable"));

    render(
      <AuthProvider>
        <AuthControls />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(profile.email)).toBeInTheDocument();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("new-token");

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
