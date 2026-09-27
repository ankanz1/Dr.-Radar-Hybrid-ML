"""Authentication utilities for Dr. Radar – PostgreSQL/SQLAlchemy ORM-backed."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher

# ---------------------------------------------------------------------------
# Load .env BEFORE anything that reads environment variables
# ---------------------------------------------------------------------------
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "ecg-qml", ".env"))

# ---------------------------------------------------------------------------
# Database engine – same source as alembic.ini
# ---------------------------------------------------------------------------
_DATABASE_URL = os.environ.get("DATABASE_URL")
if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Configure it before running the application."
    )
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

_engine = create_engine(_DATABASE_URL, future=True, echo=False)

# ---------------------------------------------------------------------------
# Import the SQLAlchemy ORM User model from the project's db.models package.
# The project runs as a 'src' subpackage inside 'ecg-qml', so we import
# db.models directly (the same package that api.py uses via 'from src.*').
# ---------------------------------------------------------------------------
from db.models import Users as _Users  # type: ignore
from db.models import Patients as _Patients  # type: ignore
from db.models import Doctors as _Doctors  # type: ignore

# ---------------------------------------------------------------------------
# Argon2 password hasher (module-level singleton)
# ---------------------------------------------------------------------------
_password_hasher = PasswordHasher()

# ---------------------------------------------------------------------------
# JWT configuration – DR_RADAR_JWT_SECRET is guaranteed loaded by load_dotenv()
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("DR_RADAR_JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "DR_RADAR_JWT_SECRET environment variable is not set. "
        "Configure it before running the application."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def _make_jwt(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Encode a JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    import jwt as _jwt
    to_encode = {"sub": subject, "role": role, "exp": expire}
    return _jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    """Create a short-lived access token (30 min)."""
    return _make_jwt(str(user_id), role, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    import jwt as _jwt
    return _jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against an Argon2 hash. Never logs passwords."""
    try:
        _password_hasher.verify(hashed_password, plain_password)
        return True
    except Exception:
        return False


def hash_password(plain_password: str) -> str:
    """Hash a plain password with Argon2. Never stores or logs plaintext."""
    return _password_hasher.hash(plain_password)


# ---------------------------------------------------------------------------
# Pydantic DTOs – kept as BaseModel subclasses so FastAPI can use them
# ---------------------------------------------------------------------------

from fastapi import HTTPException
from pydantic import BaseModel


class RegisterRequest(BaseModel):
    """Input for POST /auth/register."""

    email: str
    password: str
    first_name: str
    last_name: str
    display_name: str
    role: str


class LoginRequest(BaseModel):
    """Input for POST /auth/login."""

    email: str
    password: str


class TokenResponse(BaseModel):
    """Output for POST /auth/register and POST /auth/login."""

    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str
    first_name: str
    last_name: str
    display_name: str


class MeResponse(BaseModel):
    """Output for GET /auth/me."""

    user_id: str
    email: str
    role: str
    first_name: str
    last_name: str
    display_name: str


# ---------------------------------------------------------------------------
# User repository helpers – return real SQLAlchemy ORM User objects.
# ---------------------------------------------------------------------------

def get_user_by_email(email: str):
    """Return the SQLAlchemy Users ORM object matching *email*, or None."""
    with Session(_engine, future=True) as session:
        return session.query(_Users).filter(_Users.email == email).first()


def create_user(
    *,
    email: str,
    password_hash: str,
    first_name: str,
    last_name: str,
    display_name: str,
    role: str,
) -> _Users:
    """Insert a new User ORM object and its side-table row in PostgreSQL.

    Creates:
      - users.row  (the Users ORM object, returned)
      - patients.row when role=patient
      - doctors.row  when role=doctor
    """
    user = _Users(
        email=email,
        password_hash=password_hash,
        first_name=first_name,
        last_name=last_name,
        display_name=display_name,
        role=role,
    )
    with Session(_engine, future=True) as session:
        session.add(user)
        session.commit()
        session.refresh(user)

        # Create the matching side-table row
        if role == "patient":
            session.add(_Patients(user_id=user.id))
        elif role == "doctor":
            session.add(_Doctors(user_id=user.id))

        session.commit()
        return user


def get_user_by_id(user_id: str):
    """Return the SQLAlchemy Users ORM object matching *user_id*, or None."""
    with Session(_engine, future=True) as session:
        return session.get(_Users, user_id)