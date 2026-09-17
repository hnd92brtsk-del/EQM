from functools import lru_cache
import ipaddress
from pathlib import Path
from urllib.parse import urlparse

from pydantic import AliasChoices, AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent
MIN_JWT_SECRET_LENGTH = 32
INSECURE_SECRET_VALUES = {
    "",
    "change_me",
    "change_this_to_long_random_secret",
    "change_me_long_random_secret",
}
INSECURE_DB_PASSWORD_VALUES = {"", "change_me"}
INSECURE_POSTGRES_PASSWORD_VALUES = {"", "change_me", "postgres_password_here", "CHANGE_ME_POSTGRES_PASSWORD"}
INSECURE_SEED_PASSWORD_VALUES = {"", "admin12345", "CHANGE_ME_ADMIN_PASSWORD"}


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
    lm_studio_base_url: AnyHttpUrl = Field(
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
    llm_allowed_hosts: str = ""
    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin12345"
    allow_admin_password_reset: bool = False

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

    @field_validator("env", mode="before")
    @classmethod
    def _normalize_env(cls, value: str) -> str:
        return str(value).strip().lower()

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def llm_allowed_host_list(self) -> list[str]:
        return [item.strip().lower() for item in self.llm_allowed_hosts.split(",") if item.strip()]

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

    @staticmethod
    def _is_host_allowed_for_llm(host: str | None, allowed_hosts: list[str]) -> bool:
        if not host:
            return False

        normalized_host = host.strip().lower().rstrip(".")
        if normalized_host == "localhost":
            return True

        try:
            ip = ipaddress.ip_address(normalized_host)
        except ValueError:
            return normalized_host in allowed_hosts

        return ip.is_loopback or ip.is_private

    @model_validator(mode="after")
    def validate_security_constraints(self) -> "Settings":
        if self.env not in {"development", "production"}:
            raise ValueError("ENV must be either 'development' or 'production'")

        if not self.is_production:
            return self

        jwt_secret = self.jwt_secret.strip()
        if jwt_secret in INSECURE_SECRET_VALUES:
            raise ValueError("Production requires a non-default JWT_SECRET")
        if len(jwt_secret) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(f"Production JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters long")
        if self.db_password.strip() in INSECURE_DB_PASSWORD_VALUES:
            raise ValueError("Production requires a non-default DB_PASSWORD")
        if self.postgres_superuser_password.strip() in INSECURE_POSTGRES_PASSWORD_VALUES:
            raise ValueError("Production requires a non-default POSTGRES_SUPERUSER_PASSWORD")
        if self.seed_admin_password.strip() in INSECURE_SEED_PASSWORD_VALUES:
            raise ValueError("Production requires a non-default SEED_ADMIN_PASSWORD")

        llm_host = urlparse(str(self.lm_studio_base_url)).hostname
        if not self._is_host_allowed_for_llm(llm_host, self.llm_allowed_host_list):
            raise ValueError(
                "Production LM_STUDIO_BASE_URL must target localhost, a private network address, "
                "or a host listed in LLM_ALLOWED_HOSTS"
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
