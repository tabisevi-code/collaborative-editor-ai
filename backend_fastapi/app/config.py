from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Collaborative Editor AI FastAPI"
    fastapi_port: int = 8000
    jwt_secret_key: str = "replace-me"
    jwt_refresh_secret_key: str = "replace-me-too"
    access_token_expire_minutes: int = 20
    refresh_token_expire_days: int = 7
    fastapi_database_url: str = "sqlite:///./data/app.db"
    realtime_ws_base_url: str = "ws://localhost:3001/ws"
    realtime_shared_secret: str = "collaborative-editor-ai-dev-secret"
    session_token_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
