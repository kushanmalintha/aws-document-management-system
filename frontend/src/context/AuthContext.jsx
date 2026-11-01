
import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import api, { ACCESS_TOKEN_KEY, getApiErrorMessage } from "../services/api";
import { loginUser, logoutUser } from "../services/authService";

function hasStoredToken() {
  return Boolean(
    window.localStorage.getItem(ACCESS_TOKEN_KEY),
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(hasStoredToken);
  const [authError, setAuthError] = useState("");

  const refreshUser = useCallback(async () => {
    if (!hasStoredToken()) {
      setUser(null);
      setAuthError("");
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setAuthError("");

    try {
      const response = await api.get("/api/users/me");
      setUser(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        setUser(null);
        setAuthError("");
      } else {
        setAuthError(
          getApiErrorMessage(
            error,
            "Unable to verify your session. Please try again.",
          ),
        );
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!hasStoredToken()) {
        return;
      }

      try {
        const response = await api.get("/api/users/me");

        if (!cancelled) {
          setUser(response.data);
          setAuthError("");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.response?.status === 401) {
          window.localStorage.removeItem(ACCESS_TOKEN_KEY);
          setUser(null);
          setAuthError("");
        } else {
          setAuthError(
            getApiErrorMessage(
              error,
              "Unable to verify your session. Please try again.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await loginUser(credentials);
    setUser(result.user);
    setAuthError("");
    return result.user;
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      setUser(null);
      setAuthError("");
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    logout,
    refreshUser,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
