import React, { useState } from 'react';
import { MedicalRecord } from '../../types/healthInfo';

interface DocumentPreviewModalProps {
  record: MedicalRecord | null;
  onClose: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  record,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(record?.title || '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!record) return null;

  const handleSaveTitle = () => {
    if (editedTitle.trim()) {
      onRename(record.id, editedTitle.trim());
      setIsEditingTitle(false);
    }
  };

  const getCategoryIcon = (category: MedicalRecord['category']) => {
    switch (category) {
      case 'ecg':
        return 'vital_signs';
      case 'blood-test':
        return 'bloodtype';
      case 'xray':
      case 'mri':
      case 'ct':
      case 'ultrasound':
        return 'radiology';
      case 'prescription':
        return 'prescriptions';
      case 'discharge-summary':
      case 'diagnosis-report':
        return 'clinical_notes';
      default:
        return 'description';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
              title="Close Preview"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
                MEDICAL RECORD PREVIEW
              </span>
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-sm font-bold text-[#101c28] border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:border-[#bc000a]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="text-xs bg-[#bc000a] text-white px-2 py-1 rounded font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedTitle(record.title);
                      setIsEditingTitle(false);
                    }}
                    className="text-xs text-slate-500 px-1 py-1 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-base sm:text-lg font-extrabold text-[#101c28] truncate">
                    {record.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedTitle(record.title);
                      setIsEditingTitle(true);
                    }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Rename Document"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Metadata Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
              <span className="font-bold text-[#101c28] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a]">
                  {getCategoryIcon(record.category)}
                </span>
                <span className="truncate">{record.categoryLabel}</span>
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Upload Date</span>
              <span className="font-bold text-[#101c28] mt-0.5 block">{record.uploadDate}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Format & Size</span>
              <span className="font-bold text-[#101c28] mt-0.5 block">
                {record.fileType} • {record.fileSize}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Ready
              </span>
            </div>
          </div>

          {/* Document Preview Area */}
          <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 shadow-inner relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            {record.fileDataUrl ? (
              <img
                src={record.fileDataUrl}
                alt={record.title}
                className="max-h-[320px] max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="text-center space-y-3 py-6 max-w-md">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 mx-auto flex items-center justify-center text-[#bc000a] shadow-md">
                  <span className="material-symbols-outlined text-[32px] text-white">
                    {getCategoryIcon(record.category)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-300 block">{record.fileName}</span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {record.facility || 'Clinical Document Repository'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-slate-200 text-xs font-mono border border-white/15">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Authentic Patient File Attached</span>
                </div>
              </div>
            )}
          </div>

          {/* Transparent AI-Extracted Information Section */}
          <div className="p-4 rounded-2xl bg-[#f8fbfe] border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a]">auto_awesome</span>
                AI-Extracted Information
              </h4>
              <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Module Notice
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automated optical character recognition (OCR) and clinical biomarker extraction are currently queued for upcoming cloud processing modules. To ensure uncompromising medical accuracy, Dr. Radar does not present simulated or unverified AI biomarker extractions.
            </p>
            {record.notes && (
              <div className="mt-2 pt-2 border-t border-blue-100/80 text-xs text-slate-700">
                <span className="font-bold block text-slate-900 mb-0.5">Clinical Note / Context:</span>
                {record.notes}
              </div>
            )}
          </div>

          {/* Delete Confirmation Alert */}
          {showConfirmDelete && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-xs text-red-700">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Are you sure you want to remove this record?</span>
              </div>
              <p className="text-xs text-red-800">
                This document will be removed from your active Dr. Radar patient health context.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 bg-white border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(record.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {!showConfirmDelete ? (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Delete Record</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditedTitle(record.title);
                setIsEditingTitle(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#bc000a] hover:bg-[#a00008] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
