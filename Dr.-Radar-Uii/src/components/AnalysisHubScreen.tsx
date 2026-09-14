import React, { useState } from 'react';
import { CLINICAL_AREAS } from '../data/clinicalAreasData';
import { ClinicalArea, ClinicalAreaId, ClinicalModalityTest } from '../types';
import { DrRadarLogo } from './DrRadarLogo';

interface AnalysisHubScreenProps {
  onSelectEcgAnalysis: () => void;
  onSelectModalityPreview: (testId: string) => void;
}

export const AnalysisHubScreen: React.FC<AnalysisHubScreenProps> = ({
  onSelectEcgAnalysis,
  onSelectModalityPreview,
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<ClinicalAreaId>('cardiology');

  const selectedArea: ClinicalArea =
    CLINICAL_AREAS.find((a) => a.id === selectedAreaId) || CLINICAL_AREAS[0];

  const handleTestClick = (test: ClinicalModalityTest) => {
    if (test.id === 'ecg-arrhythmia') {
      onSelectEcgAnalysis();
    } else {
      onSelectModalityPreview(test.id);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Page Header */}
      <div className="border-b border-slate-200/80 pb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • MULTI-DISEASE INTELLIGENCE
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Phase 1 Active • Standardized Extensible Platform
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Start an Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Choose a clinical area to begin. Dr. Radar unifies multimodal electrophysiological, imaging, and tabular biomarker pipelines under a single hybrid quantum–classical architecture.
          </p>
        </div>
        <DrRadarLogo size={52} animated className="hidden sm:inline-flex shrink-0 drop-shadow-sm mt-1" />
      </div>

      {/* STEP 1: CLINICAL AREA FIRST (5 Clean Medical Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400">category</span>
            1. Select Clinical Area
          </h2>
          <span className="text-[11px] font-mono text-slate-400">5 Clinical Domains</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {CLINICAL_AREAS.map((area) => {
            const isSelected = area.id === selectedAreaId;
            const isActive = area.status === 'active';

            return (
              <button
                key={area.id}
                onClick={() => setSelectedAreaId(area.id)}
                className={`group p-4 rounded-2xl text-left transition-all duration-150 relative cursor-pointer border ${
                  isSelected
                    ? 'bg-white border-[#bc000a] shadow-sm ring-2 ring-[#bc000a]/10'
                    : 'bg-white/80 hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Header of card: Icon + Badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isSelected
                        ? 'bg-[#bc000a] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {area.icon}
                    </span>
                  </div>

                  <span
                    className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {area.badge}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h3
                  className={`text-sm font-extrabold tracking-tight ${
                    isSelected ? 'text-[#bc000a]' : 'text-[#101c28]'
                  }`}
                >
                  {area.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium leading-snug">
                  {area.subtitle}
                </p>

                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {area.description}
                </p>

                {/* Selection indicator pill */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-400 font-mono text-[10px]">
                    {area.tests.length} {area.tests.length === 1 ? 'module' : 'modules'}
                  </span>
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      isSelected ? 'text-[#bc000a]' : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                  >
                    {isSelected ? 'Selected Area' : 'View Tests'}
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: SPECIFIC TEST SECOND */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                2. Select Specific Diagnostic Test
              </span>
              <span className="text-xs font-bold text-[#bc000a]">
                {selectedArea.name}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#101c28]">
              Available & Planned Clinical Protocols
            </h2>
          </div>

          <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            {selectedArea.phase}
          </span>
        </div>

        {/* Tests List */}
        <div className="space-y-3">
          {selectedArea.tests.map((test) => {
            const isTestActive = test.status === 'active';

            return (
              <div
                key={test.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isTestActive
                    ? 'bg-white border-[#bc000a]/30 shadow-xs hover:border-[#bc000a]'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {/* Left: Test Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        isTestActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200/70 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {test.badge}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {test.code}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      • {test.modalityType.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-[#101c28]">
                    {test.name}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    {test.description}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">input</span>
                      Input: {test.sampleInputName}
                    </span>
                  </div>
                </div>

                {/* Right: Launch / Preview Button */}
                <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                  {isTestActive ? (
                    <button
                      onClick={() => handleTestClick(test)}
                      className="px-4 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      Start ECG Analysis
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTestClick(test)}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-slate-400">preview</span>
                      Preview Architecture
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Multi-Disease Architecture Note */}
      <div className="bg-[#f0f7ff] border border-[#cbe2fc] rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <span className="material-symbols-outlined text-blue-600 text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <div className="leading-relaxed">
          <span className="font-bold text-[#101c28]">Dr. Radar Medical Integrity Policy: </span>
          Only validated clinical pipelines produce live patient inferences. ECG Arrhythmia detection is currently active and deployed. Additional disease areas can be previewed as standardized architecture specifications without generating unsupported clinical claims.
        </div>
      </div>
    </div>
  );
};
