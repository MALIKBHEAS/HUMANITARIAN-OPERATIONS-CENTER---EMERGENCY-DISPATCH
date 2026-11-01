"""
EOA Global - Core Configuration Module
Enterprise settings management utilizing Pydantic v2 BaseSettings.
"""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Info
    PROJECT_NAME: str = "EOA Global - Emergency Orchestrator Agent"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & JWT Token Configurations
    # In production, SECRET_KEY must be supplied via environment variable
    SECRET_KEY: str = "eoa-enterprise-super-secret-key-change-in-production-2026-global"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 Hours

    # Database Configuration (PostgreSQL + PostGIS)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "eoa_global_db"
    
    # Custom direct database URL override (optional)
    DATABASE_URL: Union[str, None] = None

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """
        Constructs the asynchronous PostgreSQL connection URI for SQLAlchemy 2.0 using asyncpg.
        """
        if self.DATABASE_URL:
            # Ensure asyncpg driver is specified if raw postgresql:// is provided
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS Configurations (Explicitly whitelists 49152, 9443, 8000, 5173)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:49152",
        "http://127.0.0.1:49152",
        "http://localhost:9443",
        "http://127.0.0.1:9443",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost",
        "http://127.0.0.1",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    # PostGIS Global SRID
    POSTGIS_SRID: int = 4326

    # Message Broker Configurations (Redis / RabbitMQ)
    BROKER_TYPE: str = "redis"  # Options: "redis", "rabbitmq", "memory"
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"
    EMERGENCY_QUEUE_PREFIX: str = "eoa_sos_queue"
    EMERGENCY_CHANNEL_PREFIX: str = "eoa_live_channel"

    # AI & Pluggable LLM Gateway Settings
    LLM_PROVIDER: str = "openai"  # Options: "openai", "local", "ollama", "vllm"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_NAME: str = "gpt-4o-mini"
    LOCAL_LLM_BASE_URL: str = "http://localhost:11434/v1"
    LOCAL_LLM_MODEL_NAME: str = "llama3.2"

    # Model Configuration for Pydantic v2
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# Global singleton settings instance
settings = Settings()
