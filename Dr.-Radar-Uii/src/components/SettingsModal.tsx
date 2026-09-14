import React from 'react';
import { ASSETS } from '../data/mockData';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  remindersEnabled: boolean;
  reminderTime: string;
  soundEnabled: boolean;
  permission: NotificationPermission | 'unsupported';
  isSupported: boolean;
  onToggleReminders: () => void;
  onTimeChange: (newTime: string) => void;
  onToggleSound: () => void;
  onTestNotification: () => void;
  onRequestPermission: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  remindersEnabled,
  reminderTime,
  soundEnabled,
  permission,
  isSupported,
  onToggleReminders,
  onTimeChange,
  onToggleSound,
  onTestNotification,
  onRequestPermission,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="settings-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="matte-3d-card w-full max-w-sm rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#bc000a]/10 flex items-center justify-center text-[#bc000a]">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#1b1b1d] text-base">Dr. Radar Settings</h3>
              <p className="text-xs text-[#5d3f3b]">Preferences & Quantum Telemetry</p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0edef] flex items-center justify-center text-[#5d3f3b] hover:bg-black/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Section: Reminders & Notification API */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5d3f3b]">
              DAILY CHECK-IN NOTIFICATIONS
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                permission === 'granted'
                  ? 'bg-[#006b27]/10 text-[#006b27]'
                  : permission === 'denied'
                  ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                  : 'bg-black/5 text-[#5d3f3b]'
              }`}
            >
              {permission === 'granted'
                ? 'API Allowed'
                : permission === 'denied'
                ? 'API Blocked'
                : 'API Default'}
            </span>
          </div>

          {/* Main Reminders Toggle Card */}
          <div className="bg-[#f6f3f5] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#bc000a] text-[20px]">
                  notifications
                </span>
                <div>
                  <h4 className="font-semibold text-xs text-[#1b1b1d]">Daily Reminders</h4>
                  <p className="text-[11px] text-[#5d3f3b]">
                    Schedule daily cardiac check-in prompt
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                id="settings-reminders-toggle"
                role="switch"
                aria-checked={remindersEnabled}
                onClick={onToggleReminders}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                  remindersEnabled ? 'bg-[#bc000a]' : 'bg-[#d3cfce]'
                }`}
              >
                <div
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                    remindersEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {remindersEnabled && (
              <div className="pt-2 border-t border-black/5 space-y-2.5">
                {/* Time Setting */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5d3f3b]">Scheduled Time</span>
                  <input
                    id="settings-reminder-time-input"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => onTimeChange(e.target.value)}
                    className="bg-white px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1b1b1d] border border-black/10 focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                  />
                </div>

                {/* Sound Alert Toggle */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5d3f3b]">Alert Sound</span>
                  <button
                    id="toggle-alert-sound-btn"
                    onClick={onToggleSound}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      soundEnabled ? 'bg-white text-[#bc000a]' : 'bg-black/5 text-[#5d3f3b]'
                    }`}
                  >
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>

                {/* Permission status prompt if not granted */}
                {isSupported && permission !== 'granted' && (
                  <div className="bg-white/80 p-2.5 rounded-xl border border-black/5 text-[11px] flex items-center justify-between gap-2">
                    <span className="text-[#5d3f3b]">Browser permission:</span>
                    <button
                      id="settings-grant-permission-btn"
                      onClick={onRequestPermission}
                      className="px-2 py-0.5 bg-[#bc000a] text-white rounded text-[10px] font-semibold"
                    >
                      Request Now
                    </button>
                  </div>
                )}

                {/* Test notification button */}
                <button
                  id="settings-test-notification-btn"
                  onClick={onTestNotification}
                  className="w-full py-2 bg-white text-[#bc000a] rounded-xl text-xs font-semibold border border-black/5 hover:bg-white/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">send</span>
                  Send Test Notification
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section: Patient Profile & Sensor Status */}
        <section className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5d3f3b]">
            CONNECTED SENSOR & TELEMETRY
          </span>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="bg-[#f6f3f5] p-3 rounded-2xl">
              <span className="text-[#5d3f3b] block">Patch Sensor</span>
              <span className="text-xs font-semibold text-[#006b27] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006b27] animate-ping" />
                Dr. Radar Bio-Patch #84
              </span>
            </div>
            <div className="bg-[#f6f3f5] p-3 rounded-2xl">
              <span className="text-[#5d3f3b] block">Battery Level</span>
              <span className="text-xs font-semibold text-[#1b1b1d] mt-0.5 block">
                94% (4.2 days left)
              </span>
            </div>
          </div>
        </section>

        {/* Action Button */}
        <button
          id="close-settings-done-btn"
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-[#bc000a] text-white text-xs font-semibold shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all"
        >
          Save & Done
        </button>
      </div>
    </div>
  );
};
