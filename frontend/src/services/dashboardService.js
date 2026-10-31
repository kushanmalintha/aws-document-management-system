
import api from "./api";

function extractList(data, possibleKeys) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    for (const key of possibleKeys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }
  }

  return [];
}

export async function getDashboardData() {
  const [documentsResponse, foldersResponse, activitiesResponse] =
    await Promise.all([
      api.get("/api/documents"),
      api.get("/api/folders"),
      api.get("/api/activities", {
        params: { limit: 5 },
      }),
    ]);

  return {
    documents: extractList(documentsResponse.data, ["documents"]),
    folders: extractList(foldersResponse.data, ["folders"]),
    activities: extractList(activitiesResponse.data, ["activities"]),
  };
}
