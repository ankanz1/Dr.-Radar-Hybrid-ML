import React, { useState } from 'react';
import { UserAccountState, UserRole } from '../types';
import { DrRadarLogo } from './DrRadarLogo';
import { LegalDocsModal } from './onboarding/LegalDocsModal';
import { ProfileAvatar } from './profile/ProfileAvatar';
import { ProfilePictureModal } from './profile/ProfilePictureModal';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccountState;
  onUpdateProfile: (updates: Partial<UserAccountState>) => void;
  onUpdateRole: (role: UserRole) => void;
  onToggleResearchConsent: () => void;
  onToggleNotification: (key: keyof UserAccountState['notifications']) => void;
  onToggleTwoFactor: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onExportUserData: () => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  initialTab?: SettingsTab;
  onOpenProfilePictureModal?: () => void;
}

export type SettingsTab =
  | 'profile'
  | 'account'
  | 'privacy'
  | 'consent-history'
  | 'notifications'
  | 'security'
  | 'preferences';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  onUpdateRole,
  onToggleResearchConsent,
  onToggleNotification,
  onToggleTwoFactor,
  onSignOut,
  onDeleteAccount,
  onExportUserData,
  onShowToast,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Profile Form State
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [dob, setDob] = useState(user.dob || '1990-05-12');
  const [gender, setGender] = useState(user.gender || 'Prefer not to say');
  const [country, setCountry] = useState(user.country || 'United States');
  const [language, setLanguage] = useState(user.language || 'English (US)');

  // Account Changes State
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Modals inside settings
  const [isProfilePictureModalOpen, setIsProfilePictureModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isViewDataModalOpen, setIsViewDataModalOpen] = useState(false);
  const [legalDocType, setLegalDocType] = useState<'privacy' | 'terms' | null>(null);

  // Synchronize activeTab with initialTab when opened or initialTab changes
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Synchronize form fields with user when opened
  React.useEffect(() => {
    if (isOpen) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setDisplayName(user.displayName);
      setDob(user.dob || '1990-05-12');
      setGender(user.gender || 'Prefer not to say');
      setCountry(user.country || 'United States');
      setLanguage(user.language || 'English (US)');
      setEditMode(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    onUpdateProfile({
      firstName,
      lastName,
      displayName,
      dob,
      gender,
      country,
      language,
    });
    setEditMode(false);
    onShowToast('Profile information updated successfully', 'success');
  };

  const handleChangeEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      onShowToast('Please enter a valid email address', 'warning');
      return;
    }
    onUpdateProfile({ email: newEmail });
    setIsChangingEmail(false);
    setNewEmail('');
    onShowToast('Verification email sent to new address', 'info');
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onShowToast('New password must be at least 8 characters', 'warning');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      onShowToast('Passwords do not match', 'warning');
      return;
    }
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    onShowToast('Password changed successfully', 'success');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmationText !== 'DELETE') {
      onShowToast('Please type DELETE to confirm account removal', 'warning');
      return;
    }
    setIsDeleteModalOpen(false);
    onClose();
    onDeleteAccount();
  };

  const navItems: { id: SettingsTab; label: string; icon: string; badge?: string }[] = [
    { id: 'profile', label: 'Profile', icon: 'person' },
    { id: 'account', label: 'Account', icon: 'manage_accounts' },
    { id: 'privacy', label: 'Privacy & Data', icon: 'shield' },
    { id: 'consent-history', label: 'Consent History', icon: 'history_edu' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'security', label: 'Security', icon: 'lock' },
  ];

  return (
    <div
      id="account-settings-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200"
    >
      <div
        id="account-settings-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[94vh] sm:max-h-[92vh] shadow-2xl flex flex-col md:flex-row border border-slate-200 overflow-hidden"
      >
        {/* Left Settings Sidebar */}
        <div className="w-full md:w-64 bg-[#f8fbfe] border-b md:border-b-0 md:border-r border-slate-200 p-3 sm:p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-3 sm:space-y-4">
            {/* Mobile Header Bar inside Modal */}
            <div className="flex md:hidden items-center justify-between pb-2 border-b border-slate-200/70">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center font-bold text-xs shrink-0">
                    {user.firstName?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{user.displayName}</div>
                  <div className="text-[10px] text-[#bc000a] font-semibold uppercase tracking-wider">
                    {user.role} • Profile Settings
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Close settings"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <DrRadarLogo size={34} />
              <div>
                <span className="text-xs font-black tracking-tight text-[#101c28]">DR. RADAR</span>
                <p className="text-[10px] font-semibold text-slate-500">Account & Security</p>
              </div>
            </div>

            {/* User Mini Card (Desktop) */}
            <div
              onClick={() => setIsProfilePictureModalOpen(true)}
              className="hidden md:flex p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs items-center gap-2.5 cursor-pointer hover:border-[#bc000a]/30 transition-all group"
              title="Click to customize profile picture"
            >
              <ProfileAvatar
                user={user}
                size="sm"
                showIndicator
                indicatorColor="green"
                className="shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-900 truncate group-hover:text-[#bc000a] transition-colors">{user.displayName}</div>
                <div className="text-[10px] text-[#bc000a] font-semibold uppercase tracking-wider">
                  {user.role}
                </div>
              </div>
            </div>

            {/* Nav Tabs - Horizontal scroll on mobile, vertical list on desktop */}
            <nav className="flex md:flex-col overflow-x-auto gap-1.5 pb-1 md:pb-0 scrollbar-none -mx-1 px-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  id={`settings-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer whitespace-nowrap shrink-0 md:shrink md:w-full min-h-[40px] md:min-h-auto ${
                    activeTab === item.id
                      ? 'bg-[#bc000a] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 bg-white md:bg-transparent border md:border-transparent border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Sign Out at bottom of sidebar (Desktop) */}
          <div className="hidden md:block pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-[#bc000a] hover:border-red-200 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Sign Out
            </button>
          </div>
        </div>

        {/* Right Settings Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Top Bar of Modal */}
          <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#101c28]">
                {navItems.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage your profile, clinical preferences, and data governance.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close settings"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Tab Panes */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* =========================================================================
                TAB 1: PROFILE SETTINGS
            ========================================================================= */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="relative group cursor-pointer shrink-0"
                      onClick={() => setIsProfilePictureModalOpen(true)}
                      title="Change profile picture"
                    >
                      <ProfileAvatar
                        user={user}
                        size="xl"
                        borderStyle="brand"
                        showIndicator
                        indicatorColor="green"
                        className="group-hover:scale-105 transition-transform"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProfilePictureModalOpen(true);
                        }}
                        className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#bc000a] text-white flex items-center justify-center shadow-xs hover:bg-[#a50009] transition-colors cursor-pointer"
                        title="Change Profile Picture"
                      >
                        <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                      </button>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{user.displayName}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsProfilePictureModalOpen(true)}
                          className="text-xs font-semibold text-[#bc000a] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                          <span>Change Photo / Choose Avatar</span>
                        </button>
                        {user.profilePictureType && user.profilePictureType !== 'none' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateProfile({
                                profilePictureType: 'none',
                                profilePicture: null,
                                avatarUrl: undefined,
                              });
                              onShowToast('Profile picture reset to default avatar', 'info');
                            }}
                            className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveProfile}
                        className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold shadow-xs hover:bg-[#a50009] cursor-pointer"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      disabled={!editMode}
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Gender
                    </label>
                    <select
                      disabled={!editMode}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Country / Region
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Preferred Language
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      System Identifier (Read-Only)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user.userId}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                {/* Profile Completion Indicator */}
                <div className="p-3.5 bg-[#f8fbfe] rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Profile Status</div>
                    <div className="text-[11px] text-slate-500">
                      {user.profileCompleted ? 'Fully configured' : 'Basic details only (60% complete)'}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    user.profileCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {user.profileCompleted ? 'Complete' : '60% Complete'}
                  </span>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 2: ACCOUNT SETTINGS
            ========================================================================= */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                {/* Account Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Primary Email</span>
                      <div className="text-sm font-bold text-slate-900">{user.email}</div>
                    </div>
                    <button
                      onClick={() => setIsChangingEmail(!isChangingEmail)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Change Email
                    </button>
                  </div>

                  {isChangingEmail && (
                    <form onSubmit={handleChangeEmailSubmit} className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        New Email Address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="new.email@hospital.med"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#bc000a] text-white text-xs font-bold rounded-lg"
                        >
                          Send Link
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Account Role */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Assigned Role</span>
                    <div className="text-sm font-bold text-slate-900 capitalize flex items-center gap-1.5">
                      {user.role}
                      <span className="text-[10px] font-mono text-[#bc000a] bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                        Active Workspace
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateRole('patient')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        user.role === 'patient' ? 'bg-[#bc000a] text-white' : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      Patient
                    </button>
                    <button
                      onClick={() => onUpdateRole('doctor')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        user.role === 'doctor' ? 'bg-[#bc000a] text-white' : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      Doctor
                    </button>
                    <button
                      onClick={() => onUpdateRole('researcher')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        user.role === 'researcher' ? 'bg-[#bc000a] text-white' : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      Researcher
                    </button>
                  </div>
                </div>

                {/* Password Management */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Security Password</span>
                      <div className="text-sm font-bold text-slate-900">••••••••••••</div>
                      <span className="text-[10px] text-slate-400">Last updated: {user.security.lastPasswordChange}</span>
                    </div>
                    <button
                      onClick={() => setIsChangingPassword(!isChangingPassword)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Change Password
                    </button>
                  </div>

                  {isChangingPassword && (
                    <form onSubmit={handleChangePasswordSubmit} className="pt-2 border-t border-slate-200 space-y-2.5">
                      <input
                        type="password"
                        required
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="password"
                        required
                        placeholder="New password (min 8 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="password"
                        required
                        placeholder="Confirm new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#bc000a] text-white text-xs font-bold rounded-lg"
                        >
                          Update Password
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(false)}
                          className="px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Account Actions: Sign Out & Delete */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => {
                      onClose();
                      onSignOut();
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Sign Out of All Devices
                  </button>

                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 3: PRIVACY & DATA SETTINGS
            ========================================================================= */}
            {activeTab === 'privacy' && (
              <div className="space-y-5">
                {/* Research Consent Box */}
                <div className="p-4 rounded-2xl bg-[#f8fbfe] border border-blue-200/80 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Research & Model Improvement Consent
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          user.researchConsent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {user.researchConsent ? 'Research Data Consent: ON' : 'Research Data Consent: OFF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Allows your anonymized and de-identified physiological data to be used for quantum ansatz optimization and ML benchmarking.
                      </p>
                      {user.researchConsentTimestamp && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-1">
                          Consent status recorded: {new Date(user.researchConsentTimestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-100/80 flex items-center justify-between">
                    <button
                      onClick={() => {
                        onToggleResearchConsent();
                        onShowToast(
                          user.researchConsent
                            ? 'Research consent withdrawn. Future analyses will not be included in benchmark cohorts.'
                            : 'Research consent granted. Thank you for contributing to healthcare AI research.',
                          'info'
                        );
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        user.researchConsent
                          ? 'bg-white border border-red-300 text-[#bc000a] hover:bg-red-50'
                          : 'bg-[#bc000a] text-white hover:bg-[#a50009]'
                      }`}
                    >
                      {user.researchConsent ? 'Withdraw Consent' : 'Grant Consent'}
                    </button>

                    <button
                      onClick={() => setLegalDocType('privacy')}
                      className="text-xs text-slate-500 font-semibold hover:underline"
                    >
                      Review Data Standards →
                    </button>
                  </div>
                </div>

                {/* Data Management: Real Actions */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Your Data Management
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Under healthcare data transparency guidelines, you can inspect or export your active telemetry profile anytime.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      onClick={() => setIsViewDataModalOpen(true)}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-all flex items-center gap-2.5 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[20px] text-blue-600">visibility</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">View My Data</div>
                        <div className="text-[10px] text-slate-500">Inspect stored profile payload</div>
                      </div>
                    </button>

                    <button
                      onClick={onExportUserData}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-all flex items-center gap-2.5 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[20px] text-emerald-600">download</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Download My Data</div>
                        <div className="text-[10px] text-slate-500">Export clinical JSON record</div>
                      </div>
                    </button>
                  </div>

                  {/* Backend Status Clarification */}
                  <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Cloud EHR Synchronization:</span>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Client-Local Active • Cloud Sync Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 4: CONSENT HISTORY
            ========================================================================= */}
            {activeTab === 'consent-history' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  A transparent record of legal and research consent decisions associated with this account.
                </div>

                <div className="space-y-2.5">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Terms of Clinical Service</div>
                      <div className="text-[11px] text-slate-500">Version 2.4 (Clinical ISO Standards)</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Accepted
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {user.termsAcceptedDate ? new Date(user.termsAcceptedDate).toLocaleDateString() : 'Current Session'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Clinical Privacy & Data Policy</div>
                      <div className="text-[11px] text-slate-500">Version 2.4 (Safe Harbor De-identification)</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Accepted
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {user.privacyPolicyAcceptedDate ? new Date(user.privacyPolicyAcceptedDate).toLocaleDateString() : 'Current Session'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Optional Research & Model Improvement</div>
                      <div className="text-[11px] text-slate-500">Anonymized telemetry contribution</div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        user.researchConsent ? 'text-blue-700 bg-blue-50' : 'text-slate-600 bg-slate-100'
                      }`}>
                        {user.researchConsent ? 'Granted' : 'Not Granted / Withdrawn'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {user.researchConsentTimestamp ? new Date(user.researchConsentTimestamp).toLocaleDateString() : 'Pending'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 5: NOTIFICATIONS
            ========================================================================= */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Control real-time clinical alerts, analysis results, and research updates.
                </p>

                <div className="space-y-2.5">
                  {[
                    {
                      key: 'analysisResults' as const,
                      title: 'Analysis Results',
                      desc: 'Receive immediate alerts when an ECG or multimodality run finishes.',
                    },
                    {
                      key: 'healthAlerts' as const,
                      title: 'Health & Arrhythmia Alerts',
                      desc: 'Critical alerts when telemetry detects rhythm instability or elevated ectopic beats.',
                    },
                    {
                      key: 'appointmentReminders' as const,
                      title: 'Appointment Reminders',
                      desc: 'Schedule alerts for upcoming clinical teleconsultations and reviews.',
                    },
                    {
                      key: 'researchUpdates' as const,
                      title: 'Research Updates',
                      desc: 'Periodic digest of published quantum benchmark papers and model iterations.',
                    },
                    {
                      key: 'productUpdates' as const,
                      title: 'Platform Updates',
                      desc: 'Announcements when new clinical areas (Cancer, Liver, Imaging) go active.',
                    },
                  ].map((notif) => (
                    <div
                      key={notif.key}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="pr-4">
                        <div className="text-xs font-bold text-slate-900">{notif.title}</div>
                        <div className="text-[11px] text-slate-500">{notif.desc}</div>
                      </div>
                      <button
                        role="switch"
                        aria-checked={user.notifications[notif.key]}
                        onClick={() => onToggleNotification(notif.key)}
                        className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                          user.notifications[notif.key] ? 'bg-[#bc000a]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                            user.notifications[notif.key] ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 6: SECURITY
            ========================================================================= */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                {/* 2FA */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-blue-600">phonelink_lock</span>
                      Two-Factor Authentication (2FA)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Protect your healthcare portal with SMS or authenticator one-time passcodes.
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={user.security.twoFactorEnabled}
                    onClick={() => {
                      onToggleTwoFactor();
                      onShowToast(
                        user.security.twoFactorEnabled ? '2FA disabled' : '2FA enabled with authenticator protection',
                        'info'
                      );
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      user.security.twoFactorEnabled ? 'bg-[#bc000a]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                        user.security.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Active Sessions */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Active Workstation Sessions</span>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      1 Active
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-slate-500">laptop_mac</span>
                      <div>
                        <div className="font-semibold text-slate-800">Current Web Browser Session</div>
                        <div className="text-[10px] text-slate-400">Secure Sandboxed Container • Port 3000</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700">Online Now</span>
                  </div>
                </div>

                {/* Login Activity */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-900">Recent Authentication Activity</span>
                  <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span>Web Gateway Sign-In</span>
                      <span className="text-slate-400">Just now • Success</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Token Refresh</span>
                      <span className="text-slate-400">Today • Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MY DATA MODAL */}
      {isViewDataModalOpen && (
        <div
          onClick={() => setIsViewDataModalOpen(false)}
          className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl border border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">data_object</span>
                Stored User Data Profile
              </h3>
              <button
                onClick={() => setIsViewDataModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-auto max-h-72">
              {JSON.stringify(user, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={onExportUserData}
                className="px-3 py-1.5 bg-[#bc000a] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Download as JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT DELETION CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div
          onClick={() => setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-red-200 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#bc000a] flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete your Dr. Radar account?</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                Deleting your account will permanently remove your account information and associated local telemetry data according to the platform&apos;s data-retention policies. This action cannot be undone.
              </p>
            </div>

            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-800">
              Please type <strong className="font-mono text-[#bc000a]">DELETE</strong> to confirm:
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full mt-2 px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-bold text-red-900"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmationText !== 'DELETE'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 cursor-pointer"
              >
                Permanently Delete Account
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Documents Modal */}
      {legalDocType && (
        <LegalDocsModal
          isOpen={Boolean(legalDocType)}
          onClose={() => setLegalDocType(null)}
          documentType={legalDocType}
        />
      )}

      {/* Profile Picture & Avatar Modal */}
      <ProfilePictureModal
        isOpen={isProfilePictureModalOpen}
        onClose={() => setIsProfilePictureModalOpen(false)}
        user={user}
        onSave={(type, value, resolvedUrl) => {
          onUpdateProfile({
            profilePictureType: type,
            profilePicture: value,
            avatarUrl: resolvedUrl,
          });
          onShowToast('Profile picture updated successfully', 'success');
        }}
      />
    </div>
  );
};
