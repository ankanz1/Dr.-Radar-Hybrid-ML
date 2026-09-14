import { Doctor, ActivityItem, HistoryReport, TrendDataPoint, ScreeningPatient } from '../types';

export const ASSETS = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQq5SU2PTBe4UyziH1vluHQe1HsoEtnUerRjN5CP8tdhdA31aW4fwztS0F-FWYzAhrcuo4b0pe4w7RhL-PM8CjsMs91V9RmAlakC2Al-3CBp4V3YU8erSb6-ypxtpK5f5FLY1rWefD7Bb7k9V4ym6nLoJtXgstn0cTxQHeiO9tCids1eZSew6fzbJxp3_-3SKU02zr40raiXIZlfHHpsSWMQuQJjaplasbtsurnQOYlbpWOsLeTBt9',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCW2pmQII9Djb5DSr5Xxd9oEwasJi1hVVvvZXw4-hswWJCqGv5UOXTVZSfvp_vqN9u2XDuqF0vksOEWIyFzQIxq2c57I4BGNNZpPFEl3F66oV-vS7IZ3ScGDOznJGn4Ww3L1sbJDAfaV_6JasZBSj6QJa3EDlLKfDLM4fXECiY2K6AOAs6YDylc124Jf5q7c2ya-v2udlh3qEpmPUFx4-0O0B_p8Zm2kKnIWlTxBTafcQUtDrJGOcxY',
  heartBg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfB4rU6a7bHL8gjXH9kfJChFSxIrAfvaj0v2qg45XgZZ8ngsm8b-QiAIiowkpdMjYPl73P6Fr4qrUSQ2SEv0L1ZpJ40qRcZifkU0YLt6zmsFCD1muHIhFPWhjtHhd1aiv7nuBqtdQSXrnO-ua5kI1du8V8cdr-0u9XkiUVTJaIGUsGC-qo6UTGjCL7jEgbRXV1UCWvJgq0_zkx3J5XBef2rpFkqCpqB-rsxBmdk8-wz-CvxObLEcaE',
  waterDrop: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkBDPxUS-f9-eurbEDnweonSAZdXuHwhNx5pJSwbiqg-KRUDeMONv_IO9hQzRequp5abJVsYMytWoTrtwYv08EIZPR-0_lbeyq1AEEPvlFBk3ri79dSelk4fxUYZoDklmvFtIwVRegT7cxPmGTI6vXeJWdtOcUkOOKy7RqYgoymUYh3X8a8AMNjMm5ZfAIzzW-B6UtEPdS2obKFVdN4_RMp0Cig2E-YXAcqi88uPp4G98sORz7ll0l',
  screeningHeart: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvboGGso0XtfptFAtcjiKp6Nw0MVtBDZC8E6GZCmdVB8ca-O1VWKKw-md-SnmIJS1Wc2HK3WkB4vm4WijOZ--08RJIKOMvDaLHVWUQyYV6zY-r0HDWE_kJ4X-Fqbk6INAR6h0CRw7X4uKxeR6sCxjhgbNnL1_K-tOGnUu8CFTOT6S1uTeTrtstt0ifW6MakcumRF9JHaIaVHEKd-6XSqTqv11kPUADa2BxQvPtZG1TyMaLuE_o2C1m',
  drRonald: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEMrfKHrhH9jDK6gIupw88DfsPP-ZlMB0CEecB87IfePkhGrxkP5_D4G3xOviaZ6AQULPfVDQ4wSlbnVv0p27lNW_CrNpGnNzC3ILtm9oHTY4YevakCksrIfit5T9oxZdxMoYs3N7bg9ifwZOCzXDA66pgSBznJ116Jf4-G3F0PbslSz1y_6WbXQ2dhdn2MxQtE8SvDVlJX8X2YqFNogfggd3nIwLhHJn4CwtlGYBJ5ey15t0r2Cff',
  drElena: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA2nAvVS2LJEbz16aOwG6E348HAqiCRnEpMxPR2RkEPptLbamPRxAnkPzsy9_o7N2ND8csfiyH6yaKSudXzjjsIKeh8gRf-j4NtBidJAl84NDu6NnnCsnA-0TlWDM7kfLNzO-AcJLcu7pdhZU1osbUJmKVCt4bLJWQTs0DkSfKqtzVL7aIlcsyT4pCIeJO_dWMl2ZsGDzG9kjy1ZadvPrQd2ad3O1llhPXeP3s1vT61C6V9E3bJqAm9',
  drMarcus: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjaRubrs06j6km2u3BlCxiDztfsVKbUda7p0j_AVfhi1F3_I_NtT9D8TvbhGXqX0jPeGvD3O4DLeLLVMVzp_h5LkqhAMbq7pOkgPy3g1wWfn8oJfjx7hqLfEEADnY6vgPEo8wE_dyWJBLS2nLojJ6-5hZiZcxJCs8Ikp_21cyxbGGX-DJKntfkxYB3-jIIdwtSa3RaUeldQ9YaF6aBsjQ2hP1_eJXCk9MA4Tq9aGWdkVWY4dLmiEMB',
};

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'dr-ronald',
    name: 'Dr. Ronald S.',
    title: 'Senior Cardiologist',
    specialty: 'Cardiology',
    rating: 4.9,
    availableTag: 'Available Today',
    nextAvailable: '14:30 PM',
    isAvailableToday: true,
    avatarUrl: ASSETS.drRonald,
    experienceYears: 18,
    hospital: 'Metropolitan Heart Institute',
    about: 'Specializing in preventive cardiology, coronary artery disease, and adult rhythm disorders. Board certified in Cardiovascular Medicine.',
    slots: ['14:30 PM', '15:15 PM', '16:00 PM', '17:30 PM']
  },
  {
    id: 'dr-elena',
    name: 'Dr. Elena M.',
    title: 'Cardiac Electrophysiologist',
    specialty: 'Electrophysiology',
    rating: 4.8,
    availableTag: 'Available Today',
    nextAvailable: '15:45 PM',
    isAvailableToday: true,
    avatarUrl: ASSETS.drElena,
    experienceYears: 12,
    hospital: 'St. Jude Cardiac Center',
    about: 'Expert in complex cardiac arrhythmias, catheter ablation procedures, and continuous Holter monitoring interpretation.',
    slots: ['15:45 PM', '16:30 PM', '17:15 PM', '18:00 PM']
  },
  {
    id: 'dr-marcus',
    name: 'Dr. Marcus T.',
    title: 'Consultant Cardiologist',
    specialty: 'Cardiology',
    rating: 5.0,
    availableTag: 'Tomorrow',
    nextAvailable: 'Tomorrow, 10:15 AM',
    isAvailableToday: false,
    avatarUrl: ASSETS.drMarcus,
    experienceYears: 14,
    hospital: 'Johns Hopkins Medicine',
    about: 'Dedicated to echocardiography, athletic heart conditioning, and clinical cardiac screening with AI diagnostic tools.',
    slots: ['10:15 AM', '11:45 AM', '14:00 PM', '16:30 PM']
  },
  {
    id: 'dr-aaron',
    name: 'Dr. Aaron Patel, MD',
    title: 'Heart Failure & Rhythm Specialist',
    specialty: 'Cardiology',
    rating: 4.95,
    availableTag: 'Available Today',
    nextAvailable: '16:15 PM',
    isAvailableToday: true,
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    experienceYears: 16,
    hospital: 'Stanford Health Care',
    about: 'Focuses on advanced myocardial disorders, continuous hemodynamic sensor integration, and cardiac rehabilitation.',
    slots: ['16:15 PM', '17:00 PM', '18:30 PM']
  },
  {
    id: 'dr-sarah',
    name: 'Dr. Sarah Jenkins, DO',
    title: 'Preventative Cardiology Lead',
    specialty: 'Preventative',
    rating: 4.92,
    availableTag: 'Available Today',
    nextAvailable: '17:00 PM',
    isAvailableToday: true,
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
    experienceYears: 11,
    hospital: 'Mayo Clinic Health System',
    about: 'Specializes in blood pressure control, arterial stiffness reduction, exercise physiology, and holistic heart longevity.',
    slots: ['17:00 PM', '17:45 PM', '18:45 PM']
  },
  {
    id: 'dr-miriam',
    name: 'Dr. Miriam Al-Mansoor, MD',
    title: 'Senior Electrophysiologist',
    specialty: 'Electrophysiology',
    rating: 4.94,
    availableTag: 'Tomorrow',
    nextAvailable: 'Tomorrow, 11:30 AM',
    isAvailableToday: false,
    avatarUrl: 'https://images.unsplash.com/photo-1594824813596-78b671a531e2?auto=format&fit=crop&w=600&q=80',
    experienceYears: 15,
    hospital: 'Boston Heart Institute',
    about: 'Specialist in supraventricular tachycardia, atrial fibrillation rhythm control, and implantable loop recorder data analysis.',
    slots: ['11:30 AM', '13:15 PM', '15:00 PM']
  }
];

