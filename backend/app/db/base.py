from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.x Declarative Base for all Brightloop domain models.
    Enables centralized metadata collection for Alembic schema migrations.
    """
    pass
