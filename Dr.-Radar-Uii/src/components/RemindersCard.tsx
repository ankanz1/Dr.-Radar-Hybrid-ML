import React from 'react';

interface RemindersCardProps {
  enabled: boolean;
  time: string;
  permission: NotificationPermission | 'unsupported';
  isSupported: boolean;
  onToggle: () => void;
  onTimeChange: (newTime: string) => void;
  onTestNotification: () => void;
  onRequestPermission: () => void;
  onOpenSettings?: () => void;
}

export const RemindersCard: React.FC<RemindersCardProps> = ({
  enabled,
  time,
  permission,
  isSupported,
  onToggle,
  onTimeChange,
  onTestNotification,
  onRequestPermission,
  onOpenSettings,
}) => {
  return (
    <section id="reminders-card-section" className="relative space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[#1b1b1d] tracking-tight">Daily Reminders</h3>
        {onOpenSettings && (
          <button
            id="open-reminders-settings-btn"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-[#bc000a] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Settings
          </button>
        )}
      </div>

      <div className="matte-3d-card relative rounded-3xl overflow-hidden p-5">
        {/* Top subtle highlight refraction line */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent" />

        {/* Ambient Red Glow when enabled */}
        {enabled && (
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-[#bc000a]/10 rounded-full blur-2xl pointer-events-none transition-opacity" />
        )}

        {/* Header with Icon, Title, and Toggle */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                enabled
                  ? 'bg-[#bc000a] text-white shadow-[#bc000a]/20'
                  : 'bg-[#f0edef] text-[#5d3f3b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {enabled ? 'notifications_active' : 'notifications'}
              </span>
            </div>
            <div>
              <h4 className="font-semibold text-[15px] text-[#1b1b1d] leading-tight">
                Daily Check-in
              </h4>
              <p className="text-xs text-[#5d3f3b] mt-0.5">
                {enabled ? `Scheduled daily at ${time}` : 'Browser notifications disabled'}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            id="reminders-toggle-btn"
            role="switch"
            aria-checked={enabled}
            onClick={onToggle}
            className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#bc000a]/30 shadow-inner ${
              enabled ? 'bg-[#bc000a]' : 'bg-[#e0dcd0]/80'
            }`}
            title={enabled ? 'Turn reminders off' : 'Turn reminders on'}
          >
            <div
              className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Active Controls Drawer */}
        {enabled && (
          <div className="mt-4 pt-3 border-t border-black/5 space-y-3 relative z-10 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Permission Warning if not granted */}
            {isSupported && permission === 'denied' && (
              <div className="bg-[#ffdad5]/50 border border-[#ba1a1a]/20 rounded-2xl p-3 text-xs text-[#ba1a1a] flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex-1 leading-snug">
                  <span className="font-semibold">Browser notifications blocked.</span>
                  <p className="mt-0.5 text-[11px] text-[#410001]/80">
                    Click your browser address bar's lock icon to allow notifications for Dr. Radar.
                  </p>
                </div>
              </div>
            )}

            {isSupported && permission === 'default' && (
              <div className="bg-[#fff0eb] border border-[#bc000a]/20 rounded-2xl p-3 text-xs text-[#1b1b1d] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                    info
                  </span>
                  <span className="text-[11px] text-[#5d3f3b]">Permission required to notify</span>
                </div>
                <button
                  id="grant-notification-permission-btn"
                  onClick={onRequestPermission}
                  className="px-2.5 py-1 bg-[#bc000a] text-white text-[11px] font-semibold rounded-lg shadow-sm hover:bg-[#a50009] transition-all"
                >
                  Allow
                </button>
              </div>
            )}

            {/* Time Selector & Test Button */}
            <div className="flex items-center justify-between gap-3 bg-white/60 backdrop-blur-md rounded-2xl p-3 border border-white/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#5d3f3b]">
                  schedule
                </span>
                <span className="text-xs font-medium text-[#5d3f3b]">Reminder Time:</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="reminder-time-picker"
                  type="time"
                  value={time}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="bg-white px-2.5 py-1 rounded-xl text-xs font-semibold text-[#1b1b1d] border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#bc000a]/30 cursor-pointer shadow-sm"
                />
              </div>
            </div>

            {/* Action Buttons: Test Notification */}
            <div className="flex items-center gap-2">
              <button
                id="send-test-notification-btn"
                onClick={onTestNotification}
                className="flex-1 py-2.5 px-3 bg-white/80 hover:bg-white text-[#bc000a] text-xs font-semibold rounded-xl border border-black/5 shadow-[0_2px_8px_rgba(188,0,10,0.06)] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                Test Notification Now
              </button>

              <div className="px-3 py-2 bg-[#006b27]/10 border border-[#006b27]/20 rounded-xl flex items-center gap-1.5 text-[11px] font-semibold text-[#006b27] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#006b27] animate-pulse" />
                <span>Active</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
