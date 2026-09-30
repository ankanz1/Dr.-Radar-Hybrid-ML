// Component tests for the upgraded Doctor → Patients screen.
// doctorEcgService + doctorAvailabilityService are mocked; jsdom renders the
// real screen. Covers rendering, search, quick actions and the required
// loading / empty / error states.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const doctorEcgService = vi.hoisted(() => ({
  getAuthenticatedDoctor: vi.fn(),
  fetchAuthorizedPatients: vi.fn(),
}));

const doctorAvailabilityService = vi.hoisted(() => ({
  fetchMyDoctorAppointments: vi.fn(),
}));

vi.mock('../services/doctorEcgService', () => doctorEcgService);
vi.mock('../services/doctorAvailabilityService', () => doctorAvailabilityService);

import { DoctorPatientsScreen } from '../components/DoctorPatientsScreen';

const PATIENTS = [
  {
    patientId: 'pat-1',
    name: 'Ashton Miller',
    email: 'ashton@example.com',
    dob: '1992-04-12T00:00:00Z',
    gender: 'male',
    latestAnalysisAt: '2026-09-28T10:00:00Z',
    latestPrediction: { predictedClass: 'N', confidence: 0.97 },
  },
  {
    patientId: 'pat-2',
    name: 'Robert Vance',
    email: 'robert@example.com',
    dob: '1959-01-30T00:00:00Z',
    gender: 'male',
    latestAnalysisAt: '2026-09-29T09:00:00Z',
    latestPrediction: { predictedClass: 'V', confidence: 0.88 },
  },
  {
    patientId: 'pat-3',
    name: 'Sophia Chen',
    email: null,
    dob: null,
    gender: null,
    latestAnalysisAt: null,
    latestPrediction: null,
  },
];

const APPOINTMENTS = [
  {
    id: 'appt-1',
    patientId: 'pat-1',
    patientName: 'Ashton Miller',
    startTime: '2026-10-02T09:30:00Z',
    endTime: null,
    status: 'scheduled' as const,
    consultationType: 'telehealth' as const,
    reason: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  doctorEcgService.getAuthenticatedDoctor.mockResolvedValue({
    status: 'ready',
    doctorId: 'doc-1',
    displayName: 'Dr. Sarah Khan',
  });
  doctorEcgService.fetchAuthorizedPatients.mockResolvedValue({ ok: true, data: PATIENTS });
  doctorAvailabilityService.fetchMyDoctorAppointments.mockResolvedValue({
    ok: true,
    appointments: APPOINTMENTS,
  });
});

const renderScreen = () =>
  render(<DoctorPatientsScreen onNavigate={() => {}} onSelectPatient={() => {}} />);

describe('DoctorPatientsScreen', () => {
  it('shows the loading state first', async () => {
    doctorEcgService.fetchAuthorizedPatients.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId('patients-loading')).toBeInTheDocument();
  });

  it('renders patient name, demographics and review status from real data', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-name')[0]).toHaveTextContent('Ashton Miller');
    });
    const demographics = screen.getAllByTestId('patient-demographics');
    expect(demographics[0]).toHaveTextContent(/34 yrs/);
    expect(demographics[0]).toHaveTextContent(/male/);
    // Patients with no stored demographics show an honest placeholder.
    expect(screen.getAllByText(/Age —/).length).toBeGreaterThan(0);
    // Review status: pat-1 is 'N' (Normal), pat-2 is 'V' (Needs Review).
    const statusChips = screen.getAllByTestId('patient-review-status');
    expect(statusChips.some((chip) => chip.textContent?.includes('Normal'))).toBe(true);
    expect(statusChips.some((chip) => chip.textContent?.includes('Needs Review'))).toBe(true);
  });

  it('renders every authorized patient card', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    expect(screen.getByText('Robert Vance')).toBeInTheDocument();
    expect(screen.getByText('Sophia Chen')).toBeInTheDocument();
  });

  it('shows the exact upcoming appointment date and time per patient', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    const upcoming = screen.getAllByTestId('patient-upcoming');
    // Ashton has a scheduled appointment on the stored UTC slot.
    expect(upcoming[0]).toHaveTextContent('Oct 2, 2026');
    expect(upcoming[0]).toHaveTextContent('09:30');
    // Patients without one see the honest empty label.
    expect(screen.getAllByText(/No upcoming appointment/).length).toBe(2);
  });

  it('searches patients by name (case-insensitive) and clears', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    const input = screen.getByPlaceholderText(/Search patients/i);
    fireEvent.change(input, { target: { value: 'robert' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(1);
    });
    expect(screen.getByText('Robert Vance')).toBeInTheDocument();
    expect(screen.queryByText('Ashton Miller')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
  });

  it('shows the no-match state when the search matches nothing', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    fireEvent.change(screen.getByPlaceholderText(/Search patients/i), {
      target: { value: 'zzz-no-match' },
    });
    expect(screen.getByTestId('patients-search-empty')).toBeInTheDocument();
  });

  it('shows the empty state when the doctor has no authorized patients', async () => {
    doctorEcgService.fetchAuthorizedPatients.mockResolvedValue({ ok: true, data: [] });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('patients-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/No authorized patients yet/i)).toBeInTheDocument();
  });

  it('shows the error state when the doctor is signed out', async () => {
    doctorEcgService.getAuthenticatedDoctor.mockResolvedValue({ status: 'signed-out' });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('patients-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Sign in with your doctor account/i)).toBeInTheDocument();
  });

  it('shows the error state when the patients query fails', async () => {
    doctorEcgService.fetchAuthorizedPatients.mockResolvedValue({
      ok: false,
      error: 'rls denied',
    });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('patients-error')).toBeInTheDocument();
      expect(screen.getByText('rls denied')).toBeInTheDocument();
    });
  });

  it('quick action opens the patient ECG records via onSelectPatient', async () => {
    const onSelectPatient = vi.fn();
    const onNavigate = vi.fn();
    render(<DoctorPatientsScreen onNavigate={onNavigate} onSelectPatient={onSelectPatient} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    fireEvent.click(screen.getAllByText('Open Records')[0]);
    expect(onSelectPatient).toHaveBeenCalledWith('pat-1');
    expect(onNavigate).toHaveBeenCalledWith('doctor-ecg-records');
  });

  it('quick actions navigate to appointments and chat tabs', async () => {
    const onNavigate = vi.fn();
    render(<DoctorPatientsScreen onNavigate={onNavigate} onSelectPatient={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('patient-card')).toHaveLength(3);
    });
    fireEvent.click(screen.getAllByText('Appointments')[0]);
    expect(onNavigate).toHaveBeenCalledWith('doctor-dashboard');
    fireEvent.click(screen.getAllByText('Chat')[0]);
    expect(onNavigate).toHaveBeenCalledWith('doctor-messages');
  });
});
