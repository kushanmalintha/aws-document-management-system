
import axios from "axios";

export const ACCESS_TOKEN_KEY = "dms_access_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

// Attach the current access token to protected API requests.
api.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Convert common API errors into readable messages for the UI.
export function getApiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (error?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (!error?.response && error?.request) {
    return "Unable to reach the backend. Check that the backend is running.";
  }

  return fallback;
}

export default api;
