import unittest

from pydantic import ValidationError

from app.core.config import LOCAL_CORS_ORIGINS, Settings


class SettingsValidationTests(unittest.TestCase):
    def _settings(self, **overrides):
        values = {
            "postgres_db": "dms",
            "postgres_user": "dms_user",
            "postgres_password": "local-password",
            "postgres_host": "localhost",
            "postgres_port": 5433,
            "jwt_secret_key": "s" * 48,
            "jwt_algorithm": "HS256",
            "jwt_access_token_expire_minutes": 30,
            "environment": "development",
            "cors_allowed_origins": list(LOCAL_CORS_ORIGINS),
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    def test_valid_configuration_is_accepted(self):
        settings = self._settings()
        self.assertEqual(settings.jwt_algorithm, "HS256")

    def test_rejects_short_jwt_secret(self):
        with self.assertRaises(ValidationError):
            self._settings(jwt_secret_key="too-short")

    def test_rejects_placeholder_jwt_secret(self):
        with self.assertRaises(ValidationError):
            self._settings(jwt_secret_key="change_me" * 5)

    def test_rejects_non_hs256_algorithm(self):
        with self.assertRaises(ValidationError):
            self._settings(jwt_algorithm="HS512")

    def test_rejects_invalid_environment(self):
        with self.assertRaises(ValidationError):
            self._settings(environment="staging")

    def test_rejects_invalid_database_port(self):
        with self.assertRaises(ValidationError):
            self._settings(postgres_port=65536)

    def test_rejects_invalid_expiry(self):
        for expiry in (0, 1441):
            with self.subTest(expiry=expiry), self.assertRaises(ValidationError):
                self._settings(jwt_access_token_expire_minutes=expiry)

    def test_rejects_non_positive_upload_limit(self):
        with self.assertRaises(ValidationError):
            self._settings(max_upload_size_bytes=0)

    def test_rejects_invalid_upload_filename_length(self):
        with self.assertRaises(ValidationError):
            self._settings(max_upload_filename_length=256)

    def test_rejects_invalid_document_extensions(self):
        for extensions in ((), ("pdf",), (".pdf", ".PDF")):
            with self.subTest(extensions=extensions), self.assertRaises(ValidationError):
                self._settings(allowed_document_extensions=extensions)

    def test_normalizes_document_extensions(self):
        settings = self._settings(allowed_document_extensions=(".PDF", ".txt"))
        self.assertEqual(settings.allowed_document_extensions, (".pdf", ".txt"))

    def test_rejects_wildcard_cors_origin(self):
        with self.assertRaises(ValidationError):
            self._settings(cors_allowed_origins=["*"])

    def test_rejects_cors_origin_with_path(self):
        with self.assertRaises(ValidationError):
            self._settings(cors_allowed_origins=["https://example.com/app"])


if __name__ == "__main__":
    unittest.main()
