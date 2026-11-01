import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from app.infrastructure.local_storage import LocalStorage


class LocalStorageTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.storage_root = Path(self.temporary_directory.name) / "storage"
        self.storage = LocalStorage(str(self.storage_root))

    def test_save_read_and_delete_nested_binary_file(self):
        storage_key = "documents/reports/report.pdf"
        content = b"\x00\x01sample document\xff"

        self.storage.save(BytesIO(content), storage_key)

        self.assertTrue(self.storage.exists(storage_key))
        with self.storage.read(storage_key) as stored_file:
            self.assertEqual(stored_file.read(), content)

        self.storage.delete(storage_key)

        self.assertFalse(self.storage.exists(storage_key))

    def test_save_overwrites_the_existing_file(self):
        storage_key = "documents/report.txt"
        self.storage.save(BytesIO(b"first"), storage_key)
        self.storage.save(BytesIO(b"replacement"), storage_key)

        with self.storage.read(storage_key) as stored_file:
            self.assertEqual(stored_file.read(), b"replacement")

    def test_read_missing_file_raises_file_not_found(self):
        with self.assertRaisesRegex(
            FileNotFoundError,
            "Stored file not found: missing.pdf",
        ):
            self.storage.read("missing.pdf")

    def test_delete_missing_file_is_safe(self):
        self.storage.delete("missing.pdf")
        self.assertFalse(self.storage.exists("missing.pdf"))

    def test_rejects_paths_outside_the_storage_root(self):
        for storage_key in ("../outside.txt", r"..\outside.txt"):
            with self.subTest(storage_key=storage_key):
                with self.assertRaisesRegex(ValueError, "Invalid storage key"):
                    self.storage.save(BytesIO(b"unsafe"), storage_key)

        self.assertFalse((self.storage_root.parent / "outside.txt").exists())


if __name__ == "__main__":
    unittest.main()
