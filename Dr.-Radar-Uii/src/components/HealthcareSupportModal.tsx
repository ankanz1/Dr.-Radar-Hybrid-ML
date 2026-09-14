import { BookingScreen } from './BookingScreen';

interface HealthcareSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HealthcareSupportModal = ({
  isOpen,
  onClose,
}: HealthcareSupportModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      id="healthcare-support-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#f8fbfe]">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#101c28]">
                Electrophysiology Case Audit & Clinical Review
              </h3>
              <p className="text-[11px] text-[#5c7b99]">
                Secondary clinical validation & cardiologist case audit (Research Decision Support)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Content - wraps BookingScreen with contained scroll */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          <BookingScreen />
        </div>
      </div>
    </div>
  );
};
