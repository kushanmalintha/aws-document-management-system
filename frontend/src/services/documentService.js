import api from "./api";

export async function getDocuments({
  search = "",
  contentType = "",
  sortBy = "created_at",
  sortOrder = "desc",
} = {}) {
  const params = {
    sort_by: sortBy,
    sort_order: sortOrder,
  };

  if (search.trim()) {
    params.search = search.trim();
  }

  if (contentType) {
    params.content_type = contentType;
  }

  const response = await api.get("/api/documents", { params });
  const data = response.data;

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

export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/documents/upload", formData, {
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        const percentage = Math.round(
          (event.loaded / event.total) * 100,
        );

        onProgress(percentage);
      }
    },
  });

  return response.data;
}

export async function downloadDocument(documentId) {
  const response = await api.get(
    `/api/documents/${documentId}/download`,
    {
      responseType: "blob",
    },
  );

  return response.data;
}
