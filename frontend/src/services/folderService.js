import api from "./api";

export async function getFolders() {
  const response = await api.get("/api/folders");

  if (!Array.isArray(response.data)) {
    throw new Error(
      "The folder list could not be loaded because the response format was unexpected.",
    );
  }

  return response.data;
}
