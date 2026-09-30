import type { ScreenTab } from '../types';

/**
 * Static configuration for the Phase 5 / 6 / 7 roadmap UI.
 *
 * IMPORTANT: This is metadata for prototype screens only. No backend
 * prediction endpoints, no database tables, and no clinical claims are
 * associated with these modules. The only currently deployed analysis
 * capability in Dr. Radar is the ECG / QML beat classification pipeline.
 */

export type ModuleStatus = 'available' | 'prototype' | 'coming-soon' | 'research-preview';

export interface RoadmapModule {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: ModuleStatus;
  route: ScreenTab;
  /** True only for the deployed ECG/QML beat classifier. */
  availableNow: boolean;
}

// ---------------------------------------------------------------------------
// Status metadata (label + styling contract used by the shared badge)
// ---------------------------------------------------------------------------

export const MODULE_STATUS_META: Record<
  ModuleStatus,
  { label: string; className: string; dotClassName: string; description: string }
> = {
  available: {
    label: 'Available',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClassName: 'bg-emerald-500',
    description: 'Deployed pipeline with validated outputs',
  },
  prototype: {
    label: 'Prototype',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClassName: 'bg-blue-500',
    description: 'UI implemented — not connected to a live model',
  },
  'coming-soon': {
    label: 'Coming Soon',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClassName: 'bg-amber-500',
    description: 'Planned capability — model integration not started',
  },
  'research-preview': {
    label: 'Research Preview',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClassName: 'bg-violet-500',
    description: 'Research-oriented concept — no clinical use',
  },
};

// ---------------------------------------------------------------------------
// Phase 5 — Multidisease Detection
// ---------------------------------------------------------------------------

export const MULTIDISEASE_MODULES: RoadmapModule[] = [
  {
    id: 'skin-disease',
    name: 'Skin Disease Detection',
    description:
      'Dermatology image upload and condition-category preview. Model integration planned.',
    category: 'Dermatology',
    icon: 'healing',
    status: 'coming-soon',
    route: 'multidisease-skin',
    availableNow: false,
  },
  {
    id: 'medical-imaging',
    name: 'Medical Image Analysis',
    description:
      'Radiology-style image review across X-ray, CT, MRI and ultrasound modalities. Research preview only.',
    category: 'Radiology',
    icon: 'radiology',
    status: 'prototype',
    route: 'multidisease-imaging',
    availableNow: false,
  },
  {
    id: 'cardio-models',
    name: 'Additional Cardiovascular Models',
    description:
      'Risk and heart-failure model concepts beyond the deployed ECG classifier. Coming soon.',
    category: 'Cardiology',
    icon: 'cardiology',
    status: 'coming-soon',
    route: 'multidisease-cardio',
    availableNow: false,
  },
  {
    id: 'laboratory-risk',
    name: 'Laboratory-Based Risk Models',
    description:
      'Structured lab panels (CBC, lipids, glucose) feeding planned risk models. Coming soon.',
    category: 'Laboratory',
    icon: 'labs',
    status: 'coming-soon',
    route: 'multidisease-laboratory',
    availableNow: false,
  },
  {
    id: 'disease-modules',
    name: 'Disease-Specific Prediction Modules',
    description:
      'Reusable prediction module grid across organ systems. Concepts only — no predictions.',
    category: 'Multi-System',
    icon: 'grid_view',
    status: 'prototype',
    route: 'multidisease-modules',
    availableNow: false,
  },
];

// ---------------------------------------------------------------------------
// Phase 6 — Multimodal AI
// ---------------------------------------------------------------------------

