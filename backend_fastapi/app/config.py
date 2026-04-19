from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


INSECURE_SECRET_VALUES = {
    "",
    "replace-me",
    "replace-me-too",
    "collaborative-editor-ai-dev-secret",
}


class Settings(BaseSettings):
    app_name: str = "Collaborative Editor AI FastAPI"
    fastapi_port: int = 8000
    frontend_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    jwt_secret_key: str = ""
    jwt_refresh_secret_key: str = ""
    access_token_expire_minutes: int = 20
    refresh_token_expire_days: int = 7
    password_reset_token_expire_minutes: int = 15
    fastapi_database_url: str = "sqlite:///./data/collaborative-editor-ai.sqlite"
    realtime_ws_base_url: str = "ws://localhost:3001/ws"
    realtime_shared_secret: str = ""
    session_token_ttl_seconds: int = 3600
    ai_stream_provider: str = "stub"
    ai_provider_endpoint: str = "http://127.0.0.1:1234/v1/chat/completions"
    ai_model: str = "local-model"
    ai_timeout_ms: int = 15000

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def model_post_init(self, __context) -> None:
        missing = []
        if self.jwt_secret_key in INSECURE_SECRET_VALUES:
            missing.append("JWT_SECRET_KEY")
        if self.jwt_refresh_secret_key in INSECURE_SECRET_VALUES:
            missing.append("JWT_REFRESH_SECRET_KEY")
        if self.realtime_shared_secret in INSECURE_SECRET_VALUES:
            missing.append("REALTIME_SHARED_SECRET")
        if missing:
            joined = ", ".join(missing)
            raise ValueError(f"Missing or insecure secret configuration: {joined}")

    @property
    def frontend_allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_allowed_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
