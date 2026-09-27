-- Dr. Radar Schema Migration for Supabase PostgreSQL
-- Source: Existing SQLAlchemy 2.x models + Alembic migration 001_initial_schema + 002_add_password_hash
-- This script creates all 10 tables with UUID primary keys, constraints, and relationships.
-- Trigger functions for automatic updated_at / last_updated columns
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_set_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Execute in the Supabase SQL Editor (PostgreSQL 15+ compatible).
-- Do NOT execute locally without Supabase connection configured.

-- =============================================================================
-- Table: users
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor')),
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted_date TIMESTAMPTZ,
    privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_policy_accepted_date TIMESTAMPTZ,
    research_consent BOOLEAN NOT NULL DEFAULT FALSE,
    research_consent_timestamp TIMESTAMPTZ,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    active_sessions_count INTEGER NOT NULL DEFAULT 1,
    last_password_change TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() 
);

-- =============================================================================
-- Table: patients
-- =============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    dob TIMESTAMPTZ,
    gender VARCHAR(50),
    country VARCHAR(100),
    language VARCHAR(50),
    professional_role VARCHAR(200),
    specialization VARCHAR(200),
    organization VARCHAR(300),
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for patients
CREATE INDEX IF NOT EXISTS ix_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS ix_patients_dob ON patients(dob);

-- =============================================================================
-- Table: doctors
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    specialty VARCHAR(200) NOT NULL,
    rating FLOAT NOT NULL DEFAULT 0.0,
    experience_years INTEGER NOT NULL DEFAULT 0,
    available_tag VARCHAR(100),
    next_available TIMESTAMPTZ,
    is_available_today BOOLEAN NOT NULL DEFAULT FALSE,
    hospital VARCHAR(300),
    about TEXT,
    avatar_url VARCHAR(500),
    slots JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for doctors
CREATE INDEX IF NOT EXISTS ix_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS ix_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS ix_doctors_available ON doctors(is_available_today);

-- =============================================================================
-- Table: health_profiles
-- =============================================================================
CREATE TABLE IF NOT EXISTS health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID UNIQUE NOT NULL,
    primary_goal VARCHAR(50),
    goal_description TEXT,
    symptoms JSONB NOT NULL DEFAULT '{}'::jsonb,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    medications JSONB NOT NULL DEFAULT '{}'::jsonb,
    allergies JSONB NOT NULL DEFAULT '{}'::jsonb,
    procedures JSONB NOT NULL DEFAULT '{}'::jsonb,
    family_history JSONB NOT NULL DEFAULT '{}'::jsonb,
    lifestyle JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_tests JSONB NOT NULL DEFAULT '{}'::jsonb,
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now() ,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Indexes for health_profiles
CREATE INDEX IF NOT EXISTS ix_healthprofiles_patient_id ON health_profiles(patient_id);

-- =============================================================================
-- Table: ecg_records
-- =============================================================================
CREATE TABLE IF NOT EXISTS ecg_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    ecg_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    lead VARCHAR(50) NOT NULL DEFAULT 'Lead II',
    source VARCHAR(100),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Indexes for ecg_records
CREATE INDEX IF NOT EXISTS ix_ecgrecords_patient_id ON ecg_records(patient_id);
CREATE INDEX IF NOT EXISTS ix_ecgrecords_recorded_at ON ecg_records(recorded_at);

-- =============================================================================
-- Table: predictions
-- =============================================================================
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecg_record_id UUID NOT NULL,
    predicted_class INTEGER NOT NULL CHECK (predicted_class BETWEEN 0 AND 4),
    predicted_class_name VARCHAR(1) NOT NULL,
    confidence FLOAT NOT NULL,
    probabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_mode VARCHAR(50) NOT NULL DEFAULT 'balanced',
    pca_features JSONB,
    quantum_features JSONB,
    recorded_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (ecg_record_id) REFERENCES ecg_records(id) ON DELETE CASCADE
);

-- Indexes and check for predictions
CREATE INDEX IF NOT EXISTS ix_predictions_ecg_record_id ON predictions(ecg_record_id);
CREATE INDEX IF NOT EXISTS ix_predictions_predicted_class ON predictions(predicted_class);

-- =============================================================================
-- Table: explanations
-- =============================================================================
CREATE TABLE IF NOT EXISTS explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID UNIQUE NOT NULL,
    method VARCHAR(255) NOT NULL,
    ranked_features JSONB NOT NULL DEFAULT '{}'::jsonb,
    waveform_importance JSONB NOT NULL DEFAULT '{}'::jsonb,
    xai_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
);

