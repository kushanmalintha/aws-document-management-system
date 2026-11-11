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

export function getApiRequestId(error) {
  const responseHeaders = error?.response?.headers;
  const requestId =
    error?.response?.data?.request_id ??
    responseHeaders?.["x-request-id"] ??
    responseHeaders?.["X-Request-ID"] ??
    responseHeaders?.get?.("x-request-id");

  return typeof requestId === "string" && requestId.trim()
    ? requestId.trim()
    : null;
}

// Convert both the current API error contract and legacy FastAPI errors
// into a readable message. Server reference IDs help correlate UI errors
// with backend request logs without exposing internal exception details.
export function getApiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  const data = error?.response?.data;
  let message = "";

  if (typeof data?.detail === "string") {
    const validationMessages = Array.isArray(data?.errors)
      ? data.errors.map((item) => item?.message).filter(Boolean)
      : [];
    message = validationMessages.length
      ? `${data.detail}: ${validationMessages.join(", ")}`
      : data.detail;
  } else if (Array.isArray(data?.errors)) {
    message = data.errors
      .map((item) => item?.message)
      .filter(Boolean)
      .join(", ");
  } else if (Array.isArray(data?.detail)) {
    message = data.detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(", ");
  } else if (typeof data?.message === "string") {
    message = data.message;
  }

  if (!message && error?.code === "ECONNABORTED") {
    message = "The request timed out. Please try again.";
  }

  if (!message && !error?.response && error?.request) {
    message = "Unable to reach the backend. Check that the backend is running.";
  }

  if (!message) {
    message = fallback;
  }

  const requestId = getApiRequestId(error);
  if (requestId) {
    return `${message} (Reference ID: ${requestId})`;
  }

  return message;
}

export default api;

// A 401 from a protected endpoint invalidates the client session. Login
// failures are excluded because invalid credentials are an expected response.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestPath = String(error?.config?.url ?? "");
    const isPublicAuthRequest =
      requestPath.includes("/api/auth/login") ||
      requestPath.includes("/api/auth/register");

    if (error?.response?.status === 401 && !isPublicAuthRequest) {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        } catch {
          // In-memory authentication state is still cleared below.
        }
        window.dispatchEvent(new Event("dms:unauthorized"));
      }
    }

    return Promise.reject(error);
  },
);
