import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from app.infrastructure.local_storage import LocalStorage


class FailingReader:
    def __init__(self):
        self.calls = 0

    def read(self, size=-1):
        self.calls += 1
        if self.calls == 1:
            return b"partial content"
        raise OSError("simulated read failure")


class LocalStorageTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.storage_root = Path(self.temporary_directory.name) / "storage"
        self.storage = LocalStorage(str(self.storage_root))

    def test_save_read_and_delete_nested_binary_file(self):
        storage_key = "documents/reports/report.pdf"
        content = bytes((0, 1)) + b"sample document" + bytes((255,))
        self.storage.save(BytesIO(content), storage_key)
        self.assertTrue(self.storage.exists(storage_key))
        with self.storage.read(storage_key) as stored_file:
            self.assertEqual(stored_file.read(), content)
        self.storage.delete(storage_key)
        self.assertFalse(self.storage.exists(storage_key))

    def test_save_does_not_overwrite_existing_file(self):
        storage_key = "documents/report.txt"
        self.storage.save(BytesIO(b"first"), storage_key)
        with self.assertRaises(FileExistsError):
            self.storage.save(BytesIO(b"replacement"), storage_key)
        with self.storage.read(storage_key) as stored_file:
            self.assertEqual(stored_file.read(), b"first")

    def test_partial_write_is_removed_after_source_failure(self):
        storage_key = "documents/partial.txt"
        with self.assertRaisesRegex(OSError, "simulated read failure"):
            self.storage.save(FailingReader(), storage_key)
        self.assertFalse(self.storage.exists(storage_key))

    def test_read_missing_file_raises_file_not_found(self):
        with self.assertRaisesRegex(FileNotFoundError, "Stored file not found: missing.pdf"):
            self.storage.read("missing.pdf")

    def test_delete_missing_file_is_safe(self):
        self.storage.delete("missing.pdf")
        self.assertFalse(self.storage.exists("missing.pdf"))

    def test_rejects_traversal_and_absolute_paths(self):
        invalid_keys = (
            "../outside.txt",
            "..\\\\outside.txt",
            "/outside.txt",
            "C:\\\\outside.txt",
            "documents/../outside.txt",
            "documents//report.txt",
            "documents/./report.txt",
        )
        for storage_key in invalid_keys:
            with self.subTest(storage_key=storage_key):
                with self.assertRaisesRegex(ValueError, "Invalid storage key"):
                    self.storage.save(BytesIO(b"unsafe"), storage_key)
        self.assertFalse((self.storage_root.parent / "outside.txt").exists())

    def test_rejects_symlink_inside_root(self):
        target = self.storage_root / "real"
        target.mkdir()
        link = self.storage_root / "linked"
        try:
            link.symlink_to(target, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Directory symlinks are not available")
        with self.assertRaisesRegex(ValueError, "Invalid storage key"):
            self.storage.save(BytesIO(b"unsafe"), "linked/file.txt")

    def test_rejects_symlink_escape(self):
        outside = Path(self.temporary_directory.name) / "outside"
        outside.mkdir()
        link = self.storage_root / "escape"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Directory symlinks are not available")
        with self.assertRaisesRegex(ValueError, "Invalid storage key"):
            self.storage.save(BytesIO(b"unsafe"), "escape/file.txt")
        self.assertFalse((outside / "file.txt").exists())


if __name__ == "__main__":
    unittest.main()
