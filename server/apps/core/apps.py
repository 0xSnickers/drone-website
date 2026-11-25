from django.apps import AppConfig
from django.db.backends.signals import connection_created


def _configure_sqlite(sender, connection, **kwargs):
    if connection.vendor != "sqlite":
        return
    with connection.cursor() as cursor:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=20000;")


class CoreConfig(AppConfig):
    name = "apps.core"

    def ready(self) -> None:
        connection_created.connect(_configure_sqlite, dispatch_uid="core_configure_sqlite_wal")
