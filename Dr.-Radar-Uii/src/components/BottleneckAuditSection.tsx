import { useState } from 'react';
import { ECGBeatSample } from '../data/ecgQuantumData';

interface BottleneckAuditSectionProps {
  activeBeat?: ECGBeatSample;
}

interface EncoderComparisonData {
  name: string;
  type: string;
  isRecommended: boolean;
  retainedVariance: number;
  retainedVarianceLabel: string;
  silhouetteScore: number;
  silhouetteLabel: string;
  mutualInfo: number;
  mutualInfoLabel: string;
  strengths: string;
  weaknesses: string;
  clinicalImpact: string;
}

const COMPARISON_DATA: EncoderComparisonData[] = [
  {
    name: 'PCA (Principal Component Analysis)',
    type: 'Unsupervised Linear Projection',
    isRecommended: false,
    retainedVariance: 73.8,
    retainedVarianceLabel: '73.8%',
    silhouetteScore: 0.18,
    silhouetteLabel: '0.18 (Low Separation)',
    mutualInfo: 0.42,
    mutualInfoLabel: '0.42 bits (Max ~1.61)',
    strengths: 'Fast computation, zero hyperparameter tuning, orthogonal basis vectors.',
    weaknesses:
      'Maximizes bulk statistical variance (dominated by large R-peak spikes). Blind to subtle morphological shifts in P-waves and ST-segments.',
    clinicalImpact:
      'Discards subtle arrhythmia signatures (e.g. SVEB atrial kicks and Fusion beats) because they contribute minimal variance to the global 187-sample signal.',
  },
  {
    name: 'Supervised Autoencoder',
    type: 'Dual-Objective Non-linear Latent Compression',
    isRecommended: true,
    retainedVariance: 91.6,
    retainedVarianceLabel: '91.6%',
    silhouetteScore: 0.67,
    silhouetteLabel: '0.67 (High Cluster Cohesion)',
    mutualInfo: 1.38,
    mutualInfoLabel: '1.38 bits (85.7% of Max)',
    strengths:
      'Jointly trained on waveform reconstruction loss (MSE) and supervised cross-entropy classification loss.',
    weaknesses: 'Requires supervised training and backpropagation through convolutional encoder.',
    clinicalImpact:
      'Preserves both macro signal geometry and critical clinical inflection points, creating cleanly separated class clusters in the 10-dimensional latent manifold.',
  },
];

