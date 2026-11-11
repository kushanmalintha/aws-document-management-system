from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


LOCAL_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
)


class Settings(BaseSettings):
    app_name: str = "AWS Document Management System"
    environment: str = "development"
    log_level: str = "INFO"

    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30

    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: list(LOCAL_CORS_ORIGINS)
    )

    local_storage_path: str = "local_storage"
    max_upload_size_bytes: int = 10 * 1024 * 1024
    max_upload_filename_length: int = 255

    allowed_document_extensions: tuple[str, ...] = (
        ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx",
        ".ppt", ".pptx", ".csv", ".png", ".jpg", ".jpeg",
    )

    @field_validator("app_name")
    @classmethod
    def validate_app_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("APP_NAME must not be empty")
        return value

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"development", "testing", "production"}:
            raise ValueError("ENVIRONMENT must be development, testing, or production")
        return value

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR, or CRITICAL")
        return normalized

    @field_validator("postgres_port")
    @classmethod
    def validate_postgres_port(cls, value: int) -> int:
        if not 1 <= value <= 65535:
            raise ValueError("POSTGRES_PORT must be between 1 and 65535")
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET_KEY must contain at least 32 characters")
        if value.strip().lower() in {
            "change_me", "changeme", "secret", "your_secret_key",
            "replace_with_a_secure_generated_secret",
        }:
            raise ValueError("JWT_SECRET_KEY must not use a placeholder value")
        return value

    @field_validator("jwt_algorithm")
    @classmethod
    def validate_jwt_algorithm(cls, value: str) -> str:
        if value != "HS256":
            raise ValueError("JWT_ALGORITHM must be HS256")
        return value

    @field_validator("jwt_access_token_expire_minutes")
    @classmethod
    def validate_jwt_expiry(cls, value: int) -> int:
        if not 1 <= value <= 1440:
            raise ValueError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be between 1 and 1440")
        return value

    @field_validator("max_upload_size_bytes")
    @classmethod
    def validate_upload_size(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("MAX_UPLOAD_SIZE_BYTES must be positive")
        return value

    @field_validator("max_upload_filename_length")
    @classmethod
    def validate_upload_filename_length(cls, value: int) -> int:
        if not 1 <= value <= 255:
            raise ValueError("MAX_UPLOAD_FILENAME_LENGTH must be between 1 and 255")
        return value

    @field_validator("allowed_document_extensions")
    @classmethod
    def validate_allowed_extensions(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(item.strip().lower() for item in value)
        if not normalized or any(
            not item.startswith(".") or len(item) < 2 or "/" in item or chr(92) in item
            for item in normalized
        ):
            raise ValueError("ALLOWED_DOCUMENT_EXTENSIONS must contain valid dotted extensions")
        if len(set(normalized)) != len(normalized):
            raise ValueError("ALLOWED_DOCUMENT_EXTENSIONS must not contain duplicates")
        return normalized

    @field_validator("cors_allowed_origins")
    @classmethod
    def validate_cors_origins(cls, value: list[str]) -> list[str]:
        normalized = []
        for origin in value:
            origin = origin.strip().rstrip("/")
            if not origin or origin == "*" or not origin.startswith(("http://", "https://")):
                raise ValueError("CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) origins; wildcard is not allowed")
            if "/" in origin.split("://", 1)[1]:
                raise ValueError("CORS origins must not contain a path")
            if origin not in normalized:
                normalized.append(origin)
        return normalized

    @model_validator(mode="after")
    def validate_environment_settings(self):
        if self.environment == "production" and not self.cors_allowed_origins:
            raise ValueError("Production requires explicit CORS_ALLOWED_ORIGINS")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
