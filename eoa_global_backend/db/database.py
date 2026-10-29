"""
EOA Global - Asynchronous Database Infrastructure
Initializes the SQLAlchemy 2.0 async engine and session factory with connection pooling.
"""

from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from eoa_global_backend.core.config import settings


class Base(DeclarativeBase):
    """
    Root declarative base for all ORM entities in EOA Global.
    """
    pass


# Asynchronous PostgreSQL engine configured for high-concurrency emergency telemetry
engine: AsyncEngine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
)

# Async session factory
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Context generator yielding an isolated asynchronous session with automatic transaction management.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_database() -> None:
    """
    Initializes database tables and verifies PostGIS extension readiness.
    """
    async with engine.begin() as conn:
        # Guarantee PostGIS extension exists in the Postgres instance
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        await conn.run_sync(Base.metadata.create_all)
