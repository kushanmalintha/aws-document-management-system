import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import app


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_liveness_does_not_depend_on_database(self):
        with patch("app.main.engine.connect", side_effect=OperationalError(
            "SELECT 1", {}, Exception("database offline")
        )):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_readiness_returns_ready_when_database_is_available(self):
        connection = MagicMock()
        context = MagicMock()
        context.__enter__.return_value = connection
        context.__exit__.return_value = False

        with patch("app.main.engine.connect", return_value=context):
            response = self.client.get("/health/ready")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "ready",
            "database": "healthy",
        })

    def test_readiness_returns_503_when_database_is_unavailable(self):
        with patch("app.main.engine.connect", side_effect=OperationalError(
            "SELECT 1", {}, Exception("database offline")
        )):
            response = self.client.get("/health/ready")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"],
                         "A database operation could not be completed. Please try again.")
        self.assertTrue(response.json()["request_id"])

    def test_existing_database_health_endpoint_uses_standard_error_response(self):
        with patch("app.main.engine.connect", side_effect=OperationalError(
            "SELECT 1", {}, Exception("database offline")
        )):
            response = self.client.get("/health/database")

        self.assertEqual(response.status_code, 503)
        self.assertIn("request_id", response.json())


if __name__ == "__main__":
    unittest.main()
