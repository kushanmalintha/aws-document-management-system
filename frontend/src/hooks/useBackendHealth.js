import { useEffect, useState } from "react";

import { getBackendHealth } from "../services/healthService";

export function useBackendHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const data = await getBackendHealth();

        if (mounted) {
          setHealth(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.response?.data?.detail ||
              err.message ||
              "Unable to connect to backend.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkHealth();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    health,
    loading,
    error,
  };
}