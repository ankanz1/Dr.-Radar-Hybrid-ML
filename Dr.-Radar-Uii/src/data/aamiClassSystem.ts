export type AamiClassCode = 'N' | 'S' | 'V' | 'F' | 'Q';

export interface AamiClassMeta {
  code: AamiClassCode;
  name: string; // Exact full name as requested: Normal, Supraventricular ectopic, Ventricular ectopic, Fusion, Unknown/Paced
  fullName: string; // Alias for name
  abbreviation: string; // N, S, V, F, Q
  subtypes: string;
  testSupport: string;
  clinicalSignificance: string;
  // Accessible color tokens with WCAG AA compliance (contrast ratio >= 4.5:1 on light/dark surfaces)
  color: string;          // Primary accessible accent color
  bgLight: string;        // Light tinted background
  borderLight: string;    // Light border color
  textDark: string;       // Dark accessible text color on light background (WCAG AAA >= 7:1)
  textOnSolid: string;    // Text on primary solid color (#ffffff)
  iconName: string;       // Material Symbols icon name
  datasetPrevalence: string;
}

/**
 * Standardized AAMI EC57 5-Class Visual System Configuration
 *
 * Requirements:
 * - Exact abbreviations: N, S, V, F, Q
 * - Exact full names:
 *   N — Normal
 *   S — Supraventricular ectopic
 *   V — Ventricular ectopic
 *   F — Fusion
 *   Q — Unknown/Paced
 * - Consistent icon/badge treatment, typography, status presentation
 * - Accessible contrast across all screens
 * - Categorical morphological identification without implying clinical severity
 */
export const AAMI_CLASS_CONFIG: Record<AamiClassCode, AamiClassMeta> = {
  N: {
    code: 'N',
    name: 'Normal',
    fullName: 'Normal',
    abbreviation: 'N',
    subtypes: 'Normal Sinus, Atrial Escape, Nodal Escape, LBBB, RBBB',
    testSupport: '18,124 beats (82.8%)',
    clinicalSignificance: 'Physiological baseline conduction with preserved AV nodal refractory rhythm.',
    color: '#047857',        // Emerald 700 (5.2:1 on white)
    bgLight: '#ecfdf5',      // Emerald 50
    borderLight: '#a7f3d0',  // Emerald 200
    textDark: '#065f46',     // Emerald 800 (8.4:1 on bgLight)
    textOnSolid: '#ffffff',
    iconName: 'check_circle',
    datasetPrevalence: '82.8%',
  },
  S: {
    code: 'S',
    name: 'Supraventricular ectopic',
    fullName: 'Supraventricular ectopic',
    abbreviation: 'S',
    subtypes: 'Atrial Premature (PAC), Aberrated PAC, Nodal Premature',
    testSupport: '612 beats (2.8%)',
    clinicalSignificance: 'Atrial or AV nodal ectopic depolarization above the bifurcation of the Bundle of His.',
    color: '#b45309',        // Amber 700 (4.7:1 on white)
    bgLight: '#fffbeb',      // Amber 50
    borderLight: '#fde68a',  // Amber 200
    textDark: '#78350f',     // Amber 900 (9.2:1 on bgLight)
    textOnSolid: '#ffffff',
    iconName: 'bolt',
    datasetPrevalence: '2.8%',
  },
  V: {
    code: 'V',
    name: 'Ventricular ectopic',
    fullName: 'Ventricular ectopic',
    abbreviation: 'V',
    subtypes: 'Premature Ventricular Contraction (PVC), Ventricular Escape',
    testSupport: '1,508 beats (6.9%)',
    clinicalSignificance: 'Ectopic impulse within ventricular myocardium; wide QRS complex with secondary repolarization discordance.',
    color: '#b91c1c',        // Red 700 / deep crimson (6.2:1 on white)
    bgLight: '#fef2f2',      // Red 50
    borderLight: '#fecaca',  // Red 200
    textDark: '#991b1b',     // Red 800 (7.8:1 on bgLight)
    textOnSolid: '#ffffff',
    iconName: 'warning',
    datasetPrevalence: '6.9%',
  },
  F: {
    code: 'F',
    name: 'Fusion',
    fullName: 'Fusion',
    abbreviation: 'F',
    subtypes: 'Fusion of Ventricular Ectopic and Normal Conduction Wavefront',
    testSupport: '176 beats (0.8%)',
    clinicalSignificance: 'Intermediate morphology resulting from simultaneous SA-nodal and ventricular ectopic discharge.',
    color: '#6d28d9',        // Purple 700 (6.8:1 on white)
    bgLight: '#f5f3ff',      // Purple 50
    borderLight: '#ddd6fe',  // Purple 200
    textDark: '#5b21b6',     // Purple 800 (8.6:1 on bgLight)
    textOnSolid: '#ffffff',
    iconName: 'call_merge',
    datasetPrevalence: '0.8%',
  },
  Q: {
    code: 'Q',
    name: 'Unknown/Paced',
    fullName: 'Unknown/Paced',
    abbreviation: 'Q',
    subtypes: 'Paced Beats, Fusion of Paced & Normal, Unclassifiable Artifact',
    testSupport: '1,472 beats (6.7%)',
    clinicalSignificance: 'Electronic pacemaker artifact or corrupted baseline morphology beyond standard taxonomy.',
    color: '#0369a1',        // Sky 700 (5.4:1 on white)
    bgLight: '#f0f9ff',      // Sky 50
    borderLight: '#bae6fd',  // Sky 200
    textDark: '#075985',     // Sky 800 (7.3:1 on bgLight)
    textOnSolid: '#ffffff',
    iconName: 'sensors',
    datasetPrevalence: '6.7%',
  },
};

export const AAMI_ORDERED_CODES: AamiClassCode[] = ['N', 'S', 'V', 'F', 'Q'];

export const AAMI_CLASS_LIST = AAMI_ORDERED_CODES.map((code) => AAMI_CLASS_CONFIG[code]);

/**
 * Resolves metadata for any class code, with safe fallback to N if unknown
 */
export const getAamiClass = (code: string | undefined): AamiClassMeta => {
  const normalized = (code || 'N').toUpperCase() as AamiClassCode;
  return AAMI_CLASS_CONFIG[normalized] || AAMI_CLASS_CONFIG.N;
};

/**
 * Standard disclaimer regarding categorical color presentation vs clinical severity
 */
export const AAMI_SYSTEM_DISCLAIMER =
  'AAMI EC57 Class Visual System: Objective morphological category mapping. Colors represent taxonomic class identity with WCAG AA compliance and do not denote clinical severity levels.';
