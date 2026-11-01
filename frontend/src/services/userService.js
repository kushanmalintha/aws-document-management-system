import api from "./api";

export async function getUserProfile() {
  const response = await api.get("/api/users/me");
  return response.data;
}

export async function updateUserProfile({ display_name }) {
  const response = await api.put("/api/users/me", { display_name });
  return response.data;
}
