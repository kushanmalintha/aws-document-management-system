import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class PasswordSecurityTests(unittest.TestCase):
    def test_password_hash_verifies_correct_password(self):
        hashed = hash_password("correct horse battery staple")
        self.assertNotEqual(hashed, "correct horse battery staple")
        self.assertTrue(verify_password("correct horse battery staple", hashed))

    def test_password_hash_rejects_incorrect_password(self):
        hashed = hash_password("correct horse battery staple")
        self.assertFalse(verify_password("incorrect password", hashed))


class AccessTokenTests(unittest.TestCase):
    def test_token_contains_required_claims_and_decodes(self):
        with patch("app.core.security.settings.jwt_secret_key", "x" * 48), patch(
            "app.core.security.settings.jwt_access_token_expire_minutes", 30
        ):
            token = create_access_token("user-id", "user@example.com", "user", 2)
            payload = decode_access_token(token)

        self.assertEqual(payload["sub"], "user-id")
        self.assertEqual(payload["email"], "user@example.com")
        self.assertEqual(payload["role"], "user")
        self.assertEqual(payload["ver"], 2)
        self.assertIn("iat", payload)
        self.assertIn("exp", payload)

    def test_rejects_invalid_signature(self):
        with patch("app.core.security.settings.jwt_secret_key", "x" * 48):
            token = jwt.encode(
                {
                    "sub": "id", "email": "user@example.com", "role": "user",
                    "iat": datetime.now(timezone.utc),
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
                    "ver": 0,
                },
                "different-secret" * 4,
                algorithm="HS256",
            )
            with self.assertRaises(jwt.InvalidTokenError):
                decode_access_token(token)

    def test_rejects_expired_token(self):
        with patch("app.core.security.settings.jwt_secret_key", "x" * 48):
            token = jwt.encode(
                {
                    "sub": "id", "email": "user@example.com", "role": "user",
                    "iat": datetime.now(timezone.utc) - timedelta(minutes=10),
                    "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
                    "ver": 0,
                },
                "x" * 48,
                algorithm="HS256",
            )
            with self.assertRaises(jwt.ExpiredSignatureError):
                decode_access_token(token)

    def test_rejects_missing_required_claim(self):
        with patch("app.core.security.settings.jwt_secret_key", "x" * 48):
            token = jwt.encode(
                {"sub": "id", "email": "user@example.com", "role": "user", "ver": 0},
                "x" * 48,
                algorithm="HS256",
            )
            with self.assertRaises(jwt.MissingRequiredClaimError):
                decode_access_token(token)

    def test_rejects_non_integer_token_version(self):
        with patch("app.core.security.settings.jwt_secret_key", "x" * 48):
            token = jwt.encode(
                {
                    "sub": "id", "email": "user@example.com", "role": "user",
                    "iat": datetime.now(timezone.utc),
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
                    "ver": "zero",
                },
                "x" * 48,
                algorithm="HS256",
            )
            with self.assertRaises(jwt.InvalidTokenError):
                decode_access_token(token)


if __name__ == "__main__":
    unittest.main()
