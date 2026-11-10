import os
from pathlib import Path, PureWindowsPath
from typing import BinaryIO

from app.services.storage_service import StorageService


class LocalStorage(StorageService):
    def __init__(self, base_path: str):
        configured_root = Path(base_path).expanduser()
        configured_root.mkdir(parents=True, exist_ok=True)
        self.base_path = configured_root.resolve(strict=True)

    def _get_safe_path(self, storage_key: str) -> Path:
        if (
            not isinstance(storage_key, str)
            or not storage_key
            or chr(0) in storage_key
            or chr(92) in storage_key
            or storage_key.startswith("/")
            or PureWindowsPath(storage_key).is_absolute()
            or PureWindowsPath(storage_key).drive
        ):
            raise ValueError("Invalid storage key")

        parts = storage_key.split("/")
        if any(part in {"", ".", ".."} or ":" in part for part in parts):
            raise ValueError("Invalid storage key")

        candidate = self.base_path
        for part in parts:
            candidate = candidate / part
            if candidate.is_symlink():
                raise ValueError("Invalid storage key")

        resolved = candidate.resolve(strict=False)
        try:
            resolved.relative_to(self.base_path)
        except ValueError as exc:
            raise ValueError("Invalid storage key") from exc

        return resolved

    def save(self, file_object: BinaryIO, storage_key: str) -> None:
        destination = self._get_safe_path(storage_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination = self._get_safe_path(storage_key)

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_BINARY"):
            flags |= os.O_BINARY
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW

        descriptor = os.open(destination, flags, 0o600)
        try:
            with os.fdopen(descriptor, "wb") as destination_file:
                while chunk := file_object.read(1024 * 1024):
                    destination_file.write(chunk)
                destination_file.flush()
                os.fsync(destination_file.fileno())
        except Exception:
            try:
                destination.unlink(missing_ok=True)
            except OSError:
                pass
            raise

    def read(self, storage_key: str) -> BinaryIO:
        file_path = self._get_safe_path(storage_key)
        if not file_path.is_file():
            raise FileNotFoundError(f"Stored file not found: {storage_key}")

        flags = os.O_RDONLY
        if hasattr(os, "O_BINARY"):
            flags |= os.O_BINARY
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(file_path, flags)
        return os.fdopen(descriptor, "rb")

    def delete(self, storage_key: str) -> None:
        file_path = self._get_safe_path(storage_key)
        try:
            file_path.unlink()
        except FileNotFoundError:
            return

    def exists(self, storage_key: str) -> bool:
        file_path = self._get_safe_path(storage_key)
        return file_path.is_file()
