from app.core.config import settings
from app.infrastructure.local_storage import LocalStorage
from app.services.storage_service import StorageService


storage_service: StorageService = LocalStorage(
    settings.local_storage_path
)