export const RECENT_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    title: 'Routine Scan Completed',
    subtitle: 'Normal sinus rhythm detected',
    timeAgo: '2h ago',
    icon: 'monitor_heart',
    type: 'scan'
  },
  {
    id: 'act-2',
    title: 'Monthly Report Generated',
    subtitle: 'Available for download',
    timeAgo: 'Yesterday',
    icon: 'description',
    type: 'report'
  },
  {
    id: 'act-3',
    title: 'Holter Session Uploaded',
    subtitle: 'Continuous ECG recording synchronized',
    timeAgo: '3 days ago',
    icon: 'vital_signs',
    type: 'scan'
  }
];

export const HISTORY_REPORTS: HistoryReport[] = [
  {
    id: 'rep-1',
    title: 'ECG Scan',
    date: 'Sep 15, 2023',
    bpmAvg: 64,
    rhythmStatus: 'Normal Sinus Rhythm',
    summary: 'Resting 12-lead ECG equivalent showed uniform P-waves, normal PR and QT intervals, with no ectopic ventricular beats.',
    icon: 'monitor_heart'
  },
  {
    id: 'rep-2',
    title: 'Blood Pressure',
    date: 'Aug 22, 2023',
    bpmAvg: 68,
    rhythmStatus: 'Normotensive (118/78 mmHg)',
    summary: 'Arterial blood pressure remained within normal adult range across all automated readings during the test window.',
    icon: 'blood_pressure'
  },
  {
    id: 'rep-3',
    title: 'AI Cardiac Check',
    date: 'Jul 10, 2023',
    badge: 'Attention',
    isAttention: true,
    bpmAvg: 88,
    rhythmStatus: 'Sinus Tachycardia Event',
    summary: 'Brief episode of elevated heart rate observed during evening exercise. Follow-up recommended if symptoms persist.',
    icon: 'warning'
  },
  {
    id: 'rep-4',
    title: 'Comprehensive Stress ECG',
    date: 'May 04, 2023',
    bpmAvg: 72,
    rhythmStatus: 'Negative for Ischemia',
    summary: 'Submaximal workload achieved without ischemic ST depression. Recovery heart rate deceleration was normal.',
    icon: 'monitor_heart'
  }
];

