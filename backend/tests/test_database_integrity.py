"""PostgreSQL integration tests for database ownership and integrity rules.

Set TEST_DATABASE_URL to a dedicated disposable PostgreSQL database whose name
contains 'test'. The suite drops and recreates application tables in that DB.
It deliberately skips when no dedicated test URL is configured.
"""
import os
import unittest
import warnings
from uuid import uuid4

from sqlalchemy import create_engine, delete
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SAWarning
from sqlalchemy.orm import configure_mappers, sessionmaker
from sqlalchemy.schema import CreateTable

from app.db.database import Base, DATABASE_URL
from app.models import Activity, Document, DocumentShare, DocumentVersion, Folder, User


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


class DatabaseMetadataTests(unittest.TestCase):
    def test_model_mappers_configure_without_relationship_warnings(self):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always", SAWarning)
            configure_mappers()
        mapper_warnings = [
            warning for warning in caught
            if issubclass(warning.category, SAWarning)
        ]
        self.assertEqual(mapper_warnings, [])

    def test_ownership_constraints_are_present_in_model_metadata(self):
        expected = {
            "folders": "fk_folders_parent_folder_owner",
            "documents": "fk_documents_folder_owner",
            "activities": "fk_activities_document_owner",
            "document_shares": "fk_document_shares_document_owner",
        }
        for table_name, constraint_name in expected.items():
            with self.subTest(table=table_name):
                constraints = {
                    constraint.name
                    for constraint in Base.metadata.tables[table_name].foreign_key_constraints
                }
                self.assertIn(constraint_name, constraints)

    def test_value_checks_and_nullable_storage_key_are_declared(self):
        expected_checks = {
            "users": {"ck_users_token_version_non_negative"},
            "documents": {
                "ck_documents_size_bytes_positive",
                "ck_documents_current_version_positive",
                "ck_documents_status_valid",
            },
            "document_versions": {
                "ck_document_versions_version_number_positive",
                "ck_document_versions_size_bytes_positive",
            },
        }
        for table_name, names in expected_checks.items():
            actual = {
                constraint.name
                for constraint in Base.metadata.tables[table_name].constraints
                if constraint.__class__.__name__ == "CheckConstraint"
            }
            self.assertTrue(names.issubset(actual), (table_name, names - actual))
        self.assertTrue(Base.metadata.tables["documents"].c.s3_key.nullable)

    def test_folder_delete_action_only_nulls_document_folder_id(self):
        document_table = Base.metadata.tables["documents"]
        folder_fk = next(
            constraint for constraint in document_table.foreign_key_constraints
            if constraint.name == "fk_documents_folder_owner"
        )
        self.assertEqual(folder_fk.ondelete, "SET NULL (folder_id)")
        ddl = str(CreateTable(document_table).compile(dialect=postgresql.dialect()))
        self.assertIn("ON DELETE SET NULL (folder_id)", ddl)


def _create_test_engine():
    if not TEST_DATABASE_URL:
        raise unittest.SkipTest("Set TEST_DATABASE_URL to run PostgreSQL integrity tests")

    test_url = make_url(TEST_DATABASE_URL)
    if not test_url.database or "test" not in test_url.database.lower():
        raise RuntimeError(
            "TEST_DATABASE_URL must target a dedicated database with 'test' in its name"
        )

    configured = DATABASE_URL
    target_identity = (test_url.host, test_url.port, test_url.database)
    application_identity = (configured.host, configured.port, configured.database)
    if target_identity == application_identity:
        raise RuntimeError("TEST_DATABASE_URL must not point to the application database")

    if test_url.drivername not in {"postgresql", "postgresql+psycopg"}:
        raise RuntimeError("TEST_DATABASE_URL must use PostgreSQL")

    return create_engine(test_url, pool_pre_ping=True)