-- Index for explanations
CREATE INDEX IF NOT EXISTS ix_explanations_prediction_id ON explanations(prediction_id);

-- =============================================================================
-- Table: appointments
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])),
    consultation_type VARCHAR(50) CHECK (consultation_type = ANY (ARRAY['in_person'::text, 'telehealth'::text, 'follow_up'::text])),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() ,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    CONSTRAINT uq_appointments_patient_doctor_start UNIQUE (patient_id, doctor_id, start_time) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes and constraints for appointments
CREATE INDEX IF NOT EXISTS ix_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS ix_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS ix_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS ix_appointments_start_time ON appointments(start_time);
-- Deferrable unique constraint to prevent double-booking (same patient-doctor at same start time)

-- Check constraints already defined in CREATE TABLE

-- =============================================================================
-- Table: consultations
-- =============================================================================
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL,
    doctor_notes TEXT,
    follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() ,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- Index for consultations
CREATE INDEX IF NOT EXISTS ix_consultations_appointment_id ON consultations(appointment_id);

-- =============================================================================
-- Table: reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    appointment_id UUID,
    title VARCHAR(300) NOT NULL,
    date DATE NOT NULL,
    bpm_avg INTEGER,
    rhythm_status VARCHAR(100),
    summary TEXT,
    icon VARCHAR(100),
    is_attention BOOLEAN NOT NULL DEFAULT FALSE,
    pdf_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS ix_reports_patient_id ON reports(patient_id);
CREATE INDEX IF NOT EXISTS ix_reports_is_attention ON reports(is_attention);

-- =============================================================================
-- Schema summary
-- =============================================================================
-- Total tables: 10
-- Tables: users, patients, doctors, health_profiles, ecg_records, predictions, explanations, appointments, consultations, reports
-- UUID primary keys on all tables
-- Foreign key relationships:
--   patients.user_id -> users.id (CASCADE)
--   doctors.user_id -> users.id (CASCADE)
--   health_profiles.patient_id -> patients.id (CASCADE)
--   ecg_records.patient_id -> patients.id (CASCADE)
--   predictions.ecg_record_id -> ecg_records.id (CASCADE)
--   explanations.prediction_id -> predictions.id (CASCADE)
--   appointments.patient_id -> patients.id (CASCADE)
--   appointments.doctor_id -> doctors.id (CASCADE)
--   consultations.appointment_id -> appointments.id (CASCADE)
--   reports.patient_id -> patients.id (CASCADE)
--   reports.appointment_id -> appointments.id
-- Unique constraints:
--   users.email (unique)
--   patients.user_id (unique)
--   doctors.user_id (unique)
--   health_profiles.patient_id (unique)
-- Deferrable unique constraint on appointments(patient_id, doctor_id, start_time)
-- Check constraints:
--   users.role IN ('patient', 'doctor')
--   predictions.predicted_class BETWEEN 0 AND 4
--   appointments.status IN ('scheduled', 'completed', 'cancelled', 'no_show')
--   appointments.consultation_type IN ('in_person', 'telehealth', 'follow_up')
-- JSONB columns for health data:
--   health_profiles: symptoms, conditions, medications, allergies, procedures, family_history, lifestyle, previous_tests
--   predictions: probabilities
--   ecg_records: ecg_values
-- Timestamps on all tables: created_at, updated_at (or last_updated)
-- password_hash column on users table (migration 002)
-- researcher role NOT allowed at DB level (constraint: role IN ('patient', 'doctor'))-- Triggers for automatic updated_at / last_updated column maintenance

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_patients_set_updated_at ON patients;
CREATE TRIGGER trg_patients_set_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_doctors_set_updated_at ON doctors;
CREATE TRIGGER trg_doctors_set_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_healthprofiles_set_last_updated ON health_profiles;
CREATE TRIGGER trg_healthprofiles_set_last_updated
    BEFORE UPDATE ON health_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_last_updated();

DROP TRIGGER IF EXISTS trg_appointments_set_updated_at ON appointments;
CREATE TRIGGER trg_appointments_set_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_consultations_set_updated_at ON consultations;
CREATE TRIGGER trg_consultations_set_updated_at
    BEFORE UPDATE ON consultations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
