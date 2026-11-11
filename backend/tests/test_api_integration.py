"""Real FastAPI/PostgreSQL integration tests.

Set TEST_DATABASE_URL to a disposable PostgreSQL database whose database name
contains "test". This module drops and recreates application tables in that
database. Never point it at the normal development database.
"""
import os
import tempfile
import unittest
from uuid import UUID
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, DATABASE_URL, get_db
from app.main import app
from app.models import Document, DocumentVersion
from app.infrastructure.local_storage import LocalStorage


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def _build_safe_test_engine():
    if not TEST_DATABASE_URL:
        raise unittest.SkipTest(
            "Set TEST_DATABASE_URL to a dedicated disposable PostgreSQL database"
        )

    target = make_url(TEST_DATABASE_URL)
    configured = make_url(str(DATABASE_URL))

    if target.drivername not in {"postgresql", "postgresql+psycopg"}:
        raise RuntimeError("TEST_DATABASE_URL must use PostgreSQL")

    if not target.database or "test" not in target.database.lower():
        raise RuntimeError(
            "TEST_DATABASE_URL must target a dedicated database with 'test' in its name"
        )

    target_identity = (
        (target.host or "").lower(),
        target.port or 5432,
        target.database.lower(),
    )
    application_identity = (
        (configured.host or "").lower(),
        configured.port or 5432,
        (configured.database or "").lower(),
    )
    if (
        target.database.lower() == (configured.database or "").lower()
        or target_identity == application_identity
    ):
        raise RuntimeError(
            "TEST_DATABASE_URL must not point to the configured application database"
        )

    return create_engine(target, pool_pre_ping=True)


