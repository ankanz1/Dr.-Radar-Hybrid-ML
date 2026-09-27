"""Database foundation for Dr. Radar patient‑doctor platform.

This package provides SQLAlchemy 2.x models and Alembic migration support
for the future PostgreSQL backend. The existing ECG/QML API endpoints
(/health, /model-info, /samples, /predict, /analyze) remain completely
untouched.
"""

# Models are imported on-demand via ecg_qml.db.models.
# This __init__.py exists to make the db package importable
# without triggering a full model load at package import time.

__all__ = [
    "Users",
    "Patients",
    "Doctors",
    "HealthProfiles",
    "EcgRecords",
    "Predictions",
    "Explanations",
    "Appointments",
    "Consultations",
    "Reports",
]