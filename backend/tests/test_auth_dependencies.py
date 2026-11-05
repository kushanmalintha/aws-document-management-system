import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.dependencies import get_current_user, require_roles
from app.core.security import create_access_token
from app.models.user import User


class AuthenticationDependencyTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.user = SimpleNamespace(
            id=self.user_id,
            is_active=True,
            role="user",
            token_version=0,
        )
        self.db = Mock()
        self.db.get.return_value = self.user

    def _credentials(self, version=0):
        token = create_access_token(
            str(self.user_id), "person@example.com", "user", version
        )
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def test_missing_bearer_token_returns_401(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=None, db=self.db)
        self.assertEqual(raised.exception.status_code, 401)

    def test_valid_token_returns_user(self):
        result = get_current_user(credentials=self._credentials(), db=self.db)
        self.assertIs(result, self.user)

    def test_disabled_user_is_rejected(self):
        self.user.is_active = False
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=self._credentials(), db=self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_revoked_token_is_rejected(self):
        self.user.token_version = 1
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=self._credentials(version=0), db=self.db)
        self.assertEqual(raised.exception.status_code, 401)

    def test_unknown_user_is_rejected(self):
        self.db.get.return_value = None
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=self._credentials(), db=self.db)
        self.assertEqual(raised.exception.status_code, 401)


class RoleDependencyTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(role="user")

    def test_allowed_role_returns_current_user(self):
        dependency = require_roles("user", "admin")
        self.assertIs(dependency(current_user=self.user), self.user)

    def test_disallowed_role_returns_403(self):
        dependency = require_roles("admin")
        with self.assertRaises(HTTPException) as raised:
            dependency(current_user=self.user)
        self.assertEqual(raised.exception.status_code, 403)

    def test_empty_role_configuration_is_rejected(self):
        with self.assertRaises(ValueError):
            require_roles()


if __name__ == "__main__":
    unittest.main()
