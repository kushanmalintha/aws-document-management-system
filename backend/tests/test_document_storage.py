import asyncio
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import HTTPException

from app.api import documents as document_api
from app.models.document import DocumentStatus


class DocumentStorageLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.document_id = uuid4()
        self.user = SimpleNamespace(id=self.user_id)
        self.document = SimpleNamespace(
            id=self.document_id,
            user_id=self.user_id,
            deleted_at=None,
            status=DocumentStatus.UPLOADED,
            s3_key="documents/user/document/v1/file.pdf",
            name="report.pdf",
            content_type="application/pdf",
            size_bytes=7,
            current_version=1,
        )
        self.db = Mock()
        self.db.get.return_value = self.document

    @patch("app.api.documents.record_activity")
    @patch("app.api.documents.storage_service")
    def test_soft_delete_retains_storage_and_metadata(
        self, storage_mock, activity_mock
    ):
        result = document_api.delete_document(
            self.document_id, self.user, self.db
        )
        self.assertIsNone(result)
        self.assertEqual(self.document.status, DocumentStatus.DELETED)
        self.assertIsInstance(self.document.deleted_at, datetime)
        self.assertIsNotNone(self.document.s3_key)
        self.db.commit.assert_called_once()
        storage_mock.delete.assert_not_called()
        activity_mock.assert_called_once()

    @patch("app.api.documents.storage_service")
    def test_deleted_document_cannot_be_downloaded(self, storage_mock):
        self.document.deleted_at = datetime.now(timezone.utc)
        self.document.status = DocumentStatus.DELETED
        with self.assertRaises(HTTPException) as raised:
            document_api.download_document(
                self.document_id, self.user, self.db
            )
        self.assertEqual(raised.exception.status_code, 404)
        storage_mock.read.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_other_user_cannot_download_document(self, storage_mock):
        other_user = SimpleNamespace(id=self.other_user_id)
        with self.assertRaises(HTTPException) as raised:
            document_api.download_document(
                self.document_id, other_user, self.db
            )
        self.assertEqual(raised.exception.status_code, 403)
        storage_mock.read.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_invalid_stored_key_is_not_downloadable(self, storage_mock):
        storage_mock.read.side_effect = ValueError("Invalid storage key")
        with self.assertRaises(HTTPException) as raised:
            document_api.download_document(
                self.document_id, self.user, self.db
            )
        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.api.documents.record_activity")
    @patch("app.api.documents.storage_service")
    def test_download_keeps_attachment_and_nosniff_headers(
        self, storage_mock, activity_mock
    ):
        from io import BytesIO

        storage_mock.read.return_value = BytesIO(b"pdfdata")
        response = document_api.download_document(
            self.document_id, self.user, self.db
        )
        self.assertEqual(response.headers["content-length"], "7")
        self.assertIn("attachment;", response.headers["content-disposition"])
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        async def read_body():
            return b"".join([chunk async for chunk in response.body_iterator])

        self.assertEqual(asyncio.run(read_body()), b"pdfdata")
        activity_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
