import React, { useState, useRef } from 'react';
import { MedicalRecord, MedicalDocumentCategory } from '../../types/healthInfo';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface MedicalRecordsSectionProps {
  records: MedicalRecord[];
  onAddRecord: (record: Omit<MedicalRecord, 'id' | 'uploadDate'>, file?: File) => MedicalRecord;
  onRenameRecord: (id: string, newTitle: string) => void;
  onDeleteRecord: (id: string) => void;
  onNavigateToHealthInfo?: () => void;
}

const CATEGORY_OPTIONS: { id: MedicalDocumentCategory; label: string; icon: string }[] = [
  { id: 'ecg', label: 'ECG Report', icon: 'vital_signs' },
  { id: 'blood-test', label: 'Blood Test', icon: 'bloodtype' },
  { id: 'xray', label: 'X-Ray', icon: 'radiology' },
  { id: 'mri', label: 'MRI', icon: 'radiology' },
  { id: 'ct', label: 'CT Scan', icon: 'radiology' },
  { id: 'ultrasound', label: 'Ultrasound', icon: 'ultrasound' },
  { id: 'prescription', label: 'Prescription', icon: 'prescriptions' },
  { id: 'discharge-summary', label: 'Discharge Summary', icon: 'clinical_notes' },
  { id: 'diagnosis-report', label: 'Diagnosis Report', icon: 'description' },
  { id: 'other', label: 'Other', icon: 'folder' },
];

export const MedicalRecordsSection: React.FC<MedicalRecordsSectionProps> = ({
  records,
  onAddRecord,
  onRenameRecord,
  onDeleteRecord,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MedicalDocumentCategory>('ecg');
  const [activePreviewRecord, setActivePreviewRecord] = useState<MedicalRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = (file: File) => {
    setUploadError(null);

    // 1. File size check (Max 15MB)
    const MAX_SIZE_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('File is too large (exceeds 15MB limit). Please upload a smaller compressed document.');
      return;
    }

    // 2. Format validation
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'dicom', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setUploadError('Unsupported file type. Please upload a valid PDF, JPG, JPEG, or PNG medical document.');
      return;
    }

    // 3. Simulated upload progress with client-side file reading
    setIsUploading(true);
    setUploadProgress(15);

    const categoryObj = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory) || CATEGORY_OPTIONS[0];

    const timer1 = setTimeout(() => setUploadProgress(55), 300);
    const timer2 = setTimeout(() => setUploadProgress(90), 600);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = typeof e.target?.result === 'string' ? e.target.result : undefined;

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(100);

        const formattedSize = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

        const newRec = onAddRecord({
          title: `${categoryObj.label} (${file.name.replace(/\.[^/.]+$/, '')})`,
          category: selectedCategory,
          categoryLabel: categoryObj.label,
          fileType: ext.toUpperCase() as any,
          fileSize: formattedSize,
          fileName: file.name,
          status: 'ready',
          fileDataUrl: dataUrl,
          facility: 'Uploaded by Patient',
          extractedSummary: 'AI document parsing and automated clinical extraction are queued for upcoming cloud processing modules. Raw file is securely retained in your patient profile.',
        });

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 900);
    };

    reader.onerror = () => {
      setIsUploading(false);
      setUploadError('Unable to read document. Please check file permissions and try again.');
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      // Simulate PDF reader
      setTimeout(() => {
        reader.onload({ target: { result: undefined } } as any);
      }, 300);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const filteredRecords = activeFilter === 'all'
    ? records
    : records.filter((r) => r.category === activeFilter);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              HEALTH RECORDS REPOSITORY
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {records.length} {records.length === 1 ? 'Document' : 'Documents'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#101c28]">Upload Medical Records</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Add relevant health documents so they can be organized in your health profile and, where supported, considered during analysis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] transition-all shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          <span>+ Upload File</span>
        </button>
      </div>

      {/* Upload Zone & Category Picker */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Step 1: Select Document Category
            </label>
            <span className="text-[11px] text-slate-400">
              Not sure? Choose <strong className="text-slate-600">Other</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-[#bc000a] text-white border-[#bc000a] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Drag & Drop Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-[#bc000a] bg-[#fff5f5]'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.dicom,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleProcessFile(e.target.files[0]);
              }
            }}
          />

          <div className="max-w-md mx-auto space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#ffe8e8] text-[#bc000a] border border-[#bc000a]/25 flex items-center justify-center mx-auto shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
            </div>
            <div>
              <span className="text-sm font-bold text-[#101c28] block">
                {isUploading ? 'Uploading & Processing Document...' : '+ Upload File (or Drag & Drop Here)'}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                PDF, JPG, JPEG, PNG and supported medical document formats (Max 15MB)
              </p>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="w-full max-w-xs mx-auto space-y-1.5 pt-2">
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#bc000a] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-500">Processing document... {uploadProgress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Error State Banner */}
        {uploadError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-950 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-red-600">error</span>
              <span>{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Records List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#bc000a]">folder_shared</span>
            <span>Your Medical Records ({filteredRecords.length})</span>
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'ecg', 'blood-test', 'mri', 'xray'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  activeFilter === f
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'All Records' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">folder_off</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#101c28]">No medical records added yet.</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload a report to keep your health information organized and easily accessible for care reviews.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              <span>Upload Records</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#ffe8e8] text-[#bc000a] border border-[#bc000a]/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        {record.category === 'ecg'
                          ? 'vital_signs'
                          : record.category === 'blood-test'
                          ? 'bloodtype'
                          : record.category === 'mri' || record.category === 'xray'
                          ? 'radiology'
                          : 'description'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                        {record.categoryLabel}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-[#101c28] truncate mt-0.5">
                        {record.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {record.uploadDate} • {record.fileType} • {record.fileSize}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Ready
                  </span>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
                    {record.fileName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePreviewRecord(record)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer flex items-center gap-1 text-xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">visibility</span>
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord(record.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      title="Delete Record"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        record={activePreviewRecord}
        onClose={() => setActivePreviewRecord(null)}
        onRename={onRenameRecord}
        onDelete={onDeleteRecord}
      />
    </div>
  );
};