@unittest.skipUnless(
    TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to run PostgreSQL-backed API integration tests",
)
class PostgreSQLApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = _build_safe_test_engine()
        cls.Session = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            expire_on_commit=False,
        )
        Base.metadata.drop_all(cls.engine)
        Base.metadata.create_all(cls.engine)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "engine"):
            Base.metadata.drop_all(cls.engine)
            cls.engine.dispose()

    def setUp(self):
        # Recreate the schema for every test to guarantee isolation.
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)

        self.original_dependency_overrides = app.dependency_overrides.copy()
        self.storage_directory = tempfile.TemporaryDirectory(prefix="dms-api-test-")
        self.storage = LocalStorage(self.storage_directory.name)
        self.storage_patch = patch("app.api.documents.storage_service", self.storage)
        self.storage_patch.start()
        self.processing_patch = patch(
            "app.api.documents.schedule_document_processing"
        )
        self.processing_patch.start()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.original_dependency_overrides)
        self.processing_patch.stop()
        self.storage_patch.stop()
        self.storage_directory.cleanup()

    def register(self, email, display_name):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": "Correct-Horse-Battery-42!",
                "display_name": display_name,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def login(self, email):
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": "Correct-Horse-Battery-42!",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_registration_login_and_profile_use_postgresql(self):
        user = self.register("integration-user@example.test", "Integration User")
        token = self.login("integration-user@example.test")

        response = self.client.get(
            "/api/users/me",
            headers=self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["id"], user["id"])
        self.assertEqual(response.json()["email"], "integration-user@example.test")

    def test_duplicate_registration_returns_conflict(self):
        self.register("duplicate@example.test", "First User")

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "DUPLICATE@example.test",
                "password": "Correct-Horse-Battery-42!",
                "display_name": "Second User",
            },
        )

        self.assertEqual(response.status_code, 409)

    def test_folder_creation_and_cross_user_isolation(self):
        self.register("folder-owner@example.test", "Folder Owner")
        self.register("folder-other@example.test", "Other User")
        owner_token = self.login("folder-owner@example.test")
        other_token = self.login("folder-other@example.test")

        created = self.client.post(
            "/api/folders",
            headers=self.auth_headers(owner_token),
            json={"name": "Private Reports", "parent_folder_id": None},
        )
        self.assertEqual(created.status_code, 201, created.text)
        folder_id = created.json()["id"]

        own_list = self.client.get(
            "/api/folders",
            headers=self.auth_headers(owner_token),
        )
        other_list = self.client.get(
            "/api/folders",
            headers=self.auth_headers(other_token),
        )
        foreign_detail = self.client.get(
            f"/api/folders/{folder_id}",
            headers=self.auth_headers(other_token),
        )

        self.assertEqual(len(own_list.json()), 1)
        self.assertEqual(other_list.json(), [])
        self.assertEqual(foreign_detail.status_code, 403)

    def test_document_upload_version_download_activity_and_soft_delete(self):
        self.register("document-owner@example.test", "Document Owner")
        token = self.login("document-owner@example.test")
        headers = self.auth_headers(token)

        first_content = b"%PDF-1.7\nfirst version"
        uploaded = self.client.post(
            "/api/documents/upload",
            headers=headers,
            files={"file": ("report.pdf", first_content, "application/pdf")},
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        document_id = uploaded.json()["id"]

        first_download = self.client.get(
            f"/api/documents/{document_id}/download",
            headers=headers,
        )
        self.assertEqual(first_download.status_code, 200)
        self.assertEqual(first_download.content, first_content)

        second_content = b"%PDF-1.7\nsecond version"
        version_upload = self.client.post(
            f"/api/documents/{document_id}/versions",
            headers=headers,
            files={"file": ("report.pdf", second_content, "application/pdf")},
        )
        self.assertEqual(version_upload.status_code, 201, version_upload.text)
        self.assertEqual(version_upload.json()["current_version"], 2)

        versions = self.client.get(
            f"/api/documents/{document_id}/versions",
            headers=headers,
        )
        self.assertEqual(versions.status_code, 200)
        self.assertEqual([item["version_number"] for item in versions.json()], [1, 2])

        second_download = self.client.get(
            f"/api/documents/{document_id}/versions/2/download",
            headers=headers,
        )
        self.assertEqual(second_download.status_code, 200)
        self.assertEqual(second_download.content, second_content)

        activities = self.client.get("/api/activities", headers=headers)
        self.assertEqual(activities.status_code, 200)
        actions = {item["action"] for item in activities.json()}
        self.assertIn("DOCUMENT_UPLOADED", actions)
        self.assertIn("DOCUMENT_VERSION_UPLOADED", actions)
        self.assertIn("DOCUMENT_DOWNLOADED", actions)
        self.assertIn("DOCUMENT_VERSION_DOWNLOADED", actions)

        deleted = self.client.delete(
            f"/api/documents/{document_id}",
            headers=headers,
        )
        self.assertEqual(deleted.status_code, 204)

        listing = self.client.get("/api/documents", headers=headers)
        download_after_delete = self.client.get(
            f"/api/documents/{document_id}/download",
            headers=headers,
        )
        self.assertEqual(listing.json(), [])
        self.assertEqual(download_after_delete.status_code, 404)

        # The agreed soft-delete behavior retains the stored binary.
        with self.Session() as db:
            persisted = db.get(Document, UUID(document_id))
            self.assertIsNotNone(persisted)
            self.assertIsNotNone(persisted.deleted_at)
            self.assertEqual(persisted.status, "DELETED")
            original_version = (
                db.query(DocumentVersion)
                .filter(
                    DocumentVersion.document_id == UUID(document_id),
                    DocumentVersion.version_number == 1,
                )
                .one()
            )
            self.assertTrue(self.storage.exists(original_version.s3_key))

    def test_another_user_cannot_read_or_download_document(self):
        self.register("private-owner@example.test", "Private Owner")
        self.register("private-other@example.test", "Other User")
        owner_token = self.login("private-owner@example.test")
        other_token = self.login("private-other@example.test")

        upload = self.client.post(
            "/api/documents/upload",
            headers=self.auth_headers(owner_token),
            files={"file": ("private.pdf", b"%PDF-1.7\nprivate", "application/pdf")},
        )
        self.assertEqual(upload.status_code, 201, upload.text)
        document_id = upload.json()["id"]

        detail = self.client.get(
            f"/api/documents/{document_id}",
            headers=self.auth_headers(other_token),
        )
        download = self.client.get(
            f"/api/documents/{document_id}/download",
            headers=self.auth_headers(other_token),
        )

        self.assertEqual(detail.status_code, 403)
        self.assertEqual(download.status_code, 403)

    def test_unauthenticated_document_and_folder_requests_are_rejected(self):
        self.assertEqual(self.client.get("/api/documents").status_code, 401)
        self.assertEqual(self.client.get("/api/folders").status_code, 401)
