from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageService(ABC):
    @abstractmethod
    def save(
        self,
        file_object: BinaryIO,
        storage_key: str,
    ) -> None:
        """
        Save a file using the specified storage key.
        """
        raise NotImplementedError

    @abstractmethod
    def read(
        self,
        storage_key: str,
    ) -> BinaryIO:
        """
        Open and return a stored file.
        """
        raise NotImplementedError

    @abstractmethod
    def delete(
        self,
        storage_key: str,
    ) -> None:
        """
        Delete a stored file.
        """
        raise NotImplementedError

    @abstractmethod
    def exists(
        self,
        storage_key: str,
    ) -> bool:
        """
        Check whether a stored file exists.
        """
        raise NotImplementedError