
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../services/api";
import { loginUser } from "../services/authService";
import "../styles/auth.css";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const successMessage = location.state?.message;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const email = form.email.trim();

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!form.password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      await loginUser({
        email,
        password: form.password,
      });

      // The authentication context and protected routes
      // will be integrated in Task 0.15.6.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          err?.message || "Unable to sign in. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" to="/">
          AWS Document Management System
        </Link>

        <h1 id="login-title">Welcome back</h1>

        <p className="auth-description">
          Sign in to access and manage your documents.
        </p>

        {successMessage && (
          <p className="auth-success" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
