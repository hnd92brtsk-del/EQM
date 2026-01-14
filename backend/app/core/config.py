from functools import lru_cache
from pathlib import Path
from pydantic import HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

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
    upload_dir: str = "uploads"
    cabinet_files_dir: str = "storage/cabinet_files"
    cabinet_files_max_size: int | None = 10 * 1024 * 1024 * 1024
    lm_studio_base_url: HttpUrl = "http://localhost:1234"
    lm_studio_api_key: str | None = None
    lm_model: str = "phi-3-mini-4k-instruct"

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        return (
            "postgresql+psycopg2://"
            f"{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