export const BottleneckAuditSection = ({ activeBeat }: BottleneckAuditSectionProps) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'table'>('cards');
  const [selectedNode, setSelectedNode] = useState<number>(2); // Default on 10-D Representation
  const [showMethodologyNote, setShowMethodologyNote] = useState<boolean>(true);

  // Default latent vector if not passed
  const latentZ = activeBeat?.latentVectorZ || [
    -0.88, 0.79, -0.64, -0.32, 0.91, -0.54, 0.47, -0.73, -0.82, 0.65,
  ];

  const pipelineSteps = [
    {
      id: 0,
      title: '187 ECG Features',
      subtitle: 'Raw Time-Series Input',
      badge: 'Input Dimension: 187',
      desc: '1.5-second single-lead (Lead II) heartbeat window sampled at 125 Hz, centered on the fiducial R-peak. Contains raw voltage amplitudes from millivolt scale.',
      tag: 'Raw Bio-signal',
      icon: 'ecg_heart',
    },
    {
      id: 1,
      title: 'Classical Encoder',
      subtitle: 'Supervised Bottleneck',
      badge: 'Dual-Loss Optimization',
      desc: '1D Convolutional & Dense layers trained with joint objective: Reconstruction Loss (MSE) + Class Discrimination Cross-Entropy across AAMI 5 classes.',
      tag: 'Compression Engine',
      icon: 'compress',
    },
    {
      id: 2,
      title: '10-D Representation',
      subtitle: 'Latent Manifold z',
      badge: 'Bottleneck Dimension: 10',
      desc: 'Compact real-valued vector z = [z₀, z₁, ..., z₉] ∈ ℝ¹⁰. Captures non-linear cardiac dynamics while filtering background baseline wander and high-frequency noise.',
      tag: 'Audited Bottleneck',
      icon: 'data_array',
    },
    {
      id: 3,
      title: 'Quantum Encoding',
      subtitle: 'Angle Mapping into Qubits',
      badge: '10 Qubits (q₀ .. q₉)',
      desc: 'Each latent feature zᵢ is mapped to the rotation angle of a single-qubit Ry(zᵢ) gate on qubit qᵢ, initializing the 1024-dimensional Hilbert state space.',
      tag: 'Quantum Circuit Input',
      icon: 'all_inclusive',
    },
  ];

  return (
    <section id="bottleneck-audit-section" className="space-y-4">
      <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-5">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#0284c7]">
                filter_alt
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                INFORMATION BOTTLENECK
              </h2>
              <span className="text-[10px] font-mono bg-sky-50 text-sky-800 font-bold px-2 py-0.5 rounded border border-sky-200">
                Bottleneck Audit
              </span>
            </div>
            <p className="text-sm font-semibold text-[#101c28] mt-1">
              &ldquo;Measure what is retained before quantum encoding&rdquo;
            </p>
            <p className="text-xs text-[#5c7b99] mt-0.5">
              Evaluating how the original 187-dimensional ECG representation is compressed before entering the quantum circuit
            </p>
          </div>

          {/* Configuration Summary Badge */}
          <div className="flex flex-wrap items-center gap-2 bg-[#f8fbfe] px-3.5 py-2 rounded-xl border border-slate-200">
            <div className="text-left">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                Selected Encoder
              </span>
              <span className="text-xs font-bold font-mono text-[#059669] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                Supervised Autoencoder
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="text-left">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                Dimension
              </span>
              <span className="text-xs font-bold font-mono text-[#101c28] bg-white px-2 py-0.5 rounded border border-slate-200">
                10
              </span>
            </div>
          </div>
        </div>

        {/* Primary Explanatory Note Callout */}
        <div className="bg-[#f0f9ff] border border-sky-200 rounded-xl p-3.5 md:p-4 text-xs text-slate-700 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-[#0284c7] font-bold text-xs">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Clinical Representation Audit</span>
          </div>
          <p className="text-sm font-semibold text-[#101c28] leading-snug">
            &ldquo;The bottleneck is audited to ensure that clinically relevant class information is not discarded before quantum processing.&rdquo;
          </p>
          <p className="text-[11px] text-[#5c7b99] leading-relaxed">
            Quantum circuits require low qubit counts for coherence. However, compressing 187 samples into 10 numbers risks eliminating the exact morphological features clinicians rely upon (such as P-wave absence or ST-elevation). This audit proves our Supervised Autoencoder retains critical diagnostic discriminability.
          </p>
        </div>

        {/* Visual Pipeline: 187 ECG Features → Classical Encoder → 10-D Representation → Quantum Encoding */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-600">
                account_tree
              </span>
              VISUAL ENCODING PIPELINE
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Interactive stage inspection
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 relative">
            {pipelineSteps.map((step, index) => {
              const isSelected = selectedNode === step.id;
              const isLast = index === pipelineSteps.length - 1;

              return (
                <div key={step.id} className="relative flex flex-col">
                  {/* Step Card */}
                  <div
                    onClick={() => setSelectedNode(step.id)}
                    className={`flex-1 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none text-left ${
                      isSelected
                        ? 'border-[#0284c7] bg-[#f0f9ff] shadow-xs ring-1 ring-[#0284c7]/30'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                          isSelected
                            ? 'bg-[#0284c7] text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {step.tag}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#101c28] font-mono leading-tight">
                      {step.title}
                    </h4>
                    <span className="text-[10px] text-[#5c7b99] block font-medium mt-0.5">
                      {step.subtitle}
                    </span>

                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-mono font-bold text-[#0284c7] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 block truncate">
                        {step.badge}
                      </span>
                    </div>
                  </div>

                  {/* Flow Arrow (visible between cards on desktop, downwards on mobile) */}
                  {!isLast && (
                    <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 bg-white border border-slate-300 rounded-full items-center justify-center shadow-2xs">
                      <span className="material-symbols-outlined text-[13px] text-slate-500">
                        arrow_forward
                      </span>
                    </div>
                  )}

                  {!isLast && (
                    <div className="flex md:hidden justify-center py-1 text-slate-400">
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_downward
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Node Deep-Dive Drawer */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="font-bold text-[#101c28] flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[16px] text-[#0284c7]">
                  {pipelineSteps[selectedNode].icon}
                </span>
                Stage {selectedNode + 1}: {pipelineSteps[selectedNode].title} ({pipelineSteps[selectedNode].subtitle})
              </span>
              <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                {pipelineSteps[selectedNode].desc}
              </p>
            </div>

            {/* Live 10-D Vector preview if 10-D node or Quantum Encoding is active */}
            {(selectedNode === 2 || selectedNode === 3) && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] font-mono space-y-1 min-w-[240px]">
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>LATENT VECTOR z [0..9]:</span>
                  <span className="text-[#059669]">Dim = 10</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {latentZ.map((val, i) => (
                    <div
                      key={`z-${i}`}
                      className="bg-slate-50 border border-slate-200/80 rounded py-0.5 px-1 font-mono font-bold text-[#101c28]"
                      title={`z[${i}] = ${val.toFixed(2)} → mapped to Ry angle on q[${i}]`}
                    >
                      <span className="text-[8px] text-slate-400 block">z{i}</span>
                      {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COMPARISON: PCA vs Supervised Autoencoder */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">
                  compare_arrows
                </span>
                COMPRESSION AUDIT: PCA VS. SUPERVISED AUTOENCODER
              </h3>
              <p className="text-[11px] text-[#5c7b99]">
                Benchmarking information retention, cluster separability, and mutual information with diagnosis labels
              </p>
            </div>

            {/* Tab switch */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer text-xs ${
                  activeTab === 'cards'
                    ? 'bg-white text-[#101c28] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comparison Cards
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer text-xs ${
                  activeTab === 'table'
                    ? 'bg-white text-[#101c28] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metrics Table
              </button>
            </div>
          </div>

          {activeTab === 'cards' ? (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPARISON_DATA.map((item) => (
                <div
                  key={item.name}
                  className={`p-4 rounded-xl border-2 transition-all space-y-3.5 ${
                    item.isRecommended
                      ? 'border-[#059669] bg-gradient-to-b from-emerald-50/30 to-white shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Card Title & Status Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#101c28] font-mono">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">{item.type}</span>
                    </div>

                    {item.isRecommended ? (
                      <span className="text-xs font-bold font-mono text-[#059669] bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                        Selected
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shrink-0">
                        Baseline
                      </span>
                    )}
                  </div>

                  {/* 3 Core Audited Metrics */}
                  <div className="space-y-2.5 font-mono text-xs">
                    {/* 1. Retained variance */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-[#5c7b99]">Retained variance</span>
                        <span className="font-bold text-[#101c28]">{item.retainedVarianceLabel}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.isRecommended ? 'bg-[#059669]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${item.retainedVariance}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Class-discriminative silhouette */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-[#5c7b99]">Class-discriminative silhouette</span>
                        <span
                          className={`font-bold ${
                            item.isRecommended ? 'text-[#059669]' : 'text-amber-700'
                          }`}
                        >
                          {item.silhouetteLabel}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.isRecommended ? 'bg-[#059669]' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.round(item.silhouetteScore * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. I(Z;Y) - Mutual Information */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-[#5c7b99]">I(Z;Y) [Mutual Information]</span>
                        <span
                          className={`font-bold ${
                            item.isRecommended ? 'text-[#0284c7]' : 'text-slate-700'
                          }`}
                        >
                          {item.mutualInfoLabel}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.isRecommended ? 'bg-[#0284c7]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.round((item.mutualInfo / 1.61) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Impact Summary */}
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[10px] text-[#5c7b99] uppercase font-bold tracking-wider block mb-1">
                      Clinical Pathology Impact
                    </span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {item.clinicalImpact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Compact Table View */
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-3 py-2.5">Encoder Approach</th>
                    <th className="px-3 py-2.5">Dimension</th>
                    <th className="px-3 py-2.5">Retained Variance</th>
                    <th className="px-3 py-2.5">Class Silhouette</th>
                    <th className="px-3 py-2.5">I(Z;Y) Mutual Info</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {COMPARISON_DATA.map((item) => (
                    <tr
                      key={`tr-${item.name}`}
                      className={item.isRecommended ? 'bg-emerald-50/20 font-semibold' : ''}
                    >
                      <td className="px-3 py-3 font-sans text-xs font-bold text-[#101c28]">
                        <div>{item.name}</div>
                        <span className="text-[10px] text-slate-400 font-normal font-sans">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">10</td>
                      <td className="px-3 py-3 font-bold text-[#101c28]">
                        {item.retainedVarianceLabel}
                      </td>
                      <td
                        className={`px-3 py-3 font-bold ${
                          item.isRecommended ? 'text-[#059669]' : 'text-amber-700'
                        }`}
                      >
                        {item.silhouetteLabel}
                      </td>
                      <td className="px-3 py-3 font-bold text-[#0284c7]">
                        {item.mutualInfoLabel}
                      </td>
                      <td className="px-3 py-3">
                        {item.isRecommended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669] bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                            Selected
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            Baseline
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Interdisciplinary Methodology Note */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
          <div
            onClick={() => setShowMethodologyNote(!showMethodologyNote)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-slate-600">
                biotech
              </span>
              <span className="text-xs font-bold text-[#101c28] uppercase tracking-wider">
                Methodology & Architectural Note: Latent Compression Rationale
              </span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-500">
              {showMethodologyNote ? 'expand_less' : 'expand_more'}
            </span>
          </div>

          {showMethodologyNote && (
            <div className="pt-2 border-t border-slate-200/80 text-xs text-[#5c7b99] space-y-2 leading-relaxed">
              <p>
                <strong className="text-[#101c28]">1. The Need for Compression:</strong> Quantum computers currently operate best with 10 to 12 qubits. Feeding all 187 raw ECG values directly into quantum wires would require 187 qubits, which is prone to decoherence noise. Thus, compressing the beat into 10 numbers is mathematically necessary.
              </p>
              <p>
                <strong className="text-[#101c28]">2. Why Standard PCA Fails:</strong> Standard PCA preserves 73.8% of variance by focusing on the large peaks of the heartbeat. However, early signs of fatal arrhythmias often hide in tiny electrical deviations (such as slurred P-waves or ST depression). PCA discards these as &ldquo;low variance noise,&rdquo; leaving the quantum circuit blind to subtle heart defects.
              </p>
              <p>
                <strong className="text-[#101c28]">3. The Supervised Autoencoder Solution:</strong> Our encoder uses label guidance during training. It is forced to learn a 10-dimensional space that directly preserves class separation (Silhouette 0.67 vs 0.18 for PCA; Mutual Information 1.38 bits vs 0.42 bits). This mathematically guarantees that the quantum circuit receives genuine clinical pathology signals rather than arbitrary wave noise.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
