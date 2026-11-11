import unittest

from fastapi import FastAPI, HTTPException, Query
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.core.observability import (
    RequestLoggingMiddleware,
    install_error_handlers,
)


class ApiErrorHandlingTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)
        install_error_handlers(app)

        @app.get("/validation")
        def validation_endpoint(limit: int = Query(ge=1, le=10)):
            return {"limit": limit}

        @app.get("/http-error")
        def http_error_endpoint():
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        @app.get("/database-error")
        def database_error_endpoint():
            raise SQLAlchemyError("password=must-not-appear-in-response-or-logs")

        @app.get("/unexpected-error")
        def unexpected_error_endpoint():
            raise RuntimeError("secret-value-must-not-be-exposed")

        self.client = TestClient(app, raise_server_exceptions=False)

    def test_validation_error_uses_safe_standard_response_and_request_id(self):
        response = self.client.get(
            "/validation?limit=invalid",
            headers={"X-Request-ID": "phase6-test-request"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.headers["x-request-id"], "phase6-test-request")
        payload = response.json()
        self.assertEqual(payload["detail"], "Request validation failed")
        self.assertEqual(payload["request_id"], "phase6-test-request")
        self.assertTrue(payload["errors"])
        self.assertEqual(payload["errors"][0]["location"], "query.limit")
        self.assertNotIn("input", payload["errors"][0])

    def test_invalid_request_id_is_replaced(self):
        response = self.client.get(
            "/validation?limit=invalid",
            headers={"X-Request-ID": "contains spaces"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertNotEqual(response.headers["x-request-id"], "contains spaces")
        self.assertEqual(
            response.headers["x-request-id"],
            response.json()["request_id"],
        )

    def test_http_error_preserves_status_and_authentication_header(self):
        response = self.client.get("/http-error")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(response.json()["detail"], "Authentication required")
        self.assertTrue(response.json()["request_id"])

    def test_database_error_is_sanitized_and_logged_without_exception_message(self):
        with self.assertLogs("app.core.observability", level="ERROR") as captured:
            response = self.client.get("/database-error")

        self.assertEqual(response.status_code, 503)
        self.assertIn("request_id", response.json())
        self.assertNotIn("must-not-appear", response.text)
        self.assertNotIn("must-not-appear", "
".join(captured.output))
        self.assertIn("SQLAlchemyError", "
".join(captured.output))

    def test_unexpected_error_is_sanitized(self):
        with self.assertLogs("app.core.observability", level="ERROR") as captured:
            response = self.client.get("/unexpected-error")

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret-value", response.text)
        self.assertNotIn("secret-value", "
".join(captured.output))
        self.assertIn("RuntimeError", "
".join(captured.output))

    def test_request_logs_do_not_include_query_string_values(self):
        with self.assertLogs("app.core.observability", level="INFO") as captured:
            self.client.get("/http-error?access_token=do-not-log")

        output = "
".join(captured.output)
        self.assertIn("path=/http-error", output)
        self.assertNotIn("access_token", output)
        self.assertNotIn("do-not-log", output)


if __name__ == "__main__":
    unittest.main()
