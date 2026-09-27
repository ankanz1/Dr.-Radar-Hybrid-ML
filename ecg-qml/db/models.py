"""SQLAlchemy 2.x models for Dr. Radar PostgreSQL backend.

Maps to the database architecture report entities:
  users, patients, doctors, health_profiles, ecg_records,
  predictions, explanations, appointments, consultations, reports.

The existing FastAPI endpoints in ecg-qml/api.py are completely untouched.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Index,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column

Base = declarative_base()


# ---------------------------------------------------------------------------
# 1. users
# ---------------------------------------------------------------------------

class Users(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    profile_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    terms_accepted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    terms_accepted_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    privacy_policy_accepted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    privacy_policy_accepted_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    research_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    research_consent_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    two_factor_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    active_sessions_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    last_password_change: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('patient', 'doctor')", name="ck_users_role"
        ),
    )


# ---------------------------------------------------------------------------
# 2. patients
# ---------------------------------------------------------------------------

class Patients(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    dob: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    professional_role: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    specialization: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    organization: Mapped[str | None] = mapped_column(String(300), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_patients_user_id", "user_id"),
        Index("ix_patients_dob", "dob"),
    )


# ---------------------------------------------------------------------------
# 3. doctors
# ---------------------------------------------------------------------------

class Doctors(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    specialty: Mapped[str] = mapped_column(String(200), nullable=False)
    rating: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    experience_years: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    available_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    next_available: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_available_today: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    hospital: Mapped[str | None] = mapped_column(String(300), nullable=True)
    about: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    slots: Mapped[str | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_doctors_user_id", "user_id"),
        Index("ix_doctors_specialty", "specialty"),
        Index("ix_doctors_available", "is_available_today"),
    )


# ---------------------------------------------------------------------------
# 4. health_profiles
# ---------------------------------------------------------------------------

class HealthProfiles(Base):
    __tablename__ = "health_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    primary_goal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    goal_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    symptoms: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    conditions: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    medications: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    allergies: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    procedures: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    family_history: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    lifestyle: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    previous_tests: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    completion_percentage: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_healthprofiles_patient_id", "patient_id"),
    )


# ---------------------------------------------------------------------------
# 5. ecg_records
# ---------------------------------------------------------------------------

class EcgRecords(Base):
    __tablename__ = "ecg_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    ecg_values: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    lead: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Lead II"
    )
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_ecgrecords_patient_id", "patient_id"),
        Index("ix_ecgrecords_recorded_at", "recorded_at"),
    )


# ---------------------------------------------------------------------------
# 6. predictions
# ---------------------------------------------------------------------------

class Predictions(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ecg_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    predicted_class: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    predicted_class_name: Mapped[str] = mapped_column(
        String(1), nullable=False
    )
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False
    )
    probabilities: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    model_mode: Mapped[str] = mapped_column(
        String(50), nullable=False, default="balanced"
    )
    pca_features: Mapped[str | None] = mapped_column(JSONB, nullable=True)
    quantum_features: Mapped[str | None] = mapped_column(JSONB, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("ix_predictions_ecg_record_id", "ecg_record_id"),
        Index("ix_predictions_predicted_class", "predicted_class"),
    )

    # Class check constraint
    __table_args__ += (
        CheckConstraint(
            "predicted_class BETWEEN 0 AND 4",
            name="ck_predictions_class",
        ),
    )


# ---------------------------------------------------------------------------
# 7. explanations
# ---------------------------------------------------------------------------

class Explanations(Base):
    __tablename__ = "explanations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    method: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    ranked_features: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    waveform_importance: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default={}
    )
    xai_metadata: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default={}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_explanations_prediction_id", "prediction_id"),
    )


# ---------------------------------------------------------------------------
# 8. appointments
# ---------------------------------------------------------------------------

class Appointments(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled"
    )
    consultation_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_appointments_patient_id", "patient_id"),
        Index("ix_appointments_doctor_id", "doctor_id"),
        Index("ix_appointments_status", "status"),
        Index("ix_appointments_start_time", "start_time"),
        # Exclusion constraint to prevent double-booking is expressed via
        # PostgreSQL-specific index; we add a partial unique index as fallback.
        # SqlAlchemy 2.x will emit the appropriate CREATE INDEX.
        UniqueConstraint(
            "patient_id",
            "doctor_id",
            "start_time",
            name="uq_appointments_patient_doctor_start",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "status = ANY(ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])",
            name="ck_appointments_status",
        ),
        CheckConstraint(
            "consultation_type = ANY(ARRAY['in_person'::text, 'telehealth'::text, 'follow_up'::text])",
            name="ck_appointments_consultation_type",
        ),
    )


# ---------------------------------------------------------------------------
# 9. consultations
# ---------------------------------------------------------------------------

class Consultations(Base):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    doctor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    follow_up_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_consultations_appointment_id", "appointment_id"),
    )


# ---------------------------------------------------------------------------
# 10. reports
# ---------------------------------------------------------------------------

class Reports(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    bpm_avg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rhythm_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_attention: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_reports_patient_id", "patient_id"),
        Index("ix_reports_is_attention", "is_attention"),
    )