import { useState } from 'react';
import { Doctor } from '../types';
import { INITIAL_DOCTORS } from '../data/mockData';
import { BookingModal } from './BookingModal';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';

export const BookingScreen = () => {
  const [doctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'cardiology' | 'electrophysiology' | 'topRated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [bookingToast, setBookingToast] = useState<string | null>(null);

  const filteredDoctors = doctors.filter((doc) => {
    // Search query matching
    const matchesSearch =
      searchQuery.trim() === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.hospital && doc.hospital.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Filter pill matching
    if (activeFilter === 'today') return doc.isAvailableToday;
    if (activeFilter === 'cardiology') return doc.specialty.toLowerCase().includes('cardio');
    if (activeFilter === 'electrophysiology') return doc.specialty.toLowerCase().includes('electro');
    if (activeFilter === 'topRated') return doc.rating >= 4.9;
    return true;
  });

  const handleConfirmAppointment = (doctor: Doctor, slot: string, type: string) => {
    setSelectedDoctorForBooking(null);
    setBookingToast(
      `Appointment booked with ${doctor.name} for ${slot} (${type === 'video' ? 'Telehealth' : 'In-Person'})`
    );
    setTimeout(() => {
      setBookingToast(null);
    }, 4000);
  };

  return (
    <div
      id="booking-screen-container"
      className="relative min-h-screen pb-32 pt-2 w-full max-w-full overflow-y-auto"
    >
      {/* Toast Notification */}
      {bookingToast && (
        <div
          id="booking-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-center max-w-xs"
        >
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">
            check_circle
          </span>
          <span className="truncate">{bookingToast}</span>
        </div>
      )}

      {/* Decorative ambient background glow */}
      <div className="absolute top-0 right-0 w-full h-48 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 right-0 w-80 h-80 bg-[#bae0fd]/30 rounded-full blur-3xl" />
      </div>

      {/* Static Header & Controls Section - NO STICKY OVERLAP */}
      <div id="booking-header-section" className="relative z-10 px-5 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#101c28] tracking-tight">
              Specialists
            </h2>
            <p className="text-xs text-[#34485e]">
              Certified cardiac & electrophysiology consultants
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[#006b27] bg-[#72fe88]/20 px-2.5 py-1 rounded-full border border-[#006b27]/20 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006b27] animate-pulse" />
            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Doctor' : 'Doctors'}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c7b99] text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by doctor, hospital, or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="matte-3d-card w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs text-[#101c28] placeholder:text-[#5c7b99] focus:outline-none focus:ring-1 focus:ring-[#d81b24]/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c7b99] hover:text-[#101c28]"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          <button
            id="filter-all-btn"
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeFilter === 'all'
                ? 'bg-[#d81b24] text-white border-[#d81b24]'
                : 'matte-3d-card text-[#34485e]'
            }`}
          >
            All Specialists ({doctors.length})
          </button>

          <button
            id="filter-today-btn"
            onClick={() => setActiveFilter('today')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeFilter === 'today'
                ? 'bg-[#d81b24] text-white border-[#d81b24]'
                : 'matte-3d-card text-[#34485e]'
            }`}
          >
            Available Today
          </button>

          <button
            id="filter-cardiology-btn"
            onClick={() => setActiveFilter('cardiology')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeFilter === 'cardiology'
                ? 'bg-[#d81b24] text-white border-[#d81b24]'
                : 'matte-3d-card text-[#34485e]'
            }`}
          >
            Cardiology
          </button>

          <button
            id="filter-electrophysiology-btn"
            onClick={() => setActiveFilter('electrophysiology')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeFilter === 'electrophysiology'
                ? 'bg-[#d81b24] text-white border-[#d81b24]'
                : 'matte-3d-card text-[#34485e]'
            }`}
          >
            Electrophysiology
          </button>

          <button
            id="filter-top-rated-btn"
            onClick={() => setActiveFilter('topRated')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeFilter === 'topRated'
                ? 'bg-[#d81b24] text-white border-[#d81b24]'
                : 'matte-3d-card text-[#34485e]'
            }`}
          >
            Top Rated (4.9+)
          </button>
        </div>
      </div>

      {/* Doctor Cards List - Flow layout with clear spacing */}
      <section id="doctor-list-section" className="relative z-10 px-5 flex flex-col gap-3.5 mt-1">
        {filteredDoctors.length === 0 ? (
          <div className="text-center py-12 rounded-3xl bg-white/70 backdrop-blur-md p-6 border border-white">
            <span className="material-symbols-outlined text-4xl text-[#5c7b99] mb-2">
              person_search
            </span>
            <p className="text-sm font-semibold text-[#101c28]">No specialists found</p>
            <p className="text-xs text-[#34485e] mt-1">
              Try switching your filter or clearing the search query
            </p>
            <button
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-4 py-1.5 bg-[#d81b24] text-white rounded-full text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredDoctors.map((doctor) => (
            <article
              key={doctor.id}
              id={`doctor-card-${doctor.id}`}
              className="matte-3d-card relative rounded-3xl p-4"
            >
              {/* Doctor Details Row */}
              <div className="flex gap-3.5 items-start mb-3">
                {/* Doctor Avatar */}
                <div className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden shadow-sm border border-white bg-slate-100">
                  <img
                    alt={doctor.name}
                    className="w-full h-full object-cover"
                    src={doctor.avatarUrl}
                  />
                  {doctor.isAvailableToday && (
                    <div
                      title="Available Today"
                      className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#006b27] rounded-full ring-2 ring-white"
                    />
                  )}
                </div>

                {/* Doctor Info (No truncation) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5 mb-0.5">
                    <h3 className="text-base font-bold text-[#101c28] leading-tight">
                      {doctor.name}
                    </h3>
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shrink-0">
                      <span className="material-symbols-outlined text-[13px] text-amber-600 fill-current">
                        star
                      </span>
                      <span className="text-[11px] font-bold text-[#101c28]">
                        {doctor.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-[#d81b24] mb-1">
                    {doctor.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#34485e]">
                    {doctor.hospital && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-[#5c7b99]">
                          domain
                        </span>
                        <span>{doctor.hospital}</span>
                      </span>
                    )}
                    {doctor.experienceYears && (
                      <span className="text-[#34485e]/80">
                        • {doctor.experienceYears} yrs exp.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio Snippet */}
              {doctor.about && (
                <p className="text-[11.5px] text-[#34485e] leading-relaxed bg-black/[0.02] p-2.5 rounded-2xl border border-black/[0.03] mb-3">
                  {doctor.about}
                </p>
              )}

              {/* Bottom Action Row */}
              <div className="flex items-center justify-between pt-2.5 border-t border-black/[0.05] gap-2">
                <div>
                  <span className="text-[10px] text-[#5c7b99] block uppercase tracking-wider font-semibold">
                    Next Available
                  </span>
                  <span className="text-xs font-bold text-[#101c28] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#006b27]">
                      event_available
                    </span>
                    {doctor.nextAvailable}
                  </span>
                </div>

                <button
                  id={`book-btn-${doctor.id}`}
                  onClick={() => setSelectedDoctorForBooking(doctor)}
                  className="bg-[#d81b24] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-md shadow-[#d81b24]/20 hover:bg-[#bf161e] active:scale-95 transition-all flex items-center gap-1.5 focus:outline-none shrink-0"
                >
                  <span>Book Appointment</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Subtle Clinical Non-Diagnostic Disclaimer */}
      <ClinicalDisclaimer className="mt-4 mb-2" />

      {/* Booking Modal */}
      <BookingModal
        doctor={selectedDoctorForBooking}
        onClose={() => setSelectedDoctorForBooking(null)}
        onConfirm={handleConfirmAppointment}
      />
    </div>
  );
};
