import api from "./api";

export async function getActivities({ limit = 51, offset = 0 } = {}) {
  const response = await api.get("/api/activities", {
    params: { limit, offset },
  });

  if (!Array.isArray(response.data)) {
    throw new Error(
      "Activity history could not be loaded because the response format was unexpected.",
    );
  }

  return response.data;
}