@unittest.skipUnless(TEST_DATABASE_URL, "Set TEST_DATABASE_URL to run PostgreSQL integrity tests")
class DatabaseIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = _create_test_engine()
        Base.metadata.drop_all(cls.engine)
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(
            bind=cls.engine, autoflush=False, expire_on_commit=False
        )

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "engine"):
            Base.metadata.drop_all(cls.engine)
            cls.engine.dispose()

    def setUp(self):
        self.db = self.Session()
        for model in (Activity, DocumentShare, DocumentVersion, Document, Folder, User):
            self.db.execute(delete(model))
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def make_user(self, label="user"):
        user = User(
            email=f"{label}-{uuid4().hex}@example.test",
            password_hash="test-hash",
            display_name=label,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def make_document(self, user, folder_id=None):
        document = Document(
            user_id=user.id,
            folder_id=folder_id,
            name="report.pdf",
            content_type="application/pdf",
            size_bytes=10,
        )
        self.db.add(document)
        self.db.flush()
        return document

    def assert_integrity_error(self, instance):
        self.db.add(instance)
        with self.assertRaises(IntegrityError):
            self.db.flush()
        self.db.rollback()

    def test_root_and_same_owner_nested_folders_are_valid(self):
        user = self.make_user()
        root = Folder(user_id=user.id, name="root")
        self.db.add(root)
        self.db.flush()
        child = Folder(user_id=user.id, parent_folder_id=root.id, name="child")
        self.db.add(child)
        self.db.commit()
        self.assertEqual(child.parent_folder_id, root.id)

    def test_folder_cannot_reference_another_users_parent(self):
        owner = self.make_user("owner")
        other = self.make_user("other")
        parent = Folder(user_id=owner.id, name="private")
        self.db.add(parent)
        self.db.flush()
        self.assert_integrity_error(
            Folder(user_id=other.id, parent_folder_id=parent.id, name="intruder")
        )

    def test_root_and_own_folder_documents_are_valid(self):
        user = self.make_user()
        folder = Folder(user_id=user.id, name="reports")
        self.db.add(folder)
        self.db.flush()
        root_document = self.make_document(user)
        folder_document = self.make_document(user, folder.id)
        self.db.commit()
        self.assertIsNone(root_document.folder_id)
        self.assertEqual(folder_document.folder_id, folder.id)

    def test_document_cannot_reference_another_users_folder(self):
        owner = self.make_user("owner")
        other = self.make_user("other")
        folder = Folder(user_id=owner.id, name="private")
        self.db.add(folder)
        self.db.flush()
        self.assert_integrity_error(self._invalid_document(other, folder.id))

    def _invalid_document(self, user, folder_id):
        return Document(
            user_id=user.id, folder_id=folder_id, name="bad.pdf",
            content_type="application/pdf", size_bytes=10,
        )

    def test_document_size_current_version_and_status_checks(self):
        user = self.make_user()
        self.db.commit()
        for values in (
            {"size_bytes": 0},
            {"current_version": 0},
            {"status": "UNKNOWN"},
        ):
            with self.subTest(values=values):
                fields = {
                    "size_bytes": 10,
                    "current_version": 1,
                    "status": "PENDING_UPLOAD",
                }
                fields.update(values)
                document = Document(
                    user_id=user.id,
                    name="bad.pdf",
                    content_type="application/pdf",
                    **fields,
                )
                self.assert_integrity_error(document)

    def test_document_versions_require_positive_values_and_unique_numbers(self):
        user = self.make_user()
        document = self.make_document(user)
        valid = DocumentVersion(
            document_id=document.id, version_number=1, s3_key="v1", size_bytes=10
        )
        self.db.add(valid)
        self.db.commit()
        self.assert_integrity_error(DocumentVersion(
            document_id=document.id, version_number=1, s3_key="duplicate", size_bytes=10
        ))
        self.assert_integrity_error(DocumentVersion(
            document_id=document.id, version_number=0, s3_key="zero", size_bytes=10
        ))
        self.assert_integrity_error(DocumentVersion(
            document_id=document.id, version_number=2, s3_key="empty", size_bytes=0
        ))

    def test_activity_can_be_user_only_or_reference_users_own_document(self):
        user = self.make_user()
        document = self.make_document(user)
        self.db.add(Activity(user_id=user.id, action="PROFILE_UPDATED"))
        self.db.add(Activity(user_id=user.id, document_id=document.id, action="VIEWED"))
        self.db.commit()
        self.assertEqual(self.db.query(Activity).count(), 2)

    def test_activity_cannot_reference_another_users_document(self):
        owner = self.make_user("owner")
        other = self.make_user("other")
        document = self.make_document(owner)
        self.assert_integrity_error(
            Activity(user_id=other.id, document_id=document.id, action="FORGED")
        )

    def test_share_owner_must_own_the_document(self):
        owner = self.make_user("owner")
        recipient = self.make_user("recipient")
        other = self.make_user("other")
        document = self.make_document(owner)
        valid = DocumentShare(
            document_id=document.id,
            owner_id=owner.id,
            shared_with_user_id=recipient.id,
        )
        self.db.add(valid)
        self.db.commit()
        self.assert_integrity_error(DocumentShare(
            document_id=document.id,
            owner_id=other.id,
            shared_with_user_id=recipient.id,
        ))

    def test_deleting_folder_tree_preserves_documents_as_unfiled(self):
        user = self.make_user()
        parent = Folder(user_id=user.id, name="parent")
        self.db.add(parent)
        self.db.flush()
        child = Folder(user_id=user.id, parent_folder_id=parent.id, name="child")
        self.db.add(child)
        self.db.flush()
        document = self.make_document(user, child.id)
        document_id = document.id
        child_id = child.id
        self.db.commit()

        self.db.delete(parent)
        self.db.commit()
        self.db.expire_all()

        self.assertIsNone(self.db.get(Folder, child_id))
        retained_document = self.db.get(Document, document_id)
        self.assertIsNotNone(retained_document)
        self.assertEqual(retained_document.user_id, user.id)
        self.assertIsNone(retained_document.folder_id)

    def test_failed_transaction_does_not_persist_invalid_document(self):
        owner = self.make_user("owner")
        other = self.make_user("other")
        folder = Folder(user_id=owner.id, name="private")
        self.db.add(folder)
        self.db.commit()
        invalid = self._invalid_document(other, folder.id)
        invalid_id = uuid4()
        invalid.id = invalid_id
        self.db.add(invalid)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()
        self.assertIsNone(self.db.get(Document, invalid_id))

    def test_user_token_version_must_be_non_negative(self):
        user = self.make_user()
        self.db.commit()
        self.assert_integrity_error(User(
            email=f"negative-{uuid4().hex}@example.test",
            password_hash="test-hash",
            display_name="negative",
            token_version=-1,
        ))
        self.assertGreaterEqual(user.token_version, 0)


if __name__ == "__main__":
    unittest.main()
