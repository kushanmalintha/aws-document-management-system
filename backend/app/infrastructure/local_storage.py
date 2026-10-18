from pathlib import Path
from typing import BinaryIO

from app.services.storage_service import StorageService


class LocalStorage(StorageService):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_safe_path(self, storage_key: str) -> Path:
        requested_path = (self.base_path / storage_key).resolve()

        try:
            requested_path.relative_to(self.base_path)
        except ValueError as exc:
            raise ValueError("Invalid storage key") from exc

        return requested_path

    def save(
        self,
        file_object: BinaryIO,
        storage_key: str,
    ) -> None:
        destination = self._get_safe_path(storage_key)

        destination.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with destination.open("wb") as destination_file:
            while chunk := file_object.read(1024 * 1024):
                destination_file.write(chunk)

    def read(
        self,
        storage_key: str,
    ) -> BinaryIO:
        file_path = self._get_safe_path(storage_key)

        if not file_path.is_file():
            raise FileNotFoundError(
                f"Stored file not found: {storage_key}"
            )

        return file_path.open("rb")

    def delete(
        self,
        storage_key: str,
    ) -> None:
        file_path = self._get_safe_path(storage_key)

        if file_path.exists():
            file_path.unlink()

    def exists(
        self,
        storage_key: str,
    ) -> bool:
        file_path = self._get_safe_path(storage_key)

        return file_path.is_file()