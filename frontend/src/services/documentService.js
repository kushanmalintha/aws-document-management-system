import api from "./api";

export async function getDocuments({
  search = "",
  contentType = "",
  sortBy = "created_at",
  sortOrder = "desc",
  folderId,
  unfiledOnly = false,
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

  if (folderId) {
    params.folder_id = folderId;
  }

  const response = await api.get("/api/documents", { params });
  const data = response.data;
  let documents;

  if (Array.isArray(data)) {
    documents = data;
  } else if (Array.isArray(data?.documents)) {
    documents = data.documents;
  } else if (Array.isArray(data?.items)) {
    documents = data.items;
  } else if (Array.isArray(data?.results)) {
    documents = data.results;
  } else {
    throw new Error(
      "The document list could not be loaded because the response format was unexpected.",
    );
  }

  return unfiledOnly
    ? documents.filter((document) => !document.folder_id)
    : documents;
}

export async function getDocument(documentId) {
  const response = await api.get(`/api/documents/${documentId}`);
  return response.data;
}

export async function getDocumentVersions(documentId) {
  const response = await api.get(`/api/documents/${documentId}/versions`);

  if (!Array.isArray(response.data)) {
    throw new Error(
      "The version history could not be loaded because the response format was unexpected.",
    );
  }

  return response.data;
}

export async function uploadDocumentVersion(documentId, file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(
    `/api/documents/${documentId}/versions`,
    formData,
    {
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress(percentage);
        }
      },
    },
  );

  return response.data;
}

export async function deleteDocument(documentId) {
  await api.delete(`/api/documents/${documentId}`);
}

export async function uploadDocument(file, onProgress, folderId) {
  const formData = new FormData();
  formData.append("file", file);

  if (folderId) {
    formData.append("folder_id", folderId);
  }

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
