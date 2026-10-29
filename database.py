import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

# Read DATABASE_URL from environment with fallback to SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./emergency.db")

# For SQLite, check_same_thread=False is required for multithreaded / async FastAPI requests
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db() -> None:
    """Creates all database tables defined in the SQLAlchemy models."""
    from models import Base
    Base.metadata.create_all(bind=engine)

def get_db() -> Generator:
    """Dependency injection yield for FastAPI request contexts."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
