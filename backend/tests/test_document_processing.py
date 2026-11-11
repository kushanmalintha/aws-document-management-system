import hashlib
import unittest
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import BackgroundTasks

from app.models.document import DocumentStatus
from app.services import document_processing


class DocumentProcessingTests(unittest.TestCase):
    def setUp(self):
        self.document_id = uuid4()
        self.user_id = uuid4()
        self.document = SimpleNamespace(
            id=self.document_id,
            user_id=self.user_id,
            deleted_at=None,
            current_version=2,
            status=DocumentStatus.UPLOADED,
        )
        self.version = SimpleNamespace(
            document_id=self.document_id,
            version_number=2,
            s3_key="documents/user/document/v2/file.pdf",
            checksum=hashlib.sha256(b"pdf-content").hexdigest(),
        )

        self.document_query = Mock()
        self.document_query.filter.return_value.with_for_update.return_value.first.return_value = (
            self.document
        )
        self.version_query = Mock()
        self.version_query.filter.return_value.first.return_value = self.version

        self.db = Mock()
        self.db.query.side_effect = [self.document_query, self.version_query, self.document_query]

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.storage_service")
    @patch("app.services.document_processing.SessionLocal")
    def test_successful_processing_sets_ready_and_records_activity(
        self, session_factory, storage_mock, activity_mock
    ):
        session_factory.return_value = self.db
        storage_mock.read.return_value = BytesIO(b"pdf-content")

        document_processing.process_document(self.document_id, 2)

        self.assertEqual(self.document.status, DocumentStatus.READY)
        self.assertEqual(self.db.commit.call_count, 2)
        activity_mock.assert_called_once()
        self.assertEqual(
            activity_mock.call_args.kwargs["action"],
            "DOCUMENT_PROCESSING_COMPLETED",
        )
        self.db.close.assert_called_once()

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.storage_service")
    @patch("app.services.document_processing.SessionLocal")
    def test_missing_file_sets_failed(
        self, session_factory, storage_mock, activity_mock
    ):
        session_factory.return_value = self.db
        storage_mock.read.side_effect = FileNotFoundError("missing")

        document_processing.process_document(self.document_id, 2)

        self.assertEqual(self.document.status, DocumentStatus.FAILED)
        self.assertEqual(
            activity_mock.call_args.kwargs["action"],
            "DOCUMENT_PROCESSING_FAILED",
        )

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.storage_service")
    @patch("app.services.document_processing.SessionLocal")
    def test_checksum_mismatch_sets_failed(
        self, session_factory, storage_mock, activity_mock
    ):
        session_factory.return_value = self.db
        storage_mock.read.return_value = BytesIO(b"different-content")

        document_processing.process_document(self.document_id, 2)

        self.assertEqual(self.document.status, DocumentStatus.FAILED)
        self.assertIn(
            "checksum",
            activity_mock.call_args.kwargs["metadata_json"]["reason"].lower(),
        )

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.SessionLocal")
    def test_deleted_document_is_skipped(self, session_factory, activity_mock):
        self.document.deleted_at = object()
        session_factory.return_value = self.db

        document_processing.process_document(self.document_id, 2)

        self.db.commit.assert_not_called()
        activity_mock.assert_not_called()

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.SessionLocal")
    def test_stale_version_task_is_skipped(self, session_factory, activity_mock):
        self.document.current_version = 3
        session_factory.return_value = self.db

        document_processing.process_document(self.document_id, 2)

        self.db.commit.assert_not_called()
        activity_mock.assert_not_called()

    @patch("app.services.document_processing.record_activity")
    @patch("app.services.document_processing.SessionLocal")
    def test_non_uploaded_document_is_skipped(self, session_factory, activity_mock):
        self.document.status = DocumentStatus.READY
        session_factory.return_value = self.db

        document_processing.process_document(self.document_id, 2)

        self.db.commit.assert_not_called()
        activity_mock.assert_not_called()


    def test_initial_upload_processing_task_is_scheduled(self):
        tasks = BackgroundTasks()
        document_processing.schedule_document_processing(
            tasks, self.document_id, 1
        )
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, document_processing.process_document)
        self.assertEqual(tasks.tasks[0].args, (self.document_id, 1))

    def test_new_version_processing_task_is_scheduled(self):
        tasks = BackgroundTasks()
        document_processing.schedule_document_processing(
            tasks, self.document_id, 3
        )
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, document_processing.process_document)
        self.assertEqual(tasks.tasks[0].args, (self.document_id, 3))

    def test_invalid_status_transition_is_rejected(self):
        self.document.status = DocumentStatus.DELETED

        with self.assertRaises(ValueError):
            document_processing.transition_document_status(
                self.document, DocumentStatus.PROCESSING
            )

    def test_new_version_can_reset_ready_document_to_uploaded(self):
        self.document.status = DocumentStatus.READY

        document_processing.transition_document_status(
            self.document, DocumentStatus.UPLOADED
        )

        self.assertEqual(self.document.status, DocumentStatus.UPLOADED)


if __name__ == "__main__":
    unittest.main()
