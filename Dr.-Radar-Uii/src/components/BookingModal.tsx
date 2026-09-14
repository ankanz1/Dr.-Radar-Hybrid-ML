import { useState } from 'react';
import { Doctor } from '../types';

interface BookingModalProps {
  doctor: Doctor | null;
  onClose: () => void;
  onConfirm: (doctor: Doctor, slot: string, type: string) => void;
}

export const BookingModal = ({ doctor, onClose, onConfirm }: BookingModalProps) => {
  if (!doctor) return null;

  const [selectedSlot, setSelectedSlot] = useState(doctor.slots[0] || '14:30 PM');
  const [consultationType, setConsultationType] = useState<'video' | 'in-person'>('video');
  const [patientNote, setPatientNote] = useState('');

  const handleBooking = () => {
    onConfirm(doctor, selectedSlot, consultationType);
  };

  return (
    <div
      id="booking-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
    >
      <div
        id="booking-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
      >
        {/* Doctor Summary Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="flex items-center gap-3">
            <img
              src={doctor.avatarUrl}
              alt={doctor.name}
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#bc000a]/15 shadow-sm"
            />
            <div>
              <h3 className="font-bold text-base text-[#1b1b1d]">{doctor.name}</h3>
              <p className="text-xs text-[#5d3f3b]">{doctor.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#f0edef] flex items-center justify-center text-[#5d3f3b] hover:bg-black/10 transition-colors cursor-pointer"
            aria-label="Close booking modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Doctor Bio Snippet */}
        <div className="bg-[#f6f3f5] p-3 rounded-2xl text-xs text-[#5d3f3b] space-y-1">
          <div className="flex items-center justify-between text-[#1b1b1d] font-semibold">
            <span>{doctor.hospital}</span>
            <span className="text-[#bc000a] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">star</span>
              {doctor.rating}
            </span>
          </div>
          <p className="line-clamp-2">{doctor.about}</p>
        </div>

        {/* Consultation Mode */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#5d3f3b] block">
            Consultation Mode
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setConsultationType('video')}
              className={`p-2.5 rounded-2xl flex items-center justify-center gap-2 border transition-all ${
                consultationType === 'video'
                  ? 'bg-[#ffdad5]/40 border-[#bc000a] text-[#bc000a] font-semibold'
                  : 'bg-[#f6f3f5] border-transparent text-[#5d3f3b]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              Telehealth
            </button>
            <button
              onClick={() => setConsultationType('in-person')}
              className={`p-2.5 rounded-2xl flex items-center justify-center gap-2 border transition-all ${
                consultationType === 'in-person'
                  ? 'bg-[#ffdad5]/40 border-[#bc000a] text-[#bc000a] font-semibold'
                  : 'bg-[#f6f3f5] border-transparent text-[#5d3f3b]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">apartment</span>
              In-Clinic
            </button>
          </div>
        </div>

        {/* Available Time Slots */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#5d3f3b] block">
            Select Time Slot ({doctor.availableTag})
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {doctor.slots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                  selectedSlot === slot
                    ? 'bg-[#bc000a] text-white border-[#bc000a] shadow-sm shadow-[#bc000a]/20'
                    : 'bg-[#f6f3f5] border-transparent text-[#1b1b1d] hover:bg-[#eae7ea]'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Symptoms / Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#5d3f3b] block">
            Reason / Symptoms (Optional)
          </label>
          <input
            type="text"
            value={patientNote}
            onChange={(e) => setPatientNote(e.target.value)}
            placeholder="e.g. Holter report review, palpitations"
            className="w-full px-3.5 py-2.5 text-xs bg-[#f6f3f5] rounded-xl border border-black/5 focus:outline-none focus:border-[#bc000a] transition-all"
          />
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleBooking}
          className="w-full min-h-[44px] py-3 rounded-full bg-[#bc000a] text-white text-xs font-semibold shadow-md shadow-[#bc000a]/25 hover:bg-[#a50009] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          <span>Confirm Appointment ({selectedSlot})</span>
        </button>
      </div>
    </div>
  );
};