export const MULTIMODAL_MODULES: RoadmapModule[] = [
  {
    id: 'history-labs',
    name: 'Clinical History + Laboratory Data',
    description:
      'Combine structured history and lab context into a single analysis view. Prototype interaction.',
    category: 'Data Fusion',
    icon: 'timeline',
    status: 'prototype',
    route: 'multimodal-history-labs',
    availableNow: false,
  },
  {
    id: 'imaging-context',
    name: 'Imaging + Clinical Information',
    description:
      'Pair imaging inputs with clinical context for combined review. Prototype interaction.',
    category: 'Data Fusion',
    icon: 'image_search',
    status: 'prototype',
    route: 'multimodal-imaging-context',
    availableNow: false,
  },
  {
    id: 'risk-profile',
    name: 'Multimodal Patient Risk Profile',
    description:
      'Cross-domain risk layout with honest placeholder states — no invented scores.',
    category: 'Risk Overview',
    icon: 'donut_small',
    status: 'research-preview',
    route: 'multimodal-risk-profile',
    availableNow: false,
  },
  {
    id: 'longitudinal',
    name: 'Longitudinal Health Tracking',
    description:
      'Timeline of health events with future trend placeholders and date filters.',
    category: 'Longitudinal',
    icon: 'monitoring',
    status: 'prototype',
    route: 'multimodal-longitudinal',
    availableNow: false,
  },
];

// ---------------------------------------------------------------------------
// Phase 7 — Clinical Research
// ---------------------------------------------------------------------------

export const RESEARCH_MODULES: RoadmapModule[] = [
  {
    id: 'validation',
    name: 'External Validation',
    description:
      'Independent cohort validation projects. Planned — no dataset connected.',
    category: 'Validation',
    icon: 'fact_check',
    status: 'coming-soon',
    route: 'research-validation',
    availableNow: false,
  },
  {
    id: 'prospective',
    name: 'Prospective Evaluation',
    description:
      'Forward-looking study design with evaluation timeline. Planned.',
    category: 'Validation',
    icon: 'event_note',
    status: 'coming-soon',
    route: 'research-prospective',
    availableNow: false,
  },
  {
    id: 'explainability',
    name: 'Explainability',
    description:
      'Feature-contribution views for supported models; referenced ECG saliency only.',
    category: 'Model Insights',
    icon: 'insights',
    status: 'prototype',
    route: 'research-explainability',
    availableNow: false,
  },
  {
    id: 'calibration',
    name: 'Calibration',
    description:
      'Calibration curves and metrics for planned models. Coming soon.',
    category: 'Model Insights',
    icon: 'straighten',
    status: 'coming-soon',
    route: 'research-calibration',
    availableNow: false,
  },
  {
    id: 'fairness',
    name: 'Bias / Fairness Analysis',
    description:
      'Demographic-group comparison framework. Research-only prototype.',
    category: 'Model Insights',
    icon: 'balance',
    status: 'research-preview',
    route: 'research-fairness',
    availableNow: false,
  },
  {
    id: 'workflow',
    name: 'Clinical Workflow Evaluation',
    description:
      'Clinician-in-the-loop workflow diagram and audit placeholder. Planned.',
    category: 'Workflow',
    icon: 'account_tree',
    status: 'coming-soon',
    route: 'research-workflow',
    availableNow: false,
  },
];

/** All roadmap modules in one list (for overview counts). */
export const ALL_ROADMAP_MODULES: RoadmapModule[] = [
  ...MULTIDISEASE_MODULES,
  ...MULTIMODAL_MODULES,
  ...RESEARCH_MODULES,
];

/** ECG/QML is the only deployed capability — surfaced as such everywhere. */
export const ECG_ACTIVE_MODULE: RoadmapModule = {
  id: 'ecg-arrhythmia',
  name: 'ECG Arrhythmia Classification',
  description:
    'Deployed hybrid quantum–classical beat classifier (5 AAMI classes) with saliency attribution.',
  category: 'Cardiology',
  icon: 'ecg_heart',
  status: 'available',
  route: 'ecg-analysis',
  availableNow: true,
};

export function countModulesByStatus(modules: RoadmapModule[]) {
  return modules.reduce(
    (acc, m) => {
      acc[m.status] += 1;
      return acc;
    },
    { available: 0, prototype: 0, 'coming-soon': 0, 'research-preview': 0 } as Record<ModuleStatus, number>
  );
}
