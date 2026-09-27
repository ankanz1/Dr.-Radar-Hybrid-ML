/**
 * New patient-first journey tabs.
 *
 * These are string values compatible with ScreenTab (they are added to
 * ScreenTab in types.ts) so all existing navigation plumbing keeps working.
 */
export type PatientJourneyTab =
  | 'journey-home'
  | 'journey-assessment'
  | 'journey-upload'
  | 'journey-records'
  | 'journey-doctors'
  | 'journey-appointments';
