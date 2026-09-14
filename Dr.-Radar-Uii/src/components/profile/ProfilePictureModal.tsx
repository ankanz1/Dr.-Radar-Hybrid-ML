import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAccountState, ProfilePictureType } from '../../types';
import {
  DR_RADAR_AVATARS,
  NEUTRAL_DEFAULT_AVATAR_URL,
  getAvatarById,
} from '../../data/avatarsData';

interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccountState;
  onSave: (pictureType: ProfilePictureType, pictureValue: string | null) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  isInitialOnboarding?: boolean;
  onSkip?: () => void;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  onShowToast,
  isInitialOnboarding = false,
  onSkip,
}) => {
  // Current draft selection
  const [selectedType, setSelectedType] = useState<ProfilePictureType>(
    user.profilePictureType || (user.avatarUrl && !user.avatarUrl.includes('unsplash') ? 'uploaded' : 'none')
  );
  const [selectedPicture, setSelectedPicture] = useState<string | null>(
    user.profilePicture || (user.avatarUrl && !user.avatarUrl.includes('unsplash') ? user.avatarUrl : null)
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(user.profilePictureType || 'none');
      setSelectedPicture(user.profilePicture || null);
      setValidationError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Resolve current preview URL
  const getPreviewUrl = (): string => {
    if (selectedType === 'uploaded' && selectedPicture) {
      return selectedPicture;
    }
    if (selectedType === 'avatar' && selectedPicture) {
      const match = getAvatarById(selectedPicture);
      if (match) return match.url;
    }
    if (selectedType === 'none') {
      return NEUTRAL_DEFAULT_AVATAR_URL;
    }
    return user.avatarUrl || NEUTRAL_DEFAULT_AVATAR_URL;
  };

  const previewUrl = getPreviewUrl();
  const displayName = user.displayName || user.firstName || 'Ashton';

  // Handle personal photo upload with validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);

    // 1. Format validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      const msg = 'Please choose a JPG, PNG, or WEBP image.';
      setValidationError(msg);
      onShowToast?.(msg, 'warning');
      e.target.value = '';
      return;
    }

    // 2. Size validation (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const msg = 'This image is too large. Please choose a smaller photo.';
      setValidationError(msg);
      onShowToast?.(msg, 'warning');
      e.target.value = '';
      return;
    }

    setIsProcessingUpload(true);

    // Read and compress image client-side to ensure efficient localStorage storage
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let { width, height } = img;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas rendering context unavailable');
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

          setSelectedType('uploaded');
          setSelectedPicture(dataUrl);
          setIsProcessingUpload(false);
          onShowToast?.('Photo selected and preview ready', 'success');
        } catch (err) {
          setIsProcessingUpload(false);
          const msg = "Couldn't upload your photo. Please try again.";
          setValidationError(msg);
          onShowToast?.(msg, 'warning');
        }
      };
      img.onerror = () => {
        setIsProcessingUpload(false);
        const msg = "Couldn't upload your photo. Please try again.";
        setValidationError(msg);
        onShowToast?.(msg, 'warning');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsProcessingUpload(false);
      const msg = "Couldn't upload your photo. Please try again.";
      setValidationError(msg);
      onShowToast?.(msg, 'warning');
    };
    reader.readAsDataURL(file);

    // Clear input so same file can be re-selected if desired
    e.target.value = '';
  };

  // Select a 3D avatar from collection
  const handleSelectAvatar = (avatarId: string) => {
    setValidationError(null);
    setSelectedType('avatar');
    setSelectedPicture(avatarId);
  };

  // Reset to neutral default avatar
  const handleResetToNeutral = () => {
    setValidationError(null);
    setSelectedType('none');
    setSelectedPicture(null);
  };

  // Save changes
  const handleSave = () => {
    onSave(selectedType, selectedPicture);
    onShowToast?.('Profile picture updated successfully', 'success');
    onClose();
  };

  // Skip for now (onboarding)
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onSave('none', null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div
        id="profile-picture-modal-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[#0c1926]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          id="profile-picture-modal"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Ambient Subtle Header Tint */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#f0f7ff] via-[#f8fbfe]/50 to-transparent pointer-events-none" />

          {/* Modal Header */}
          <div className="relative z-10 flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/20">
                  DR. RADAR IDENTITY
                </span>
                <span className="text-[11px] font-mono text-slate-400">Optional</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#101c28] tracking-tight">
                Choose your profile picture
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add a photo or choose an avatar. You can change this anytime.
              </p>
            </div>

            <button
              id="profile-picture-modal-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              title="Close"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="relative z-10 overflow-y-auto pt-4 pb-2 space-y-5 no-scrollbar">
            {/* 1. Profile Picture Preview Area */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f8fbfe] border border-slate-200/80 flex flex-col items-center text-center space-y-3">
              {/* Circular Profile Picture */}
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-white border-2 border-[#bc000a] shadow-md overflow-hidden flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>

                {selectedType !== 'none' && (
                  <span
                    className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[12px] font-bold shadow-xs"
                    title="Active selection"
                  >
                    ✓
                  </span>
                )}
              </div>

              {/* Name & Selection Status */}
              <div>
                <h3 className="text-lg font-bold text-[#101c28] tracking-tight">{displayName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedType === 'uploaded' && 'Personal Photo • Centered crop'}
                  {selectedType === 'avatar' &&
                    `Dr. Radar 3D Avatar • ${getAvatarById(selectedPicture)?.name || 'Custom'}`}
                  {selectedType === 'none' && 'Neutral Default Avatar'}
                </p>
              </div>

              {/* Preview Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="profile-photo-upload-input"
                />

                <button
                  type="button"
                  id="profile-picture-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingUpload}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#bc000a]/40 text-slate-800 text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                    {selectedType === 'uploaded' ? 'sync' : 'add_a_photo'}
                  </span>
                  <span>{selectedType === 'uploaded' ? 'Change Photo' : 'Add Profile Picture'}</span>
                </button>

                {selectedType !== 'none' && (
                  <button
                    type="button"
                    id="profile-picture-remove-btn"
                    onClick={handleResetToNeutral}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 text-xs font-medium hover:bg-red-50/50 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-400 hover:text-red-600">
                      delete_outline
                    </span>
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              <p className="text-[10.5px] text-slate-400 leading-tight max-w-sm">
                Supported formats: JPG, JPEG, PNG, WEBP (up to 5MB). Photo is stored locally in your active browser session.
              </p>
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a] shrink-0 mt-0.5">
                  error
                </span>
                <span>{validationError}</span>
              </div>
            )}

            {/* 2. Divider OR */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
                OR
              </span>
            </div>

            {/* 3. Choose an Avatar Section */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Choose an avatar</h4>
                  <p className="text-[11px] text-slate-500">
                    Friendly 3D healthcare avatars. Anyone can choose any avatar.
                  </p>
                </div>
                {selectedType === 'avatar' && (
                  <span className="text-[10px] font-mono font-bold text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>

              {/* Avatar Grid: 4 columns on mobile, 6 on tablet/desktop */}
              <div
                role="radiogroup"
                aria-label="Dr. Radar 3D Avatars"
                className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-1"
              >
                {DR_RADAR_AVATARS.map((avatar) => {
                  const isSelected = selectedType === 'avatar' && selectedPicture === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      id={`avatar-option-${avatar.id}`}
                      onClick={() => handleSelectAvatar(avatar.id)}
                      className={`group relative flex flex-col items-center p-1.5 rounded-2xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bc000a]/30 ${
                        isSelected
                          ? 'bg-[#ffe8e8]/60 border-2 border-[#bc000a] shadow-xs scale-105'
                          : 'bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60'
                      }`}
                      title={`${avatar.name}: ${avatar.description}`}
                    >
                      {/* Circular Avatar */}
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-200 border border-slate-200/90 shadow-2xs">
                        <img
                          src={avatar.url}
                          alt={avatar.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      {/* Name label */}
                      <span
                        className={`text-[10.5px] mt-1 truncate max-w-full font-medium ${
                          isSelected ? 'font-bold text-[#bc000a]' : 'text-slate-700'
                        }`}
                      >
                        {avatar.name}
                      </span>

                      {/* Subtle Selected Checkmark Badge */}
                      {isSelected && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[10px] font-bold shadow-2xs"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Neutral Default Option Card */}
              <div className="mt-3.5">
                <button
                  type="button"
                  id="avatar-option-neutral-default"
                  onClick={handleResetToNeutral}
                  className={`w-full p-2.5 rounded-2xl border transition-all flex items-center gap-3 text-left cursor-pointer ${
                    selectedType === 'none'
                      ? 'border-[#bc000a] bg-[#ffe8e8]/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                    <img
                      src={NEUTRAL_DEFAULT_AVATAR_URL}
                      alt="Neutral default avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Neutral Default Avatar
                      </span>
                      {selectedType === 'none' && (
                        <span className="text-[10px] font-bold text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
                          Active Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Clean minimalist profile silhouette. No photo or character avatar.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="relative z-10 pt-4 border-t border-slate-100 flex items-center gap-2.5 justify-end">
            {isInitialOnboarding ? (
              <>
                <button
                  type="button"
                  id="profile-picture-skip-btn"
                  onClick={handleSkip}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
                >
                  Skip for Now
                </button>
                <button
                  type="button"
                  id="profile-picture-save-btn"
                  onClick={handleSave}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#bc000a] hover:bg-[#a50009] text-white text-xs font-bold transition-all shadow-md shadow-[#bc000a]/20 cursor-pointer active:scale-95"
                >
                  Save & Continue
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="profile-picture-cancel-btn"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="profile-picture-confirm-save-btn"
                  onClick={handleSave}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#bc000a] hover:bg-[#a50009] text-white text-xs font-bold transition-all shadow-md shadow-[#bc000a]/20 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Save Profile Picture</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
