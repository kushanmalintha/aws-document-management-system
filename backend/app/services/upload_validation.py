import codecs
import hashlib
import mimetypes
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO


UPLOAD_CHUNK_SIZE = 1024 * 1024
OLE_COMPOUND_FILE_SIGNATURE = bytes.fromhex("D0CF11E0A1B11AE1")
PNG_SIGNATURE = bytes.fromhex("89504E470D0A1A0A")
OOXML_REQUIRED_PARTS = {
    ".docx": "word/document.xml",
    ".xlsx": "xl/workbook.xml",
    ".pptx": "ppt/presentation.xml",
}


class UploadValidationError(ValueError):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class UploadInspection:
    filename: str
    extension: str
    content_type: str
    size_bytes: int
    checksum: str


def normalize_upload_filename(
    raw_filename: str | None,
    allowed_extensions: tuple[str, ...] | list[str],
    max_length: int,
) -> tuple[str, str]:
    supplied_name = (raw_filename or "").replace("\\", "/")
    filename = supplied_name.rsplit("/", 1)[-1].strip()

    if (
        not filename
        or filename in {".", ".."}
        or any(ord(character) < 32 or ord(character) == 127 for character in filename)
        or ":" in filename
    ):
        raise UploadValidationError("A valid filename is required", 400)

    if len(filename) > max_length:
        raise UploadValidationError(
            f"Filename cannot exceed {max_length} characters",
            400,
        )

    extension = PurePosixPath(filename).suffix.lower()
    normalized_allowed = {item.lower() for item in allowed_extensions}
    if extension not in normalized_allowed:
        raise UploadValidationError(
            "This file extension is not allowed",
            415,
        )

    return filename, extension


def _validate_text_content(file_object: BinaryIO) -> None:
    decoder = codecs.getincrementaldecoder("utf-8-sig")("strict")
    file_object.seek(0)

    try:
        while chunk := file_object.read(UPLOAD_CHUNK_SIZE):
            if b"\x00" in chunk:
                raise UploadValidationError(
                    "The file content does not match its extension",
                    415,
                )
            decoded = decoder.decode(chunk, final=False)
            if any(
                ord(character) < 32 and character not in "\t\n\r\f"
                for character in decoded
            ):
                raise UploadValidationError(
                    "The file content does not match its extension",
                    415,
                )
        decoder.decode(b"", final=True)
    except UnicodeDecodeError as exc:
        raise UploadValidationError(
            "The file content does not match its extension",
            415,
        ) from exc
    finally:
        file_object.seek(0)


def _validate_ooxml_content(file_object: BinaryIO, extension: str) -> None:
    required_part = OOXML_REQUIRED_PARTS[extension]
    try:
        file_object.seek(0)
        with zipfile.ZipFile(file_object) as archive:
            names = set(archive.namelist())
            if "[Content_Types].xml" not in names or required_part not in names:
                raise UploadValidationError(
                    "The file content does not match its extension",
                    415,
                )
    except (zipfile.BadZipFile, OSError) as exc:
        raise UploadValidationError(
            "The file content does not match its extension",
            415,
        ) from exc
    finally:
        file_object.seek(0)


def _validate_file_content(
    file_object: BinaryIO,
    extension: str,
    prefix: bytes,
) -> None:
    if extension == ".pdf":
        valid = prefix.startswith(b"%PDF-")
    elif extension == ".png":
        valid = prefix.startswith(PNG_SIGNATURE)
    elif extension in {".jpg", ".jpeg"}:
        valid = prefix.startswith(bytes.fromhex("FFD8FF"))
    elif extension in {".doc", ".xls", ".ppt"}:
        valid = prefix.startswith(OLE_COMPOUND_FILE_SIGNATURE)
    elif extension in OOXML_REQUIRED_PARTS:
        _validate_ooxml_content(file_object, extension)
        return
    elif extension in {".txt", ".csv"}:
        _validate_text_content(file_object)
        return
    else:
        valid = False

    if not valid:
        raise UploadValidationError(
            "The file content does not match its extension",
            415,
        )


def inspect_upload(
    file_object: BinaryIO,
    filename: str,
    extension: str,
    max_size_bytes: int,
) -> UploadInspection:
    digest = hashlib.sha256()
    prefix = bytearray()
    size_bytes = 0

    file_object.seek(0)
    try:
        while chunk := file_object.read(UPLOAD_CHUNK_SIZE):
            size_bytes += len(chunk)
            if size_bytes > max_size_bytes:
                raise UploadValidationError(
                    "File exceeds the maximum upload size",
                    413,
                )
            digest.update(chunk)
            if len(prefix) < 8192:
                prefix.extend(chunk[: 8192 - len(prefix)])
    finally:
        file_object.seek(0)

    if size_bytes == 0:
        raise UploadValidationError("Empty files are not allowed", 400)

    _validate_file_content(file_object, extension, bytes(prefix))
    file_object.seek(0)

    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return UploadInspection(
        filename=filename,
        extension=extension,
        content_type=content_type,
        size_bytes=size_bytes,
        checksum=digest.hexdigest(),
    )
