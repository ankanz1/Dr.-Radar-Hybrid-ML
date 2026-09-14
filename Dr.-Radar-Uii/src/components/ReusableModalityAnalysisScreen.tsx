import React, { useState } from 'react';
import { ClinicalModalityTest } from '../types';
import { CLINICAL_AREAS } from '../data/clinicalAreasData';
import { TreatmentRecommendationCard } from './recommendations/TreatmentRecommendationCard';
import { AssistantContext } from '../types/assistant';

interface ReusableModalityAnalysisScreenProps {
  testId?: string;
  onBackToAnalysisHub: () => void;
  onNavigateToEcgAnalysis?: () => void;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  onBookAppointment?: () => void;
}

export const ReusableModalityAnalysisScreen: React.FC<ReusableModalityAnalysisScreenProps> = ({
  testId = 'imaging-cxr',
  onBackToAnalysisHub,
  onNavigateToEcgAnalysis,
  onOpenAssistant,
  onBookAppointment,
}) => {
  // Find test by id or fallback to Chest X-ray
  let activeTest: ClinicalModalityTest | undefined;
  for (const area of CLINICAL_AREAS) {
    const found = area.tests.find((t) => t.id === testId);
    if (found) {
      activeTest = found;
      break;
    }
  }

  if (!activeTest) {
    activeTest = CLINICAL_AREAS[1].tests[0]; // Chest X-ray default
  }

  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'pipeline'>('overview');

  // If this test is ECG, we offer a direct prompt to launch the live working ECG engine
  const isEcg = activeTest.id === 'ecg-arrhythmia';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBackToAnalysisHub}
              className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Analysis Hub
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              {activeTest.areaId.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {activeTest.code}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            {activeTest.modalityType === 'image'
              ? 'MEDICAL IMAGE ANALYSIS'
              : activeTest.modalityType === 'tabular'
              ? 'CHRONIC DISEASE ANALYSIS'
              : 'ECG ANALYSIS'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {activeTest.name} • Standardized Multimodal Clinical Decision-Support Framework
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {isEcg && onNavigateToEcgAnalysis ? (
            <button
              onClick={onNavigateToEcgAnalysis}
              className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">vital_signs</span>
              Launch Active ECG Analyzer
            </button>
          ) : (
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-mono font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Planned Clinical Module
            </div>
          )}
        </div>
      </div>

      {/* Honest Scientific Status Banner */}
      <div className="bg-[#f0f7ff] border border-[#cbe2fc] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#cbe2fc] text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#101c28]">Standardized Interface Architecture</span>
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200">
                {activeTest.badge}
              </span>
            </div>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Dr. Radar uses a uniform multimodal result hierarchy across all clinical modules. To preserve medical integrity, only validated pipelines produce active outputs.
            </p>
          </div>
        </div>

        {isEcg && onNavigateToEcgAnalysis && (
          <button
            onClick={onNavigateToEcgAnalysis}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#bc000a]/30 text-[#bc000a] text-xs font-semibold hover:bg-[#ffe8e8] transition-all shrink-0 cursor-pointer"
          >
            Switch to Active Beat Classifier →
          </button>
        )}
      </div>

      {/* REUSABLE ANALYSIS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols on lg): Patient Info + Input Data Viewer */}
        <div className="lg:col-span-7 space-y-5">
          {/* SECTION 1: Patient Information */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">person</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Patient Information
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Record #PT-9042</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Name</span>
                <span className="font-bold text-slate-800">Ashton Miller</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Age / Sex</span>
                <span className="font-bold text-slate-800">54 Y • Male</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Admission ID</span>
                <span className="font-mono text-slate-800 font-semibold">ADM-2023-88</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Referring Dept</span>
                <span className="font-bold text-[#bc000a]">
                  {activeTest.areaId === 'cardiology'
                    ? 'Cardiology'
                    : activeTest.areaId === 'imaging'
                    ? 'Radiology'
                    : activeTest.areaId === 'chronic'
                    ? 'Endocrinology'
                    : activeTest.areaId === 'cancer'
                    ? 'Oncology'
                    : 'Hepatology'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Input Modality Viewer (Waveform / Image / Tabular) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                  {activeTest.modalityType === 'image'
                    ? 'image'
                    : activeTest.modalityType === 'tabular'
                    ? 'table_chart'
                    : 'show_chart'}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Input Data: {activeTest.sampleInputName}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {activeTest.modalityType.toUpperCase()} INGESTION
              </span>
            </div>

            {/* Render input representation based on modality */}
            {activeTest.modalityType === 'image' ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-4/3 flex flex-col items-center justify-center border border-slate-800 text-center p-6 select-none">
                  {/* Simulated Radiographic Scaffolding */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

                  <div className="relative z-10 space-y-2 max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                      <span className="material-symbols-outlined text-[36px]">radiology</span>
                    </div>
                    <div className="text-white text-sm font-bold tracking-tight">
                      Standardized DICOM / PNG Interface
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      512×512 high-resolution medical imaging container with multi-scale Radon transform and quantum tensor contraction.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                        16-bit Grayscale
                      </span>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                        DICOM Metadata Parsed
                      </span>
                    </div>
                  </div>

                  {/* Anatomical calibration grid watermark */}
                  <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-600">
                    DR. RADAR • VISION FRAMEWORK v2.4
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Window: Lung Parenchyma (W: 1500, L: -600)</span>
                  <span className="font-mono text-[11px]">FOV: 350 mm • Matrix: 512×512</span>
                </div>
              </div>
            ) : activeTest.modalityType === 'tabular' ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    Standardized Clinical Input Vectors
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Biomarker / Feature</span>
                      <span className="font-bold text-slate-800">Fasting Glucose</span>
                      <span className="text-[10px] font-mono text-slate-500 block">112 mg/dL</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Glycated Hemoglobin</span>
                      <span className="font-bold text-slate-800">HbA1c</span>
                      <span className="text-[10px] font-mono text-slate-500 block">6.2% (Prediabetic)</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Metabolic Metric</span>
                      <span className="font-bold text-slate-800">Body Mass Index</span>
                      <span className="text-[10px] font-mono text-slate-500 block">27.8 kg/m²</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Hemodynamic</span>
                      <span className="font-bold text-slate-800">Blood Pressure</span>
                      <span className="text-[10px] font-mono text-slate-500 block">138 / 88 mmHg</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Lipid Panel</span>
                      <span className="font-bold text-slate-800">Triglycerides</span>
                      <span className="text-[10px] font-mono text-slate-500 block">184 mg/dL</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Renal Marker</span>
                      <span className="font-bold text-slate-800">Serum Creatinine</span>
                      <span className="text-[10px] font-mono text-slate-500 block">0.94 mg/dL</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Continuous vector normalized via standard scaling [0, 1]</span>
                  <span className="font-mono">Features: 12 Clinical Dimensions</span>
                </div>
              </div>
            ) : (
              /* Waveform preview */
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 p-4 relative">
                  <div className="h-32 flex items-center justify-center">
                    <svg viewBox="0 0 400 100" className="w-full h-full stroke-[#bc000a] fill-none" strokeWidth="2">
                      <path d="M 0,50 L 80,50 L 95,45 L 110,50 L 130,50 L 140,20 L 155,90 L 170,10 L 185,55 L 195,50 L 230,50 L 250,35 L 270,50 L 400,50" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                    <span>187 Discrete Samples</span>
                    <span>Sample Rate: 125 Hz</span>
                    <span className="text-emerald-400">Lead II Calibrated</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COMMON RESULT HIERARCHY ACCORDION */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">schema</span>
              Common Result Hierarchy Workflow
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-mono text-slate-400 block font-bold">STEP 1</span>
                <span className="font-bold text-slate-800 block">Input & Prep</span>
                <span className="text-[10px] text-slate-500">Quality check & baseline removal</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-mono text-slate-400 block font-bold">STEP 2</span>
                <span className="font-bold text-slate-800 block">AI Analysis</span>
                <span className="text-[10px] text-slate-500">Hybrid VQC & Bottleneck encoding</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-mono text-slate-400 block font-bold">STEP 3</span>
                <span className="font-bold text-slate-800 block">Prediction & Risk</span>
                <span className="text-[10px] text-slate-500">Decision-support output & confidence</span>
              </div>
              <div className="bg-[#ffe8e8] p-2.5 rounded-xl border border-[#bc000a]/20">
                <span className="text-[9px] font-mono text-[#bc000a] block font-bold">STEP 4</span>
                <span className="font-bold text-[#bc000a] block">Next Step</span>
                <span className="text-[10px] text-[#bc000a]/80">Clinical action & physician review</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols on lg): Model Prediction, Confidence, Explanation, Technical Details */}
        <div className="lg:col-span-5 space-y-5">
          {/* SECTION 3: Model Prediction & Decision-Support Output */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#bc000a]">psychology</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Model Prediction
                </h3>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Decision-Support
              </span>
            </div>

            {/* Status card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                {activeTest.modalityType === 'image'
                  ? 'Radiological Finding'
                  : activeTest.modalityType === 'tabular'
                  ? 'Risk Stratification'
                  : 'Arrhythmia Classification'}
              </span>
              <div className="text-lg font-bold text-[#101c28]">
                {activeTest.modalityType === 'image'
                  ? 'Standard Framework Demonstration'
                  : activeTest.modalityType === 'tabular'
                  ? 'Moderate Metabolic Risk Tier'
                  : 'Normal Sinus Rhythm (N)'}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeTest.description}
              </p>
            </div>

            {/* Confidence / Risk Indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">Model Confidence / Certainty</span>
                <span className="font-mono font-bold text-slate-800">
                  {isEcg ? '98.4%' : '94.8% (Target Baseline)'}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-[#bc000a] h-full rounded-full" style={{ width: '94.8%' }} />
              </div>
              <span className="text-[10px] text-slate-400 block text-right">
                Calibrated against validated test sets
              </span>
            </div>

            {/* SECTION 4: Explanation & Highlighted Region */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">insights</span>
                Explainability & Clinical Rationale
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                {activeTest.modalityType === 'image'
                  ? 'Saliency attribution highlights radiographic density along the lower right lobe parenchymal boundary.'
                  : activeTest.modalityType === 'tabular'
                  ? 'Primary driving risk factors include fasting blood glucose (112 mg/dL) and elevated BMI (27.8 kg/m²).'
                  : 'Morphological focus on QRS interval width (88 ms) and stable ST segment conduction without elevation.'}
              </p>
            </div>

            {/* SECTION 5: Treatment & Care Recommendations */}
            <div className="pt-2 border-t border-slate-100">
              <TreatmentRecommendationCard
                clinicalInput={{
                  modality: activeTest.id === 'ecg-arrhythmia' ? 'ecg' : activeTest.modalityType === 'image' ? 'imaging' : 'chronic',
                  testId: activeTest.id,
                  findingTitle: activeTest.id === 'ecg-arrhythmia' ? 'Normal Sinus Rhythm' : `${activeTest.name} Result`,
                  resultCode: activeTest.id === 'ecg-arrhythmia' ? 'N' : undefined,
                  confidence: activeTest.badge || '96.4%',
                  patientContext: {
                    patientName: 'Ashton Miller',
                    age: 48,
                    gender: 'Male',
                    previousResult: 'Normal Baseline',
                  },
                }}
                onOpenAssistant={onOpenAssistant}
                onBookAppointment={onBookAppointment}
                sourceContextTitle={activeTest.name}
              />
            </div>
          </div>

          {/* SECTION 6: Model Information & Technical Details */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a]">memory</span>
                Quantum–Classical Architecture
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Dr. Radar Core</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Pipeline Type:</span>
                <span className="font-mono font-semibold text-slate-800">Hybrid Quantum–Classical VQC</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Qubit Allocation:</span>
                <span className="font-mono font-semibold text-slate-800">10-Qubit Strongly Entangling</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Encoding Scheme:</span>
                <span className="font-mono font-semibold text-slate-800">R_y Angle Encoding</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Pipeline Flow:</span>
                <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={activeTest.pipelineDescription}>
                  {activeTest.pipelineDescription}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
