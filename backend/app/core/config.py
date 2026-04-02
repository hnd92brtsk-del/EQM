from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent


def _resolve_path(base_dir: Path, raw_value: str) -> Path:
    path = Path(raw_value)
    if path.is_absolute():
        return path
    return (base_dir / path).resolve()


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "equipment_crm"
    db_user: str = "equipment_user"
    db_password: str = "change_me"
    postgres_superuser_password: str = "postgres_password_here"

    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 5
    env: str = "development"
    cors_origins: str = Field(
        "http://localhost:5173",
        validation_alias=AliasChoices("CORS_ORIGINS", "CORS_ALLOW_ORIGINS"),
    )
    upload_dir: str = "uploads"
    cabinet_files_dir: str = "storage/cabinet_files"
    cabinet_files_max_size: int | None = 10 * 1024 * 1024 * 1024
    photo_dir: str = "Photo"
    datasheet_dir: str = "Datasheets"
    pid_storage_root: str = "app/pid_storage"
    public_base_url: str | None = None
    frontend_public_url: str | None = None
    backend_public_url: str | None = None
    frontend_runtime_host: str = "localhost"
    frontend_runtime_port: int = 5173
    frontend_runtime_url: str | None = None
    backend_runtime_host: str = "localhost"
    backend_runtime_port: int = 8000
    backend_runtime_url: str | None = None
    lm_studio_base_url: HttpUrl = Field(
        "http://localhost:1234",
        validation_alias=AliasChoices("LM_STUDIO_BASE_URL", "LLM_BASE_URL"),
    )
    lm_studio_api_key: str | None = Field(
        None,
        validation_alias=AliasChoices("LM_STUDIO_API_KEY", "LLM_API_KEY"),
    )
    lm_model: str = Field(
        "phi-3-mini-4k-instruct",
        validation_alias=AliasChoices("LM_MODEL", "LLM_MODEL"),
    )
    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin12345"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            "postgresql+psycopg2://"
            f"{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def resolved_upload_dir(self) -> Path:
        return _resolve_path(BASE_DIR, self.upload_dir)

    @property
    def resolved_cabinet_files_dir(self) -> Path:
        return _resolve_path(BASE_DIR, self.cabinet_files_dir)

    @property
    def resolved_photo_dir(self) -> Path:
        return _resolve_path(PROJECT_ROOT, self.photo_dir)

    @property
    def resolved_datasheet_dir(self) -> Path:
        return _resolve_path(PROJECT_ROOT, self.datasheet_dir)

    @property
    def resolved_pid_storage_root(self) -> Path:
        return _resolve_path(BASE_DIR, self.pid_storage_root)

    @property
    def resolved_pid_images_dir(self) -> Path:
        return self.resolved_pid_storage_root / "images"

    @property
    def resolved_pid_diagrams_dir(self) -> Path:
        return self.resolved_pid_storage_root / "diagrams"

    @property
    def frontend_runtime_base_url(self) -> str:
        return self.frontend_runtime_url or f"http://{self.frontend_runtime_host}:{self.frontend_runtime_port}"

    @property
    def backend_runtime_base_url(self) -> str:
        return self.backend_runtime_url or f"http://{self.backend_runtime_host}:{self.backend_runtime_port}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
