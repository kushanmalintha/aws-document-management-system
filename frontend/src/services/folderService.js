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

export async function createFolder(name, parentFolderId = null) {
  const response = await api.post("/api/folders", {
    name,
    parent_folder_id: parentFolderId,
  });

  return response.data;
}

export async function renameFolder(folderId, name) {
  const response = await api.put(`/api/folders/${folderId}`, { name });
  return response.data;
}

export async function deleteFolder(folderId) {
  await api.delete(`/api/folders/${folderId}`);
}
