import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../context/authContext";
import AppLayout from "./AppLayout";

describe("AppLayout", () => {
  it("navigates to login when the logout request fails", async () => {
    const logout = vi.fn().mockRejectedValue(new Error("Network unavailable"));

    render(
      <AuthContext.Provider value={{ user: { email: "user@example.com" }, logout }}>
        <MemoryRouter initialEntries={["/workspace"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/workspace" element={<p>Workspace</p>} />
            </Route>
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(logout).toHaveBeenCalledOnce();
  });
});
