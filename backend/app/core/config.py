from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AWS Document Management System"
    environment: str = "development"

    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int

    jwt_secret_key: str
    jwt_algorithm: str
    jwt_access_token_expire_minutes: int

    local_storage_path: str = "local_storage"

    max_upload_size_bytes: int = 10 * 1024 * 1024

    allowed_document_extensions: tuple[str, ...] = (
        ".pdf",
        ".txt",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".csv",
        ".png",
        ".jpg",
        ".jpeg",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()