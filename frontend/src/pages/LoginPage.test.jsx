import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../context/authContext";
import LoginPage from "./LoginPage";

function renderLogin(login, initialEntry = "/login") {
  return render(
    <AuthContext.Provider value={{ login }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/documents" element={<p>Document list</p>} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LoginPage", () => {
  it("requires an email before attempting authentication", () => {
    const login = vi.fn();
    renderLogin(login);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter your email address.",
    );
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address before attempting authentication", () => {
    const login = vi.fn();
    renderLogin(login);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "some-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(login).not.toHaveBeenCalled();
  });

  it("trims the email and returns to the originally requested route", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login, {
      pathname: "/login",
      state: { from: { pathname: "/documents" } },
    });

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  reader@example.com  " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Document list")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "correct horse battery staple",
    });
  });

  it("shows authentication failures to the user", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Invalid credentials."));
    renderLogin(login);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials.",
    );
  });
});
