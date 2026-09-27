import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserAccount } from '../../hooks/useUserAccount';
import { supabase } from '../../lib/supabase';

interface PatientProfileScreenProps {
  onNavigate: (tab: string) => void;
  userRole: 'patient' | 'doctor';
}

export const PatientProfileScreen: React.FC<PatientProfileScreenProps> = ({
  onNavigate,
  userRole,
}) => {
  const {
    user,
    isOnboardingActive,
    currentStep,
    setCurrentStep,
    startOnboarding,
    completeOnboarding,
    updateProfile,
    updateProfilePicture,
    updateRole,
    setConsent,
    toggleResearchConsent,
    toggleNotification,
    toggleTwoFactor,
    signOut,
    deleteAccount,
    exportUserData,
  } = useUserAccount();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    primaryGoal: undefined,
    goalDescription: undefined,
    completionPercentage: 0,
  });

  useEffect(() => {
    const loadPatientData = async () => {
      if (!user?.userId) {
        setIsLoading(false);
        setError('No authenticated user session');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(false);

      try {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.userId)
          .single();

        if (userErr) throw new Error('Failed to load user profile: ' + userErr.message);

        const { data: patientData, error: patientErr } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.userId)
          .single();

        if (patientErr && patientErr.code !== 'PGRST116') {
          throw new Error('Failed to load patient profile: ' + patientErr.message);
        }

        const { data: healthProfileData, error: healthErr } = await supabase
          .from('health_profiles')
          .select('*')
          .eq('patient_id', patientData?.id)
          .single();

        if (healthErr && healthErr.code !== 'PGRST116') {
          throw new Error('Failed to load health profile: ' + healthErr.message);
        }

        setFormState({
          firstName: userData?.first_name || user?.firstName || '',
          lastName: userData?.last_name || user?.lastName || '',
          email: userData?.email || user?.email || '',
          primaryGoal: healthProfileData?.primary_goal,
          goalDescription: healthProfileData?.goal_description,
          completionPercentage: healthProfileData?.completion_percentage || 0,
        });
      } catch (err: any) {
        console.error('Error loading patient data:', err);
        setError(err.message || 'Failed to load patient data');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatientData();
  }, [user?.userId]);

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const { data: patientData, error: patientErr } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user?.userId)
        .single();

      if (patientErr) throw new Error('Failed to load patient ID: ' + patientErr.message);

      const healthProfileData = {
        patient_id: patientData?.id,
        first_name: formState.firstName,
        last_name: formState.lastName,
        email: formState.email,
        primary_goal: formState.primaryGoal,
        goal_description: formState.goalDescription,
        completion_percentage: formState.completionPercentage,
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('health_profiles')
        .upsert(healthProfileData, { onConflict: 'patient_id' });

      if (error) throw new Error('Failed to save health profile: ' + error.message);

      setSuccess(true);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormState({
      firstName: '',
      lastName: '',
      email: '',
      primaryGoal: undefined,
      goalDescription: undefined,
      completionPercentage: 0,
    });
  };

  if (isOnboardingActive) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fbfe] text-[#101c28]">
      <header className="border-b border-slate-200/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#bc000a] flex items-center justify-center">
              <span className="text-white font-bold text-sm">DR</span>
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-[#101c28]">DR. RADAR</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span />
            <span>Secure Clinical Gateway</span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full lg:pl-64 xl:pl-72 xl:pt-6">
        <nav className="bg-white shadow-sm border-r border-slate-200/80 flex-shrink-0">
          <ul className="flex flex-col p-4 space-y-1">
            <li><button onClick={() => onNavigate('patient-home')}>Patient Home</button></li>
            <li><button onClick={() => onNavigate('analysis')}>Analysis Hub</button></li>
            <li><button onClick={() => onNavigate('results')}>Results</button></li>
            <li><button onClick={() => onNavigate('patient-profile')}>Profile</button></li>
            <li><button onClick={() => onNavigate('health-info')}>Health Info</button></li>
          </ul>
        </nav>

        <main className="flex-1 p-6 sm:p-8 lg:p-8">
          <AnimatePresence mode="wait">
            {isLoading && (
              <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-400">hourglass_empty</span>
                <h2 className="mt-4 text-xl font-bold text-[#101c28]">Loading Patient Profile</h2>
                <p className="mt-2 text-slate-500">Please wait while we load your profile data</p>
              </div>
            )}

            {error && (
              <div className="w-full max-w-md mx-auto bg-red-50 rounded-3xl p-6 mt-6">
                <span className="material-symbols-outlined text-24 text-red-500">error</span>
                <h3 className="mt-2 text-xl font-bold text-red-700">Error Loading Profile</h3>
                <p className="mt-1 text-slate-500">{error}</p>
              </div>
            )}

            {success && (
              <div className="w-full max-w-md mx-auto bg-green-50 rounded-3xl p-6 mt-6">
                <span className="material-symbols-outlined text-24 text-green-500">check_circle</span>
                <h3 className="mt-2 text-xl font-bold text-green-700">Profile Saved</h3>
                <p className="mt-1 text-slate-500">Your profile has been updated</p>
              </div>
            )}

            {!isLoading && !error && !success && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-[#101c28]">My Profile</h2>
                  <button onClick={handleCancel} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                    Cancel
                  </button>
                </div>

                <p className="text-slate-500 mb-4">
                  Welcome to your Dr. Radar profile. Your health information is stored securely
                  and can be updated here.
                </p>

                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formState.firstName}
                      onChange={(e) => setFormState({ ...formState, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formState.lastName}
                      onChange={(e) => setFormState({ ...formState, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formState.email}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                      placeholder="john.doe@clinical-domain.med"
                    />
                  </div>
                  <button
                    type="submit"
                    onClick={handleSave}
                    className="w-full py-3 rounded-lg text-sm font-medium transition-all cursor-pointer bg-[#bc000a] text-white shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] active:scale-[0.99]"
                    disabled={isLoading}
                    >
                    Save Changes
                  </button>
                </form>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <footer className="border-t border-slate-200/80 px-4 py-3 text-center text-xs text-slate-500">
        Dr. Radar • Hybrid Quantum–Classical Healthcare Intelligence • Clinical Decision Support
      </footer>
    </div>
  );
};
