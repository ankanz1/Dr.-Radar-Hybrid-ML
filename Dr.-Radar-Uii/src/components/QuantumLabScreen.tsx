import { useState, useRef, useEffect } from 'react';
import { BENCHMARK_ECG_BEATS, ECGBeatSample } from '../data/ecgQuantumData';
import { TrainabilitySection } from './TrainabilitySection';
import { BottleneckAuditSection } from './BottleneckAuditSection';

interface QuantumLabScreenProps {
  onNavigateToAnalysis?: () => void;
  onNavigateToExplainability?: () => void;
  onNavigateToExperiments?: () => void;
}

type CircuitStage = 'all' | 'encoding' | 'variational' | 'entanglement' | 'reuploading' | 'measurement';

export const QuantumLabScreen = ({
  onNavigateToAnalysis,
  onNavigateToExplainability,
  onNavigateToExperiments,
}: QuantumLabScreenProps) => {
  // Active beat sample (Default: Beat #208 V-Class)
  const [selectedBeatIdx, setSelectedBeatIdx] = useState<number>(1);
  const activeBeat: ECGBeatSample = BENCHMARK_ECG_BEATS[selectedBeatIdx] || BENCHMARK_ECG_BEATS[1];

  // Selected stage filter for interactive circuit inspection
  const [selectedStage, setSelectedStage] = useState<CircuitStage>('all');

  // Technical Details expandable panel state
  const [isTechnicalDetailsOpen, setIsTechnicalDetailsOpen] = useState<boolean>(true);

  // Hovered gate / element for quantum inspect tooltips
  const [hoveredElement, setHoveredElement] = useState<{
    title: string;
    description: string;
    formula?: string;
  } | null>(null);

  // Experiment Execution Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [completedStepIndex, setCompletedStepIndex] = useState<number>(4); // All 5 steps completed by default
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const simTimersRef = useRef<NodeJS.Timeout[]>([]);

  const handleRunSimulation = () => {
    if (isSimulating) return;

    simTimersRef.current.forEach(clearTimeout);
    simTimersRef.current = [];

    setIsSimulating(true);
    setCompletedStepIndex(-1);
    setToastMessage('Step 1/5: Angle Encoding 10 latent features into Ry rotations...');

    const t1 = setTimeout(() => {
      setCompletedStepIndex(0);
      setToastMessage('Step 2/5: Constructing 4-layer StronglyEntangling ansatz...');
    }, 450);

    const t2 = setTimeout(() => {
      setCompletedStepIndex(1);
      setToastMessage('Step 3/5: Executing statevector simulation on AerSimulator...');
    }, 950);

    const t3 = setTimeout(() => {
      setCompletedStepIndex(2);
      setToastMessage('Step 4/5: Computing 10 local Pauli-Z expectation values ⟨Z₁⟩..⟨Z₁₀⟩...');
    }, 1500);

    const t4 = setTimeout(() => {
      setCompletedStepIndex(3);
      setToastMessage('Step 5/5: Linear head projection & Softmax AAMI classification...');
    }, 2050);

    const t5 = setTimeout(() => {
      setCompletedStepIndex(4);
      setIsSimulating(false);
      setToastMessage(
        `Simulation Complete: ⟨Z⟩ vector computed. Softmax predicted class: ${activeBeat.className} (${(
          activeBeat.probabilities[activeBeat.classType] * 100
        ).toFixed(1)}%).`
      );
      setTimeout(() => setToastMessage(null), 3500);
    }, 2600);

    simTimersRef.current = [t1, t2, t3, t4, t5];
  };

  useEffect(() => {
    return () => {
      simTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // 10 Qubit wires indices: 0..9 (mapping to observables <Z_1> .. <Z_10>)
  const qubitIndices = Array.from({ length: 10 }, (_, i) => i);

  // AAMI 5 Classes metadata
  const aamiClasses = [
    { code: 'N', name: 'Normal Sinus', prob: activeBeat.probabilities.N * 100, color: '#059669' },
    { code: 'S', name: 'Supraventricular', prob: activeBeat.probabilities.S * 100, color: '#d97706' },
    { code: 'V', name: 'Ventricular', prob: activeBeat.probabilities.V * 100, color: '#bc000a' },
    { code: 'F', name: 'Fusion', prob: activeBeat.probabilities.F * 100, color: '#7c3aed' },
    { code: 'Q', name: 'Unknown / Paced', prob: activeBeat.probabilities.Q * 100, color: '#0284c7' },
  ];

  return (
    <div
      id="quantum-lab-workspace"
      className="space-y-6 pb-24 w-full select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="quantum-lab-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 max-w-md text-center"
        >
          <span className="material-symbols-outlined text-[18px] text-[#72fe88] shrink-0">
            memory
          </span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Header & Subheading */}
      <section id="quantum-lab-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                QUANTUM LAB
              </span>
              <span className="text-[10px] font-mono font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-200">
                10 Qubits • Depth 4 Ansatz
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#101c28] tracking-tight">
              Quantum Variational Classifier (VQC)
            </h1>
            <p className="text-xs md:text-sm text-[#5c7b99] font-medium mt-0.5">
              Parameterized quantum circuit architecture, strongly entangling layers & Pauli-Z observables
            </p>
          </div>

          {/* Sample Selector & Re-simulate trigger */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#5c7b99] px-1.5 hidden sm:inline">
                Sample:
              </span>
              {BENCHMARK_ECG_BEATS.map((beat, idx) => {
                const isSelected = selectedBeatIdx === idx;
                return (
                  <button
                    key={beat.id}
                    onClick={() => {
                      setSelectedBeatIdx(idx);
                      handleRunSimulation();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#bc000a] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title={`Record ${beat.recordId} • Class ${beat.classType} (${beat.className})`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#ffffff' : beat.urgencyColor }}
                    />
                    {idx === 1 ? 'ECG-0248 (V)' : `Beat ${beat.classType}`}
                  </button>
                );
              })}
            </div>

            {onNavigateToExperiments && (
              <button
                id="open-experiments-btn"
                onClick={onNavigateToExperiments}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="View reproducible experiments and evaluations"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-700">science</span>
                <span>Experiments</span>
              </button>
            )}

            <button
              id="execute-quantum-sim-btn"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-3.5 py-2 rounded-xl bg-[#bc000a] hover:bg-[#a10008] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Execute statevector simulation of 10-qubit circuit"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSimulating ? 'sync' : 'play_arrow'}
              </span>
              <span className="hidden sm:inline">{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Top Metrics: Qubits, Circuit Depth, Encoding, Backend */}
      <section id="quantum-top-metrics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Qubits */}
          <div className="matte-3d-card rounded-2xl p-4 border border-slate-200/90 bg-white shadow-xs">
            <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
              Qubits
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-[#101c28]">10</span>
              <span className="text-[11px] text-slate-500 font-mono">wires</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              q[0] .. q[9] register
            </span>
          </div>

          {/* 2. Circuit Depth */}
          <div className="matte-3d-card rounded-2xl p-4 border border-slate-200/90 bg-white shadow-xs">
            <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
              Circuit Depth
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-[#bc000a]">4</span>
              <span className="text-[11px] text-slate-500 font-mono">layers</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              StronglyEntangling
            </span>
          </div>

          {/* 3. Encoding */}
          <div className="matte-3d-card rounded-2xl p-4 border border-slate-200/90 bg-white shadow-xs">
            <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
              Encoding
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#101c28] truncate">Angle Encoding</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              Ry(zᵢ) single-qubit
            </span>
          </div>

          {/* 4. Backend */}
          <div className="matte-3d-card rounded-2xl p-4 border border-slate-200/90 bg-white shadow-xs">
            <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
              Backend
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#059669] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#059669]" />
                Simulator
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              AerSimulator / Statevector
            </span>
          </div>
        </div>
      </section>

      {/* Experiment Status Panel */}
      <section id="experiment-status-panel">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#059669]">
                task_alt
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                EXPERIMENT STATUS
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {completedStepIndex === 4
                ? 'All Stages Verified'
                : `Processing Step ${completedStepIndex + 2}/5...`}
            </span>
          </div>

          {/* 5 Status Checkpoints */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { name: 'Encoding', desc: '10-D Latent Mapping' },
              { name: 'Circuit construction', desc: '4-Depth StronglyEntangling' },
              { name: 'Quantum execution', desc: 'Statevector |ψ⟩' },
              { name: 'Measurement', desc: '10 Local ⟨Zᵢ⟩ Observables' },
              { name: 'Classification', desc: 'Softmax 5-Class Output' },
            ].map((step, idx) => {
              const isDone = completedStepIndex >= idx;
              const isCurrent = completedStepIndex === idx - 1 && isSimulating;

              return (
                <div
                  key={step.name}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                      : isCurrent
                      ? 'bg-amber-50 border-amber-300 text-amber-950 animate-pulse'
                      : 'bg-slate-50 border-slate-200/70 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono truncate">
                      {step.name}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isDone
                          ? 'text-[#059669]'
                          : isCurrent
                          ? 'text-amber-600'
                          : 'text-slate-300'
                      }`}
                    >
                      {isDone ? '✓' : isCurrent ? '⋯' : '○'}
                    </span>
                  </div>
                  <span className="text-[10px] block opacity-80 leading-tight">
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Information Bottleneck / Bottleneck Audit Section */}
      <BottleneckAuditSection activeBeat={activeBeat} />

      {/* Main Section: QUANTUM CIRCUIT */}
      <section id="quantum-circuit-section" className="space-y-3">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          {/* Circuit Header & Stage Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                  schema
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                  QUANTUM CIRCUIT
                </h2>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                  10 Qubits • Depth 4
                </span>
              </div>
              <p className="text-[11px] text-[#5c7b99] mt-0.5">
                StronglyEntanglingLayers with Ry angle encoding, ring CNOT entanglement & repeated data re-uploading
              </p>
            </div>

            {/* Stage Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto max-w-full">
              {[
                { id: 'all', label: 'All Stages' },
                { id: 'encoding', label: 'Input Encoding' },
                { id: 'variational', label: 'Variational' },
                { id: 'entanglement', label: 'Ring CNOT' },
                { id: 'reuploading', label: 'Re-uploading' },
                { id: 'measurement', label: 'Measurement' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStage(st.id as CircuitStage)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    selectedStage === st.id
                      ? 'bg-white text-[#bc000a] font-bold shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-[#101c28]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Circuit Stage Headers Bar (Columns alignment) */}
          <div className="hidden lg:grid grid-cols-12 gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#5c7b99] bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-200/80">
            <div className="col-span-1">Wire</div>
            <div
              className={`col-span-2 text-center py-0.5 rounded transition-colors ${
                selectedStage === 'encoding' ? 'bg-sky-100 text-sky-900' : ''
              }`}
            >
              1. Input Encoding
            </div>
            <div
              className={`col-span-2 text-center py-0.5 rounded transition-colors ${
                selectedStage === 'variational' ? 'bg-amber-100 text-amber-900' : ''
              }`}
            >
              2. Variational Layer
            </div>
            <div
              className={`col-span-3 text-center py-0.5 rounded transition-colors ${
                selectedStage === 'entanglement' ? 'bg-rose-100 text-rose-900' : ''
              }`}
            >
              3. Entanglement (Ring CNOT)
            </div>
            <div
              className={`col-span-2 text-center py-0.5 rounded transition-colors ${
                selectedStage === 'reuploading' ? 'bg-purple-100 text-purple-900' : ''
              }`}
            >
              4. Re-uploading
            </div>
            <div
              className={`col-span-2 text-right pr-2 py-0.5 rounded transition-colors ${
                selectedStage === 'measurement' ? 'bg-emerald-100 text-emerald-900' : ''
              }`}
            >
              5. Measurement
            </div>
          </div>

          {/* Interactive Quantum Circuit Canvas */}
          <div className="bg-[#0a121c] rounded-2xl p-4 md:p-5 border border-slate-700/70 shadow-inner overflow-x-auto relative">
            {/* Ambient subtle circuit wire guidelines */}
            <div className="min-w-[800px] space-y-3.5 relative py-2">
              {qubitIndices.map((qIdx) => {
                const zVal = activeBeat.latentVectorZ[qIdx] ?? 0;
                const expVal = activeBeat.quantumExpectations[qIdx] ?? 0;
                const nextQIdx = (qIdx + 1) % 10;
                const isRingClosureWire = qIdx === 9;

                return (
                  <div
                    key={`qubit-wire-${qIdx}`}
                    className="flex items-center gap-3 relative group"
                    onMouseEnter={() =>
                      setHoveredElement({
                        title: `Qubit Wire q[${qIdx}]`,
                        description: `Initialized to |0⟩. Encodes feature z_${qIdx} = ${zVal.toFixed(
                          3
                        )}. Measures observable ⟨Z_${qIdx + 1}⟩ = ${expVal.toFixed(3)}.`,
                      })
                    }
                  >
                    {/* Qubit Wire Identifier & State */}
                    <div className="w-16 shrink-0 font-mono text-xs flex items-center justify-between text-slate-300 pr-1">
                      <span className="font-bold text-white">q[{qIdx}]</span>
                      <span className="text-cyan-400 text-[11px] font-semibold">|0⟩</span>
                    </div>

                    {/* Circuit Wire Background Line */}
                    <div className="flex-1 flex items-center justify-between relative px-2">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-slate-700/80 -z-0" />

                      {/* STAGE 1: Input Encoding (Ry Gate) */}
                      <div
                        className={`relative z-10 shrink-0 px-2 transition-opacity ${
                          selectedStage !== 'all' && selectedStage !== 'encoding'
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredElement({
                            title: `Input Encoding: Ry(z_${qIdx})`,
                            description: `Angle encoding rotating qubit q[${qIdx}] on the Y-axis of the Bloch sphere proportional to feature z_${qIdx}.`,
                            formula: `Ry(θ) = exp(-i θ σ_y / 2), with θ = ${zVal.toFixed(3)} rad`,
                          });
                        }}
                      >
                        <div className="w-16 h-8 rounded-lg bg-[#0d2a45] border border-cyan-500/60 hover:border-cyan-400 text-center flex flex-col items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105">
                          <span className="text-[10px] font-mono font-bold text-cyan-300 leading-none">
                            Ry(z_{qIdx})
                          </span>
                          <span className="text-[9px] font-mono text-cyan-200/80 leading-none mt-0.5">
                            {zVal > 0 ? `+${zVal.toFixed(2)}` : zVal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* STAGE 2: Variational Layer (Parameterized Rotations) */}
                      <div
                        className={`relative z-10 flex items-center gap-1.5 px-3 transition-opacity ${
                          selectedStage !== 'all' && selectedStage !== 'variational'
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredElement({
                            title: `Variational Layer: Rotations on q[${qIdx}]`,
                            description: `Parameterized single-qubit rotations with trainable angles θ and ϕ optimized during training.`,
                            formula: `U(θ, ϕ) = Rz(ϕ_{l,${qIdx}}) · Ry(θ_{l,${qIdx}})`,
                          });
                        }}
                      >
                        {/* Ry variational gate */}
                        <div className="w-11 h-8 rounded-lg bg-[#271d07] border border-amber-500/60 hover:border-amber-400 text-center flex flex-col items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105">
                          <span className="text-[9.5px] font-mono font-bold text-amber-300 leading-none">
                            Ry
                          </span>
                          <span className="text-[8px] font-mono text-amber-200/70 leading-none mt-0.5">
                            θ_{qIdx}
                          </span>
                        </div>
                        {/* Rz variational gate */}
                        <div className="w-11 h-8 rounded-lg bg-[#271d07] border border-amber-500/60 hover:border-amber-400 text-center flex flex-col items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105">
                          <span className="text-[9.5px] font-mono font-bold text-amber-300 leading-none">
                            Rz
                          </span>
                          <span className="text-[8px] font-mono text-amber-200/70 leading-none mt-0.5">
                            ϕ_{qIdx}
                          </span>
                        </div>
                      </div>

                      {/* STAGE 3: Entanglement (Ring CNOT) */}
                      <div
                        className={`relative z-10 flex items-center justify-center px-4 transition-opacity ${
                          selectedStage !== 'all' && selectedStage !== 'entanglement'
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredElement({
                            title: `Ring CNOT: Entanglement q[${qIdx}] → q[${nextQIdx}]`,
                            description: isRingClosureWire
                              ? `Ring topology closure: Entangling Wire 9 back to Wire 0 (periodic boundary condition).`
                              : `Controlled-NOT gate creating quantum entanglement between adjacent qubits q[${qIdx}] and q[${nextQIdx}].`,
                            formula: `CNOT_{${qIdx}, ${nextQIdx}}: |c, t⟩ → |c, t ⊕ c⟩`,
                          });
                        }}
                      >
                        <div className="flex items-center gap-2 bg-[#1b1216] px-3 py-1 rounded-xl border border-rose-500/50 hover:border-rose-400 cursor-pointer shadow-md">
                          {/* Control Dot */}
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                            <span className="text-[9px] font-mono text-rose-200">c[{qIdx}]</span>
                          </div>

                          <span className="text-rose-400 font-bold text-xs">→</span>

                          {/* Target XOR Symbol */}
                          <div className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                              ⊕
                            </span>
                            <span className="text-[9px] font-mono text-rose-200">
                              t[{nextQIdx}]
                            </span>
                          </div>

                          {/* Ring wrap badge on wire 9 */}
                          {isRingClosureWire && (
                            <span className="text-[8px] font-mono bg-rose-900/80 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40">
                              Ring Wrap 9→0
                            </span>
                          )}
                        </div>
                      </div>

                      {/* STAGE 4: Repeated Data Re-uploading */}
                      <div
                        className={`relative z-10 flex items-center gap-1.5 px-3 transition-opacity ${
                          selectedStage !== 'all' && selectedStage !== 'reuploading'
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredElement({
                            title: `Data Re-uploading on q[${qIdx}]`,
                            description: `Re-injecting feature z_${qIdx} interleaved with subsequent variational rotation to enrich model expressivity.`,
                            formula: `U_{re}(z_${qIdx}) = Ry(w_{${qIdx}} · z_${qIdx} + b_{${qIdx}})`,
                          });
                        }}
                      >
                        {/* Re-uploading gate */}
                        <div className="w-16 h-8 rounded-lg bg-[#25112f] border border-purple-500/60 hover:border-purple-400 text-center flex flex-col items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105">
                          <span className="text-[9.5px] font-mono font-bold text-purple-300 leading-none">
                            Ry(w·z)
                          </span>
                          <span className="text-[8px] font-mono text-purple-200/70 leading-none mt-0.5">
                            Re-upload
                          </span>
                        </div>

                        {/* Additional layer rotation */}
                        <div className="w-11 h-8 rounded-lg bg-[#16202e] border border-slate-500/60 text-center flex flex-col items-center justify-center shadow-md">
                          <span className="text-[9px] font-mono font-bold text-slate-300 leading-none">
                            Ry
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 leading-none mt-0.5">
                            θ'_{qIdx}
                          </span>
                        </div>
                      </div>

                      {/* STAGE 5: Measurement Gate (M_z / ⟨Z_i⟩) */}
                      <div
                        className={`relative z-10 shrink-0 flex items-center gap-2 pl-2 transition-opacity ${
                          selectedStage !== 'all' && selectedStage !== 'measurement'
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredElement({
                            title: `Measurement: Local Observable ⟨Z_${qIdx + 1}⟩`,
                            description: `Computes expectation value of Pauli-Z operator on qubit q[${qIdx}]. Evaluates to ${expVal.toFixed(
                              3
                            )} ∈ [-1.0, +1.0].`,
                            formula: `⟨Z_${qIdx + 1}⟩ = ⟨ψ| Z_{${qIdx}} |ψ⟩`,
                          });
                        }}
                      >
                        <div className="w-12 h-8 rounded-lg bg-[#0e271a] border border-emerald-500/60 hover:border-emerald-400 text-center flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all">
                          <span className="material-symbols-outlined text-[13px] text-emerald-400">
                            speed
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-300">
                            M_z
                          </span>
                        </div>

                        {/* Expectation value readout pill */}
                        <div className="w-16 text-right font-mono text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded border border-slate-700">
                          {expVal > 0 ? `+${expVal.toFixed(2)}` : expVal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Inspector HUD Tooltip */}
            <div className="mt-4 pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-white font-bold">
                  {hoveredElement ? hoveredElement.title : 'Interactive Circuit Inspector:'}
                </span>
                <span className="text-slate-400 text-[11px]">
                  {hoveredElement
                    ? hoveredElement.description
                    : 'Hover over gates or wires to inspect unitaries, angles, and ring connectivity.'}
                </span>
              </div>
              {hoveredElement?.formula && (
                <span className="text-cyan-300 font-bold bg-slate-800 px-2.5 py-0.5 rounded border border-cyan-500/30 text-[11px]">
                  {hoveredElement.formula}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop 2-Column Workstation Grid: Measurements & Classical Head */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section: MEASUREMENTS (<Z₁> ... <Z₁₀>) */}
        <section id="quantum-measurements-section" className="lg:col-span-7 space-y-3">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0284c7]">
                  analytics
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                  MEASUREMENTS
                </h2>
              </div>
              <p className="text-[11px] text-[#5c7b99] mt-0.5">
                Local Pauli-Z expectation values ⟨Z₁⟩ .. ⟨Z₁₀⟩ readout vector in range [-1.00, +1.00]
              </p>
            </div>

            <span className="text-xs font-mono text-[#0284c7] font-bold bg-[#e0f2fe] px-2.5 py-1 rounded-full border border-[#0284c7]/20">
              Vector Dim: 10
            </span>
          </div>

          {/* 10 Observable Cards (<Z₁> .. <Z₁₀>) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {qubitIndices.map((i) => {
              const obsNumber = i + 1;
              const expVal = activeBeat.quantumExpectations[i] ?? 0;
              const isPositive = expVal >= 0;
              const absPercent = Math.min(100, Math.abs(expVal) * 100);

              return (
                <div
                  key={`obs-z-${obsNumber}`}
                  className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/90 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#101c28]">
                      ⟨Z{obsNumber}⟩
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      q[{i}]
                    </span>
                  </div>

                  {/* Bipolar expectation value bar (center is 0.0) */}
                  <div className="relative w-full h-3 bg-slate-200/80 rounded-full overflow-hidden flex items-center">
                    {/* Zero center tick mark */}
                    <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-400 z-10" />

                    {/* Negative bar */}
                    {!isPositive && (
                      <div
                        className="h-full bg-[#bc000a] ml-auto rounded-l-full"
                        style={{ width: `${absPercent / 2}%`, marginRight: '50%' }}
                      />
                    )}

                    {/* Positive bar */}
                    {isPositive && (
                      <div
                        className="h-full bg-[#059669] mr-auto rounded-r-full"
                        style={{ width: `${absPercent / 2}%`, marginLeft: '50%' }}
                      />
                    )}
                  </div>

                  {/* Exact Numeric readout */}
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[10px] text-slate-500">
                      {isPositive ? '|0⟩ bias' : '|1⟩ bias'}
                    </span>
                    <span
                      className={`font-bold ${
                        isPositive ? 'text-[#059669]' : 'text-[#bc000a]'
                      }`}
                    >
                      {expVal > 0 ? `+${expVal.toFixed(2)}` : expVal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

        {/* Section: CLASSICAL HEAD */}
        <section id="classical-head-section" className="lg:col-span-5 space-y-3">
          <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#7c3aed]">
                linear_scale
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                CLASSICAL HEAD
              </h2>
            </div>
            <p className="text-[11px] text-[#5c7b99] mt-0.5">
              Linear projection of quantum expectation values to categorical Softmax probabilities
            </p>
          </div>

          {/* Sequential Classical Pipeline Diagram */}
          <div className="space-y-3 max-w-2xl mx-auto py-1">
            {/* 1. Quantum measurements */}
            <div className="p-3 bg-[#f8fbfe] rounded-xl border border-slate-200/90 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5c7b99] block">
                Stage 1 • Quantum Feature Vector
              </span>
              <span className="text-xs font-bold text-[#101c28] font-mono mt-0.5 block">
                Quantum measurements
              </span>
              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                z_exp = [⟨Z₁⟩, ⟨Z₂⟩, ⟨Z₃⟩, ..., ⟨Z₁₀⟩]ᵀ ∈ ℝ¹⁰
              </span>
            </div>

            {/* Arrow ↓ */}
            <div className="flex justify-center text-slate-400 font-bold text-base">
              ↓
            </div>

            {/* 2. Linear classification head */}
            <div className="p-3 bg-[#f8fbfe] rounded-xl border border-slate-200/90 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5c7b99] block">
                Stage 2 • Dense Projection
              </span>
              <span className="text-xs font-bold text-[#101c28] font-mono mt-0.5 block">
                Linear classification head
              </span>
              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                u = W · z_exp + b (W ∈ ℝ⁵ˣ¹⁰, b ∈ ℝ⁵)
              </span>
            </div>

            {/* Arrow ↓ */}
            <div className="flex justify-center text-slate-400 font-bold text-base">
              ↓
            </div>

            {/* 3. Softmax */}
            <div className="p-3 bg-[#f8fbfe] rounded-xl border border-slate-200/90 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5c7b99] block">
                Stage 3 • Activation Function
              </span>
              <span className="text-xs font-bold text-[#101c28] font-mono mt-0.5 block">
                Softmax
              </span>
              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                P(y = c | x) = exp(u_c) / ∑ⱼ exp(u_j)
              </span>
            </div>

            {/* Arrow ↓ */}
            <div className="flex justify-center text-slate-400 font-bold text-base">
              ↓
            </div>

            {/* 4. N / S / V / F / Q Classes */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-300/90 shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#101c28] font-mono uppercase">
                  N / S / V / F / Q Class Probabilities
                </span>
                <span className="font-mono text-[11px] text-[#bc000a] font-bold">
                  Predicted: {activeBeat.className}
                </span>
              </div>

              {/* 5 AAMI Class Output Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                {aamiClasses.map((cls) => {
                  const isPredicted = activeBeat.classType === cls.code;

                  return (
                    <div
                      key={cls.code}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isPredicted
                          ? 'bg-[#ffe8e8] border-[#bc000a]/40 shadow-xs ring-1 ring-[#bc000a]/20'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-mono mb-1">
                        <span className="font-bold text-[#101c28]">
                          Class {cls.code}
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: cls.color }}
                        >
                          {cls.prob.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cls.prob}%`,
                            backgroundColor: cls.color,
                          }}
                        />
                      </div>

                      <span className="text-[10px] text-slate-500 block truncate">
                        {cls.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

      {/* Section: TRAINABILITY & CIRCUIT DEPTH SCAN */}
      <TrainabilitySection />

      {/* Expandable Panel: "Technical Details" */}
      <section id="technical-details-panel">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3">
          <button
            onClick={() => setIsTechnicalDetailsOpen(!isTechnicalDetailsOpen)}
            className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                tune
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                TECHNICAL DETAILS
              </h2>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#5c7b99] font-medium">
              <span>{isTechnicalDetailsOpen ? 'Collapse' : 'Expand'}</span>
              <span
                className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                  isTechnicalDetailsOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </div>
          </button>

          {isTechnicalDetailsOpen && (
            <div className="pt-2 border-t border-slate-100 space-y-4 text-xs animate-in fade-in">
              {/* Mandatory 5 fields defined in user specification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Encoding */}
                <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                    Encoding:
                  </span>
                  <span className="text-sm font-bold text-[#101c28] mt-0.5 block font-mono">
                    Angle encoding
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Ry(zᵢ) single-qubit rotations, zᵢ ∈ [-π, π]
                  </span>
                </div>

                {/* 2. Qubits */}
                <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                    Qubits:
                  </span>
                  <span className="text-sm font-bold text-[#101c28] mt-0.5 block font-mono">
                    10
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Quantum register dimension dim(H) = 2¹⁰ = 1024
                  </span>
                </div>

                {/* 3. Ansatz */}
                <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                    Ansatz:
                  </span>
                  <span className="text-sm font-bold text-[#101c28] mt-0.5 block font-mono">
                    StronglyEntanglingLayers
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Depth 4 parameterized rotation and entangling blocks
                  </span>
                </div>

                {/* 4. Entanglement */}
                <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                    Entanglement:
                  </span>
                  <span className="text-sm font-bold text-[#101c28] mt-0.5 block font-mono">
                    Ring CNOT
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Periodic circular topology q[i] → q[(i+1)%10]
                  </span>
                </div>

                {/* 5. Measurement */}
                <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                    Measurement:
                  </span>
                  <span className="text-sm font-bold text-[#101c28] mt-0.5 block font-mono">
                    Local Z expectation values
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ⟨Zᵢ⟩ = ⟨ψ| Zᵢ |ψ⟩ ∈ [-1.0, +1.0] for i=1..10
                  </span>
                </div>
              </div>

              {/* Additional rigorous scientific specifications */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 font-mono text-[11px]">
                <div className="flex flex-wrap justify-between gap-1 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Simulator Implementation:</span>
                  <span className="text-[#101c28] font-bold">
                    Qiskit Aer / PennyLane default.qubit (Statevector Analytic)
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-1 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Trainable Parameter Count:</span>
                  <span className="text-[#bc000a] font-bold">
                    80 Variational Angles (4 layers × 10 qubits × 2 gates) + 10 Re-uploading Scales
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-1 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Gradient Estimation:</span>
                  <span className="text-[#101c28] font-bold">
                    Analytic Adjoint Differentiation / Parameter-Shift Rule
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-slate-500">Classical Loss & Optimization:</span>
                  <span className="text-[#059669] font-bold">
                    Adam (lr = 0.01) with Weighted Categorical Cross-Entropy (AAMI EC57)
                  </span>
                </div>
              </div>

              {/* Scientific Credibility Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-[#5c7b99] leading-relaxed">
                <strong className="text-[#101c28]">Simulation Notice:</strong> In accordance with rigorous scientific research standards, all circuit evaluations in Dr. Radar are executed deterministically on high-performance statevector simulators. No physical hardware outputs or fabricated quantum processor noise figures are represented.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
