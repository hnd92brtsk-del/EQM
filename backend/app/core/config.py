from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent


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
    cors_allow_origins: str = "http://localhost:5173"
    photo_dir: str = "Photo"
    datasheet_dir: str = "Datasheets"
    upload_dir: str = "backend/uploads"
    cabinet_files_dir: str = "backend/storage/cabinet_files"
    pid_storage_root: str = "backend/app/pid_storage"
    cabinet_files_max_size: int | None = 10 * 1024 * 1024 * 1024
    llm_base_url: HttpUrl = Field(
        "http://localhost:1234",
        validation_alias=AliasChoices("LLM_BASE_URL", "LM_STUDIO_BASE_URL"),
    )
    llm_api_key: str | None = Field(
        None,
        validation_alias=AliasChoices("LLM_API_KEY", "LM_STUDIO_API_KEY"),
    )
    llm_model: str = Field(
        "phi3-mini-4k-instruct",
        validation_alias=AliasChoices("LLM_MODEL", "LM_MODEL"),
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
    def cors_allow_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allow_origins.split(",") if item.strip()]

    def resolve_project_path(self, raw_path: str) -> Path:
        path = Path(raw_path)
        if path.is_absolute():
            return path
        return PROJECT_ROOT / path

    @property
    def photo_dir_path(self) -> Path:
        return self.resolve_project_path(self.photo_dir)

    @property
    def datasheet_dir_path(self) -> Path:
        return self.resolve_project_path(self.datasheet_dir)

    @property
    def upload_dir_path(self) -> Path:
        return self.resolve_project_path(self.upload_dir)

    @property
    def cabinet_files_dir_path(self) -> Path:
        return self.resolve_project_path(self.cabinet_files_dir)

    @property
    def pid_storage_root_path(self) -> Path:
        return self.resolve_project_path(self.pid_storage_root)

    @property
    def pid_images_dir_path(self) -> Path:
        return self.pid_storage_root_path / "images"

    @property
    def llm_api_base_url(self) -> str:
        base_url = str(self.llm_base_url).rstrip("/")
        if base_url.endswith("/v1"):
            return base_url
        return f"{base_url}/v1"

    @property
    def llm_chat_completions_url(self) -> str:
        return f"{self.llm_api_base_url}/chat/completions"

@lru_cache
def get_settings() -> Settings:
    return Settings()
