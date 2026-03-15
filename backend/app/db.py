from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .core.config import settings


class Base(DeclarativeBase):
    pass


def get_engine():
    return create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        future=True,
    )


engine = get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
