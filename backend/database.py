import os
import sqlite3
import logging
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

logger = logging.getLogger("database")

# Database URL from environment with PostGIS defaults and local fallback
DEFAULT_POSTGRES_URL = "postgresql://postgres:postgrespassword@localhost:5432/emergency_gis"
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    try:
        import psycopg2
        SQLALCHEMY_DATABASE_URL = DEFAULT_POSTGRES_URL
    except ImportError:
        logger.info("psycopg2 not found locally. Using SQLite fallback for local testing.")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./emergency_gis.db"

# SQLite parameters if testing locally without Docker
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Mock SQLite spatialite metadata and WKT/WKB functions for offline local testing
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def setup_sqlite_gis_mocks(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, sqlite3.Connection):
            import shapely.wkt
            
            def to_wkb(wkt_str):
                if isinstance(wkt_str, str):
                    if ';' in wkt_str:
                        wkt_str = wkt_str.split(';')[-1]
                    try:
                        p = shapely.wkt.loads(wkt_str)
                        return p.wkb
                    except Exception:
                        return wkt_str.encode('utf-8')
                return wkt_str

            dbapi_connection.create_function("RecoverGeometryColumn", 5, lambda *args: 1)
            dbapi_connection.create_function("InitSpatialMetaData", 0, lambda: 1)
            dbapi_connection.create_function("InitSpatialMetaData", 1, lambda *args: 1)
            dbapi_connection.create_function("DiscardGeometryColumn", 2, lambda *args: 1)
            dbapi_connection.create_function("CreateSpatialIndex", 2, lambda *args: 1)
            dbapi_connection.create_function("DisableSpatialIndex", 2, lambda *args: 1)
            dbapi_connection.create_function("GeomFromEWKT", 1, to_wkb)
            dbapi_connection.create_function("GeomFromText", 1, to_wkb)
            dbapi_connection.create_function("GeomFromText", 2, lambda wkt, srid: to_wkb(wkt))
            dbapi_connection.create_function("AsBinary", 1, lambda val: val)
            dbapi_connection.create_function("ST_AsBinary", 1, lambda val: val)
            dbapi_connection.create_function("AsEWKB", 1, lambda val: val)
            dbapi_connection.create_function("ST_AsEWKB", 1, lambda val: val)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db() -> None:
    """
    Initializes PostgreSQL with PostGIS spatial extensions
    and creates all tables defined in SQLAlchemy models.
    """
    if "postgres" in SQLALCHEMY_DATABASE_URL:
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
                logger.info("PostGIS spatial extension enabled successfully.")
        except Exception as e:
            logger.warning(f"Could not initialize PostGIS extension: {e}")

    # Import models to ensure registration with Base metadata
    import models
    Base.metadata.create_all(bind=engine)
    logger.info("Database schemas created.")

def get_db() -> Generator:
    """Dependency injection generator yielding an active database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
