import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authService = vi.hoisted(() => ({
  registerUser: vi.fn(),
}));

vi.mock("../services/authService", () => authService);
vi.mock("../services/api", () => ({
  getApiErrorMessage: (error, fallback) => error?.message || fallback,
}));

import { registerUser } from "../services/authService";
import RegisterPage from "./RegisterPage";

function LoginLanding() {
  const location = useLocation();
  return <p>{location.state?.message ?? "Login page"}</p>;
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginLanding />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillRegistrationForm({ password = "strong-password", confirmPassword = password } = {}) {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "  Test Reader  " },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "  reader@example.com  " },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmPassword },
  });
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerUser.mockResolvedValue({ id: "user-1" });
  });

  it("rejects mismatched passwords without creating an account", () => {
    renderRegister();
    fillRegistrationForm({ confirmPassword: "different-password" });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address before creating an account", () => {
    renderRegister();
    fillRegistrationForm();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("trims profile fields and navigates to login after registration", async () => {
    renderRegister();
    fillRegistrationForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Account created successfully. Please sign in."))
      .toBeInTheDocument();
    expect(registerUser).toHaveBeenCalledWith({
      display_name: "Test Reader",
      email: "reader@example.com",
      password: "strong-password",
    });
  });

  it("shows registration errors returned by the API", async () => {
    registerUser.mockRejectedValue(new Error("Email already registered."));
    renderRegister();
    fillRegistrationForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already registered.",
    );
  });
});
