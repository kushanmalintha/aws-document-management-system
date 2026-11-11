import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.activities import router as activities_router
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.main import app
from app.models.activity import Activity
from app.models.document import Document
from app.models.folder import Folder


class ActivityAndDocumentApiWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.document_id = uuid4()
        self.folder_id = uuid4()
        self.user = SimpleNamespace(id=self.user_id, role="user")
        self.db = Mock()
        self.query = Mock()
        self.query.filter.return_value = self.query
        self.query.order_by.return_value = self.query
        self.query.offset.return_value = self.query
        self.query.limit.return_value = self.query
        self.query.all.return_value = []
        self.db.query.return_value = self.query

        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def make_document(self, **overrides):
        values = {
            "id": self.document_id,
            "user_id": self.user_id,
            "folder_id": None,
            "name": "report.pdf",
            "content_type": "application/pdf",
            "size_bytes": 128,
            "current_version": 1,
            "status": "READY",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None,
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    def recorded_activities(self):
        return [
            call.args[0]
            for call in self.db.add.call_args_list
            if call.args and isinstance(call.args[0], Activity)
        ]

    def test_activity_list_is_authenticated_and_returns_user_scoped_records(self):
        activity = SimpleNamespace(
            id=uuid4(),
            user_id=self.user_id,
            document_id=self.document_id,
            action="DOCUMENT_RENAMED",
            metadata_json={"old_name": "old.pdf", "new_name": "report.pdf"},
            created_at=datetime.now(timezone.utc),
        )
        self.query.all.return_value = [activity]

        response = self.client.get("/api/activities?limit=10&offset=5")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["action"], "DOCUMENT_RENAMED")
        self.assertEqual(self.db.query.call_args.args[0], Activity)
        self.assertEqual(len(self.query.filter.call_args_list), 1)
        user_filter = self.query.filter.call_args.args[0]
        self.assertIn(self.user_id, user_filter.compile().params.values())
        self.query.offset.assert_called_once_with(5)
        self.query.limit.assert_called_once_with(10)

    def test_activity_list_can_filter_by_document(self):
        response = self.client.get(
            f"/api/activities?document_id={self.document_id}&limit=2&offset=1"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.query.filter.call_args_list), 2)
        filter_parameters = [
            call.args[0].compile().params
            for call in self.query.filter.call_args_list
        ]
        self.assertIn(self.user_id, filter_parameters[0].values())
        self.assertIn(self.document_id, filter_parameters[1].values())

    def test_activity_list_rejects_invalid_pagination(self):
        response = self.client.get("/api/activities?limit=101")
        self.assertEqual(response.status_code, 422)
        self.db.query.assert_not_called()

    def test_activity_list_rejects_unauthenticated_request(self):
        app.dependency_overrides.pop(get_current_user)
        response = self.client.get("/api/activities")
        self.assertEqual(response.status_code, 401)

    def test_document_rename_api_updates_name_and_records_activity(self):
        document = self.make_document()
        self.db.get.return_value = document

        response = self.client.patch(
            f"/api/documents/{self.document_id}",
            json={"name": "annual-report.pdf"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "annual-report.pdf")
        self.db.commit.assert_called_once()
        events = self.recorded_activities()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].action, "DOCUMENT_RENAMED")
        self.assertEqual(events[0].metadata_json["old_name"], "report.pdf")

    def test_document_move_api_can_move_document_to_root(self):
        old_folder_id = uuid4()
        document = self.make_document(folder_id=old_folder_id)
        self.db.get.return_value = document

        response = self.client.patch(
            f"/api/documents/{self.document_id}/move",
            json={"folder_id": None},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["folder_id"])
        events = self.recorded_activities()
        self.assertEqual(events[0].action, "DOCUMENT_MOVED")
        self.assertEqual(
            events[0].metadata_json["old_folder_id"], str(old_folder_id)
        )
        self.assertIsNone(events[0].metadata_json["new_folder_id"])

    def test_document_rename_api_rejects_another_users_document(self):
        document = self.make_document(user_id=self.other_user_id)
        self.db.get.return_value = document

        response = self.client.patch(
            f"/api/documents/{self.document_id}",
            json={"name": "private-report.pdf"},
        )

        self.assertEqual(response.status_code, 403)
        self.db.commit.assert_not_called()
        self.assertEqual(self.recorded_activities(), [])

    def test_document_move_api_rejects_another_users_destination_folder(self):
        document = self.make_document()
        foreign_folder = SimpleNamespace(
            id=self.folder_id,
            user_id=self.other_user_id,
        )

        def get_model(model, object_id):
            if model is Document:
                return document
            if model is Folder:
                return foreign_folder
            return None

        self.db.get.side_effect = get_model
        response = self.client.patch(
            f"/api/documents/{self.document_id}/move",
            json={"folder_id": str(self.folder_id)},
        )

        self.assertEqual(response.status_code, 403)
        self.db.commit.assert_not_called()
        self.assertEqual(self.recorded_activities(), [])


class FolderActivityApiWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.folder_id = uuid4()
        self.user = SimpleNamespace(id=self.user_id, role="user")
        self.folder = SimpleNamespace(
            id=self.folder_id,
            user_id=self.user_id,
            parent_folder_id=None,
            name="reports",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.db = Mock()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def recorded_activities(self):
        return [
            call.args[0]
            for call in self.db.add.call_args_list
            if call.args and isinstance(call.args[0], Activity)
        ]

    def test_folder_create_api_records_activity(self):
        def refresh(instance):
            instance.id = self.folder_id
            instance.created_at = self.folder.created_at
            instance.updated_at = self.folder.updated_at

        self.db.refresh.side_effect = refresh
        response = self.client.post(
            "/api/folders",
            json={"name": "  reports  ", "parent_folder_id": None},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["name"], "reports")
        self.assertEqual(self.recorded_activities()[0].action, "FOLDER_CREATED")

    def test_folder_rename_api_records_activity(self):
        self.db.get.return_value = self.folder
        response = self.client.put(
            f"/api/folders/{self.folder_id}",
            json={"name": "annual reports"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "annual reports")
        events = self.recorded_activities()
        self.assertEqual(events[0].action, "FOLDER_RENAMED")
        self.assertEqual(events[0].metadata_json["name"], "annual reports")

    def test_folder_delete_api_records_activity(self):
        self.db.get.return_value = self.folder
        response = self.client.delete(f"/api/folders/{self.folder_id}")

        self.assertEqual(response.status_code, 204)
        self.db.delete.assert_called_once_with(self.folder)
        self.assertEqual(self.recorded_activities()[0].action, "FOLDER_DELETED")


if __name__ == "__main__":
    unittest.main()
