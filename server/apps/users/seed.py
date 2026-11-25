import logging

from django.conf import settings
from django.db import DatabaseError

from .models import Role, User
from .services import create_user

logger = logging.getLogger(__name__)

DEMO_USER = {
    "name": "Demo User",
    "email": "demo@example.com",
    "password": "password123",
    "role": Role.ADMIN,
}

DEMO_WEB_USER = {
    "name": "AeroApex Pilot",
    "email": "pilot@aeroapex.com",
    "password": "password123",
    "role": Role.USER,
}


def seed_demo_user() -> None:
    if not User.objects.filter(email=DEMO_USER["email"]).exists():
        create_user(**DEMO_USER)
        logger.info("demo user created: %s", DEMO_USER["email"])


def seed_demo_web_user() -> None:
    if not User.objects.filter(email=DEMO_WEB_USER["email"]).exists():
        create_user(**DEMO_WEB_USER)
        logger.info("demo web user created: %s", DEMO_WEB_USER["email"])


def seed_demo_user_on_startup() -> None:
    """Called from wsgi.py when SEED_DEMO_USER=true; tolerates an unmigrated database."""
    if not settings.SEED_DEMO_USER:
        return
    try:
        seed_demo_user()
        seed_demo_web_user()
    except DatabaseError as exc:
        logger.warning("demo user not seeded (run migrations first): %s", exc)
