
import api from "./api";

export async function getDocuments() {
  const response = await api.get("/api/documents");
  const data = response.data;

  // Support a direct list or a list wrapped in an object.
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.documents)) {
    return data.documents;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  throw new Error(
    "The document list could not be loaded because the response format was unexpected.",
  );
}
