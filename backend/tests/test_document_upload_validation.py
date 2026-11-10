import hashlib
import unittest
import zipfile
from io import BytesIO

from app.services.upload_validation import (
    UploadValidationError,
    inspect_upload,
    normalize_upload_filename,
)


class UploadValidationTests(unittest.TestCase):
    def inspect(self, filename, content, maximum=1024 * 1024):
        extension = "." + filename.rsplit(".", 1)[-1].lower()
        return inspect_upload(BytesIO(content), filename, extension, maximum)

    def test_normalizes_windows_client_filename(self):
        name, extension = normalize_upload_filename(
            "C:\\fakepath\\report.PDF", (".pdf", ".txt"), 255
        )
        self.assertEqual(name, "report.PDF")
        self.assertEqual(extension, ".pdf")

    def test_rejects_missing_invalid_and_overlong_filenames(self):
        cases = ((None, 255), ("..", 255), ("bad:name.pdf", 255), ("a.pdf", 4))
        for filename, maximum in cases:
            with self.subTest(filename=filename):
                with self.assertRaises(UploadValidationError):
                    normalize_upload_filename(filename, (".pdf",), maximum)

    def test_rejects_disallowed_extension(self):
        with self.assertRaises(UploadValidationError) as raised:
            normalize_upload_filename("script.exe", (".pdf",), 255)
        self.assertEqual(raised.exception.status_code, 415)

    def test_rejects_empty_file(self):
        with self.assertRaises(UploadValidationError) as raised:
            self.inspect("empty.pdf", b"")
        self.assertEqual(raised.exception.status_code, 400)

    def test_rejects_oversized_file(self):
        with self.assertRaises(UploadValidationError) as raised:
            self.inspect("large.txt", b"12345", maximum=4)
        self.assertEqual(raised.exception.status_code, 413)

    def test_rejects_content_extension_mismatch(self):
        with self.assertRaises(UploadValidationError) as raised:
            self.inspect("fake.pdf", b"plain text")
        self.assertEqual(raised.exception.status_code, 415)

    def test_accepts_pdf_and_calculates_sha256(self):
        content = b"%PDF-1.7\nminimal test"
        result = self.inspect("sample.pdf", content)
        self.assertEqual(result.size_bytes, len(content))
        self.assertEqual(result.checksum, hashlib.sha256(content).hexdigest())
        self.assertEqual(result.content_type, "application/pdf")

    def test_accepts_utf8_text_and_csv(self):
        self.assertEqual(self.inspect("notes.txt", b"Hello").size_bytes, 5)
        self.assertEqual(
            self.inspect("rows.csv", b"name,value\nAda,1").content_type,
            "text/csv",
        )

    def test_rejects_binary_data_disguised_as_text(self):
        with self.assertRaises(UploadValidationError):
            self.inspect("notes.txt", b"hello\x00world")

    def test_accepts_png_signature(self):
        result = self.inspect(
            "image.png", bytes.fromhex("89504E470D0A1A0A") + b"data"
        )
        self.assertEqual(result.content_type, "image/png")

    def test_accepts_legacy_office_compound_signature(self):
        content = bytes.fromhex("D0CF11E0A1B11AE1") + b"office"
        self.assertEqual(self.inspect("file.doc", content).extension, ".doc")

    def test_accepts_ooxml_document_container(self):
        content = BytesIO()
        with zipfile.ZipFile(content, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", "<document/>")
        result = self.inspect("document.docx", content.getvalue())
        self.assertEqual(result.extension, ".docx")

    def test_rejects_arbitrary_zip_as_docx(self):
        content = BytesIO()
        with zipfile.ZipFile(content, "w") as archive:
            archive.writestr("notes.txt", "not a document")
        with self.assertRaises(UploadValidationError):
            self.inspect("document.docx", content.getvalue())


if __name__ == "__main__":
    unittest.main()
