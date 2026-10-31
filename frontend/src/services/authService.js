
import api, { ACCESS_TOKEN_KEY } from "./api";

/**
 * Register a new user.
 * Expected fields: email, password, display_name.
 */
export async function registerUser({ email, password, display_name }) {
  const response = await api.post("/api/auth/register", {
    email,
    password,
    display_name,
  });

  return response.data;
}

/**
 * Authenticate a user and save the returned access token.
 */
export async function loginUser({ email, password }) {
  const response = await api.post("/api/auth/login", {
    email,
    password,
  });

  const { access_token, user } = response.data;

  if (!access_token) {
    throw new Error("The login response did not contain an access token.");
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, access_token);

  return {
    user,
    access_token,
  };
}

/**
 * Log out the user and remove the locally stored token.
 */
export async function logoutUser() {
  try {
    const response = await api.post("/api/auth/logout");

    return response.data;
  } finally {
    // Clear the local session even if the API request fails.
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}
