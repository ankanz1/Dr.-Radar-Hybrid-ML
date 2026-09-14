import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onViewAnalysis?: () => void;
  onViewAppointment?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onViewAnalysis,
  onViewAppointment,
}) => {
  const [prescriptionLogged, setPrescriptionLogged] = useState(false);
  const [prescriptionSnoozed, setPrescriptionSnoozed] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState(3);

  if (!isOpen) return null;

  const handleLogTaken = () => {
    setPrescriptionLogged(true);
    setActiveAlertsCount((prev) => Math.max(0, prev - 1));
    onShowToast('Prescription logged: Lisinopril (10mg) taken', 'success');
  };

  const handleSnooze = () => {
    setPrescriptionSnoozed(true);
    onShowToast('Prescription reminder snoozed for 15 minutes', 'info');
  };

  const handleViewAnalysisClick = () => {
    onClose();
    if (onViewAnalysis) {
      onViewAnalysis();
    } else {
      onShowToast('Opening latest Lipid Panel AI Analysis...', 'info');
    }
  };

  const handleAppointmentClick = () => {
    onClose();
    if (onViewAppointment) {
      onViewAppointment();
    } else {
      onShowToast('Viewing appointment with Dr. Ronald', 'info');
    }
  };

  return (
    <AnimatePresence>
      <div
        id="notifications-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto no-scrollbar"
      >
        <motion.div
          id="notifications-sheet"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[420px] bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/[0.06] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[94vh]"
        >
          {/* Top Bar with Back Arrow */}
          <header className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                id="notifications-back-btn"
                onClick={onClose}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#101c28] hover:bg-black/5 active:scale-95 transition-all focus:outline-none cursor-pointer"
                title="Back"
                aria-label="Back"
              >
                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 className="text-[20px] font-bold text-[#101c28] tracking-tight">
                Notifications
              </h1>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 active:scale-95 transition-all focus:outline-none cursor-pointer"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </header>

          {/* Subtitle / Attention banner */}
          <div className="px-6 pt-1 pb-4">
            <p className="text-[15px] text-[#4b5563] leading-snug">
              <span className="text-[#bc000a] font-bold">
                {activeAlertsCount} active alert{activeAlertsCount === 1 ? '' : 's'}
              </span>{' '}
              logged for decision-support review.
            </p>
          </div>

          {/* Scrollable Notification List */}
          <div className="overflow-y-auto px-6 pb-6 space-y-6 no-scrollbar flex-1">
            {/* Section: TODAY */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-bold text-[#8c7873] tracking-widest uppercase">
                TODAY
              </h2>

              {/* Card 1: Prescription Reminder */}
              <div className="bg-[#fafafa] rounded-[24px] p-4 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all">
                <div className="flex items-start gap-3.5">
                  {/* Circular Red Pill Icon with Unread Red Dot */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#fde8e8] flex items-center justify-center text-[#bc000a] shadow-xs">
                      <svg
                        className="w-6 h-6 transform -rotate-45"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6 3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 10h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3z" opacity="0.3"/>
                        <path d="M4.5 10.5C2.5 8.5 2.5 5.3 4.5 3.3s5.2-2 7.2 0l7.8 7.8c2 2 2 5.2 0 7.2s-5.2 2-7.2 0L4.5 10.5z"/>
                        <path d="M12.3 11.1L8.5 7.3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* Unread Alert Dot Badge */}
                    {!prescriptionLogged && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#bc000a] rounded-full ring-2 ring-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[#101c28] tracking-tight leading-tight">
                        Prescription Reminder
                      </h3>
                      <span className="text-[12px] font-semibold text-[#8c7873] shrink-0">
                        9:00 AM
                      </span>
                    </div>

                    <p className="text-[13px] text-[#52525b] mt-1 leading-relaxed">
                      Time to take your morning dose of Lisinopril (10mg)....
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2.5 mt-3">
                      {prescriptionLogged ? (
                        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#16a34a] bg-[#dcfce7] px-3 py-1.5 rounded-full">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          <span>Logged as Taken</span>
                        </div>
                      ) : (
                        <>
                          <button
                            id="log-prescription-btn"
                            onClick={handleLogTaken}
                            className="bg-[#bc000a] text-white text-[13px] font-semibold px-4 py-1.5 rounded-full shadow-sm hover:bg-[#a50009] active:scale-95 transition-all focus:outline-none"
                          >
                            Log Taken
                          </button>
                          <button
                            id="snooze-prescription-btn"
                            onClick={handleSnooze}
                            disabled={prescriptionSnoozed}
                            className="bg-[#f0edef] text-[#1b1b1d] text-[13px] font-medium px-4 py-1.5 rounded-full hover:bg-slate-200 active:scale-95 transition-all focus:outline-none disabled:opacity-50"
                          >
                            {prescriptionSnoozed ? 'Snoozed' : 'Snooze'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: New Lab Results */}
              <div className="bg-[#fafafa] rounded-[24px] p-4 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all">
                <div className="flex items-start gap-3.5">
                  {/* Circular Blue Flask Icon */}
                  <div className="w-12 h-12 rounded-full bg-[#0284c7] flex items-center justify-center text-white shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">science</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[#101c28] tracking-tight leading-tight">
                        New Lab Results
                      </h3>
                      <span className="text-[12px] font-semibold text-[#8c7873] shrink-0">
                        11:30 AM
                      </span>
                    </div>

                    <p className="text-[13px] text-[#52525b] mt-1 leading-relaxed">
                      Your recent lipid panel results are ready to view. AI summar...
                    </p>

                    <button
                      id="view-analysis-link-btn"
                      onClick={handleViewAnalysisClick}
                      className="text-[13px] font-bold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 mt-2.5 group transition-colors focus:outline-none"
                    >
                      <span>View Analysis</span>
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: YESTERDAY */}
            <div className="space-y-3 pt-1">
              <h2 className="text-[11px] font-bold text-[#8c7873] tracking-widest uppercase">
                YESTERDAY
              </h2>

              {/* Card 3: Appointment Confirmed */}
              <div
                onClick={handleAppointmentClick}
                className="bg-[#fafafa] rounded-[24px] p-4 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-slate-50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  {/* Circular Green Calendar Icon */}
                  <div className="w-12 h-12 rounded-full bg-[#16a34a] flex items-center justify-center text-white shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">calendar_today</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[#101c28] tracking-tight leading-tight">
                        Appointment Confirmed
                      </h3>
                      <span className="text-[12px] font-semibold text-[#8c7873] shrink-0">
                        Yesterday
                      </span>
                    </div>

                    <p className="text-[13px] text-[#52525b] mt-1 leading-relaxed">
                      Follow-up with Dr. Ronald scheduled for Thursday at 2:00 PM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 4: Weekly Summary Ready */}
              <div
                onClick={handleViewAnalysisClick}
                className="bg-[#fafafa] rounded-[24px] p-4 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-slate-50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  {/* Circular Light Gray Heart Icon */}
                  <div className="w-12 h-12 rounded-full bg-[#e4e4e7] flex items-center justify-center text-[#52525b] shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">favorite_border</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[#101c28] tracking-tight leading-tight">
                        Weekly Summary Ready
                      </h3>
                      <span className="text-[12px] font-semibold text-[#8c7873] shrink-0">
                        Yesterday
                      </span>
                    </div>

                    <p className="text-[13px] text-[#52525b] mt-1 leading-relaxed">
                      Your average resting heart rate improved by 2 bpm this week. Keep it up!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom subtle indicator dot */}
            <div className="flex justify-center pt-2 pb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4d4d8]" />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
