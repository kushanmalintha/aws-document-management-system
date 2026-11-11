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
            folder_id=None,
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


class DocumentRenameAndMoveTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.document_id = uuid4()
        self.folder_id = uuid4()
        self.user = SimpleNamespace(id=self.user_id)
        self.document = SimpleNamespace(
            id=self.document_id,
            user_id=self.user_id,
            deleted_at=None,
            name="report.pdf",
            folder_id=None,
            content_type="application/pdf",
            size_bytes=7,
            current_version=1,
            status=DocumentStatus.UPLOADED,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.folder = SimpleNamespace(id=self.folder_id, user_id=self.user_id)
        self.db = Mock()
        self.db.get.side_effect = self._get

    def _get(self, model, object_id):
        if model is document_api.Document and object_id == self.document_id:
            return self.document
        if model is document_api.Folder and object_id == self.folder_id:
            return self.folder
        return None

    @patch("app.api.documents.record_activity")
    def test_rename_updates_name_and_records_activity(self, activity_mock):
        from app.schemas.document import RenameDocumentRequest

        result = document_api.rename_document(
            self.document_id,
            RenameDocumentRequest(name="annual-report.pdf"),
            self.user,
            self.db,
        )
        self.assertEqual(result.name, "annual-report.pdf")
        self.db.commit.assert_called_once()
        activity_mock.assert_called_once_with(
            db=self.db,
            user_id=self.user_id,
            action="DOCUMENT_RENAMED",
            document_id=self.document_id,
            metadata_json={"old_name": "report.pdf", "new_name": "annual-report.pdf"},
        )

    def test_rename_rejects_extension_change(self):
        from app.schemas.document import RenameDocumentRequest

        with self.assertRaises(HTTPException) as raised:
            document_api.rename_document(
                self.document_id,
                RenameDocumentRequest(name="report.txt"),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(self.document.name, "report.pdf")
        self.db.commit.assert_not_called()

    def test_rename_rejects_invalid_filename(self):
        from app.schemas.document import RenameDocumentRequest

        with self.assertRaises(HTTPException) as raised:
            document_api.rename_document(
                self.document_id,
                RenameDocumentRequest(name="invalid.exe"),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 415)
        self.db.commit.assert_not_called()

    def test_other_user_cannot_rename_document(self):
        from app.schemas.document import RenameDocumentRequest

        other_user = SimpleNamespace(id=self.other_user_id)
        with self.assertRaises(HTTPException) as raised:
            document_api.rename_document(
                self.document_id,
                RenameDocumentRequest(name="private.pdf"),
                other_user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 403)
        self.db.commit.assert_not_called()

    def test_deleted_document_cannot_be_renamed(self):
        from app.schemas.document import RenameDocumentRequest

        self.document.deleted_at = datetime.now(timezone.utc)
        with self.assertRaises(HTTPException) as raised:
            document_api.rename_document(
                self.document_id,
                RenameDocumentRequest(name="report-new.pdf"),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.api.documents.record_activity")
    def test_move_updates_folder_and_records_activity(self, activity_mock):
        from app.schemas.document import MoveDocumentRequest

        result = document_api.move_document(
            self.document_id,
            MoveDocumentRequest(folder_id=self.folder_id),
            self.user,
            self.db,
        )
        self.assertEqual(result.folder_id, self.folder_id)
        self.db.commit.assert_called_once()
        activity_mock.assert_called_once_with(
            db=self.db,
            user_id=self.user_id,
            action="DOCUMENT_MOVED",
            document_id=self.document_id,
            metadata_json={"old_folder_id": None, "new_folder_id": str(self.folder_id)},
        )

    def test_move_to_root_is_supported(self):
        from app.schemas.document import MoveDocumentRequest

        self.document.folder_id = self.folder_id
        result = document_api.move_document(
            self.document_id,
            MoveDocumentRequest(folder_id=None),
            self.user,
            self.db,
        )
        self.assertIsNone(result.folder_id)
        self.db.commit.assert_called_once()

    def test_move_rejects_folder_owned_by_another_user(self):
        from app.schemas.document import MoveDocumentRequest

        self.folder.user_id = self.other_user_id
        with self.assertRaises(HTTPException) as raised:
            document_api.move_document(
                self.document_id,
                MoveDocumentRequest(folder_id=self.folder_id),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 403)
        self.db.commit.assert_not_called()

    def test_move_rejects_missing_folder(self):
        from app.schemas.document import MoveDocumentRequest

        missing_folder_id = uuid4()
        with self.assertRaises(HTTPException) as raised:
            document_api.move_document(
                self.document_id,
                MoveDocumentRequest(folder_id=missing_folder_id),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)

    def test_move_rejects_other_users_document(self):
        from app.schemas.document import MoveDocumentRequest

        other_user = SimpleNamespace(id=self.other_user_id)
        with self.assertRaises(HTTPException) as raised:
            document_api.move_document(
                self.document_id,
                MoveDocumentRequest(folder_id=self.folder_id),
                other_user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_deleted_document_cannot_be_moved(self):
        from app.schemas.document import MoveDocumentRequest

        self.document.deleted_at = datetime.now(timezone.utc)
        with self.assertRaises(HTTPException) as raised:
            document_api.move_document(
                self.document_id,
                MoveDocumentRequest(folder_id=None),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)



class DocumentVersionDeletionTests(unittest.TestCase):
    def setUp(self):
        from io import BytesIO

        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.document_id = uuid4()
        self.user = SimpleNamespace(id=self.user_id)
        self.document = SimpleNamespace(
            id=self.document_id,
            user_id=self.user_id,
            deleted_at=None,
            current_version=3,
        )
        self.version = SimpleNamespace(
            document_id=self.document_id,
            version_number=2,
            s3_key="documents/user/document/v2/file.pdf",
        )

        self.document_query = Mock()
        self.document_query.filter.return_value.with_for_update.return_value.first.return_value = (
            self.document
        )
        self.version_query = Mock()
        self.version_query.filter.return_value.first.return_value = self.version

        self.db = Mock()
        self.db.query.side_effect = self._query
        self._stored_file = BytesIO(b"version-two-content")

    def _query(self, model):
        if model is document_api.Document:
            return self.document_query
        if model is document_api.DocumentVersion:
            return self.version_query
        raise AssertionError(f"Unexpected model queried: {model}")

    @patch("app.api.documents.storage_service")
    def test_deletes_non_current_version_and_preserves_current_number(
        self, storage_mock
    ):
        storage_mock.read.return_value = self._stored_file

        result = document_api.delete_document_version(
            self.document_id, 2, self.user, self.db
        )

        self.assertIsNone(result)
        self.db.delete.assert_called_once_with(self.version)
        self.db.commit.assert_called_once()
        self.assertEqual(self.document.current_version, 3)
        storage_mock.delete.assert_called_once_with(self.version.s3_key)

    @patch("app.api.documents.record_activity")
    @patch("app.api.documents.storage_service")
    def test_deleting_old_version_records_activity(
        self, storage_mock, activity_mock
    ):
        storage_mock.read.return_value = self._stored_file

        document_api.delete_document_version(
            self.document_id, 2, self.user, self.db
        )

        activity_mock.assert_called_once()
        self.assertEqual(activity_mock.call_args.kwargs["action"], "DOCUMENT_VERSION_DELETED")
        self.assertEqual(activity_mock.call_args.kwargs["document_id"], self.document_id)
        self.assertEqual(
            activity_mock.call_args.kwargs["metadata_json"]["version_number"], 2
        )

    @patch("app.api.documents.storage_service")
    def test_rejects_current_version_deletion(self, storage_mock):
        self.version.version_number = 3

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 3, self.user, self.db
            )

        self.assertEqual(raised.exception.status_code, 409)
        storage_mock.read.assert_not_called()
        storage_mock.delete.assert_not_called()
        self.db.delete.assert_not_called()
        self.db.commit.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_rejects_another_users_document(self, storage_mock):
        other_user = SimpleNamespace(id=self.other_user_id)

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 2, other_user, self.db
            )

        self.assertEqual(raised.exception.status_code, 403)
        storage_mock.read.assert_not_called()
        self.db.delete.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_rejects_deleted_document(self, storage_mock):
        self.document.deleted_at = datetime.now(timezone.utc)

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 2, self.user, self.db
            )

        self.assertEqual(raised.exception.status_code, 404)
        storage_mock.read.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_rejects_missing_version(self, storage_mock):
        self.version_query.filter.return_value.first.return_value = None

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 99, self.user, self.db
            )

        self.assertEqual(raised.exception.status_code, 404)
        storage_mock.read.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_storage_delete_failure_rolls_back_without_removing_metadata(
        self, storage_mock
    ):
        storage_mock.read.return_value = self._stored_file
        storage_mock.delete.side_effect = OSError("Storage unavailable")

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 2, self.user, self.db
            )

        self.assertEqual(raised.exception.status_code, 500)
        self.db.rollback.assert_called_once()
        self.db.delete.assert_not_called()
        self.db.commit.assert_not_called()

    @patch("app.api.documents.storage_service")
    def test_database_failure_restores_deleted_file(self, storage_mock):
        storage_mock.read.return_value = self._stored_file
        self.db.commit.side_effect = RuntimeError("Database unavailable")

        def assert_restored(file_object, storage_key):
            self.assertEqual(storage_key, self.version.s3_key)
            self.assertEqual(file_object.read(), b"version-two-content")

        storage_mock.save.side_effect = assert_restored

        with self.assertRaises(HTTPException) as raised:
            document_api.delete_document_version(
                self.document_id, 2, self.user, self.db
            )

        self.assertEqual(raised.exception.status_code, 500)
        self.db.rollback.assert_called_once()
        storage_mock.delete.assert_called_once_with(self.version.s3_key)
        storage_mock.save.assert_called_once()
        self.assertEqual(self.document.current_version, 3)


if __name__ == "__main__":
    unittest.main()