export const TREND_7_DAYS: TrendDataPoint[] = [
  { day: 'Mon', bpm: 64, cx: 0, cy: 70, dateStr: 'Oct 18' },
  { day: 'Tue', bpm: 68, cx: 60, cy: 50, dateStr: 'Oct 19' },
  { day: 'Wed', bpm: 74, cx: 120, cy: 40, dateStr: 'Oct 20' },
  { day: 'Thu', bpm: 60, cx: 180, cy: 60, dateStr: 'Oct 21' },
  { day: 'Fri', bpm: 71, cx: 240, cy: 45, dateStr: 'Oct 22' },
  { day: 'Sat', bpm: 67, cx: 280, cy: 42, dateStr: 'Oct 23' },
  { day: 'Sun', bpm: 62, cx: 300, cy: 55, dateStr: 'Oct 24' },
];

export const TREND_30_DAYS: TrendDataPoint[] = [
  { day: 'Week 1', bpm: 63, cx: 0, cy: 68, dateStr: 'Oct 1 - Oct 7' },
  { day: 'Week 2', bpm: 66, cx: 100, cy: 52, dateStr: 'Oct 8 - Oct 14' },
  { day: 'Week 3', bpm: 61, cx: 200, cy: 72, dateStr: 'Oct 15 - Oct 21' },
  { day: 'Week 4', bpm: 62, cx: 300, cy: 55, dateStr: 'Oct 22 - Oct 28' },
];

export const SCREENING_PATIENTS: ScreeningPatient[] = [
  { id: 'p-1', name: 'Ashton Miller (Current)', age: 34, gender: 'Male', status: 'Scanning', bpm: 62, risk: 'Low', rhythm: 'Normal Sinus Rhythm' },
  { id: 'p-2', name: 'Clara Jenkins', age: 58, gender: 'Female', status: 'Analyzed', bpm: 71, risk: 'Low', rhythm: 'Normal Sinus Rhythm' },
  { id: 'p-3', name: 'Robert Vance', age: 67, gender: 'Male', status: 'Analyzed', bpm: 84, risk: 'Moderate', rhythm: 'Occasional PACs' },
  { id: 'p-4', name: 'Sophia Chen', age: 29, gender: 'Female', status: 'Scanning', bpm: 66, risk: 'Low', rhythm: 'Athletic Bradycardia' },
];
